"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import { isBlocked, type Score } from "@/utils/moderation";
import { NO_TRANSLATION, translateForOffice } from "@/utils/official-translation";
import { DEFAULT_LOCALE, isLocale, type ErrorCode, type Locale } from "@/utils/i18n";
import { imageFileToWebp } from "@/utils/server-image";
import { notifyStaffOfNewTopic } from "@/utils/notify/staff";

/**
 * Actions return an error *code*, not a sentence: the caller renders it in
 * whichever language the page is being viewed in.
 *
 * React resets uncontrolled form fields once a form action resolves, so a
 * rejected submission would otherwise wipe everything the user typed. The
 * submitted values are echoed back and re-applied as defaultValue.
 */
export type ActionState = {
  error: ErrorCode | null;
  values?: {
    title?: string;
    body?: string;
    category?: string;
    lat?: number | null;
    lon?: number | null;
  };
};

/**
 * The borough, with padding. A pin outside it is refused: a report the
 * arrondissement cannot act on helps nobody, and the map would stretch to fit
 * a point nobody meant to place.
 */
const BOROUGH = { minLat: 45.4495, maxLat: 45.5095, minLon: -73.665, maxLon: -73.598 };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Every action re-checks the session server-side. RLS is the real backstop,
 * but failing here gives a usable message instead of an opaque policy error.
 */
async function requireUser() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, canParticipate: false };

  const { data, error } = await supabase.rpc("viewer_is_member");
  return { supabase, user, canParticipate: !error && data === true };
}

const localeFrom = (formData: FormData): Locale => {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : DEFAULT_LOCALE;
};

/**
 * Ask the matcher about a message before writing it.
 *
 * The trigger in migration 0020 will refuse the insert on its own, so this is
 * not what makes the rule hold — it is what makes the refusal a sentence
 * instead of a failed request. Somebody being told "this is not going up, and
 * here is why" can rewrite it; somebody watching a spinner fail cannot.
 *
 * A matcher that cannot be reached returns `clear`. The alternative is a
 * database hiccup silently turning into a forum nobody can post to, and the
 * trigger is still there to catch what this pass missed.
 */
async function screen(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  text: string,
): Promise<Score> {
  const { data, error } = await supabase.rpc("moderation_score", { p_text: text });
  const row = (Array.isArray(data) ? data[0] : data) as Score | undefined;
  if (error || !row) return { score: 0, verdict: "clear", terms: [] };
  return row;
}

export async function createIssue(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "general") as Category;
  const image = formData.get("image");

  const rawLat = String(formData.get("lat") ?? "").trim();
  const rawLon = String(formData.get("lon") ?? "").trim();
  const lat = rawLat === "" ? null : Number(rawLat);
  const lon = rawLon === "" ? null : Number(rawLon);

  const values = { title, body, category, lat, lon };

  if (title.length < 5) return { error: "titleTooShort", values };
  if (title.length > 150) return { error: "titleTooLong", values };
  if (body.length < 20) return { error: "bodyTooShort", values };
  if (body.length > 5000) return { error: "bodyTooLong", values };
  if (!CATEGORY_KEYS.includes(category)) return { error: "badCategory", values };

  // Re-validated here, not only in the picker: the browser can post anything.
  if (lat === null || lon === null) return { error: "locationRequired", values };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "locationRequired", values };
  }
  if (
    lat < BOROUGH.minLat ||
    lat > BOROUGH.maxLat ||
    lon < BOROUGH.minLon ||
    lon > BOROUGH.maxLon
  ) {
    return { error: "locationOutside", values };
  }

  // Asked before the upload, not after. The trigger would refuse the insert
  // either way, but by then the photo is already in storage with nothing left
  // pointing at it.
  const verdict = await screen(supabase, `${title} ${body}`);
  if (verdict.verdict === "block") return { error: "messageRefused", values };

  // Uploaded before the insert so a storage failure doesn't leave a published
  // issue pointing at a file that was never stored.
  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) return { error: "imageType", values };
    if (image.size > MAX_IMAGE_BYTES) return { error: "imageTooBig", values };

    // The uid folder prefix is what the storage policy checks.
    const path = `${user.id}/${crypto.randomUUID()}.webp`;

    let webp: Buffer;
    try {
      webp = await imageFileToWebp(image);
    } catch (conversionError) {
      console.error("[issues] image conversion:", conversionError);
      return { error: "imageType", values };
    }

    const { error: uploadError } = await supabase.storage
      .from("issue-images")
      .upload(path, webp, { contentType: "image/webp" });

    if (uploadError) return { error: "uploadFailed", values };
    imagePath = path;
  }

  const { data, error } = await supabase
    .from("issues")
    .insert({ author_id: user.id, title, body, category, image_path: imagePath, lat, lon })
    .select("id")
    .single();

  // `isBlocked` covers the gap between the screen above and the insert: the
  // lexicon is a table somebody may have just edited.
  if (isBlocked(error)) return { error: "messageRefused", values };
  if (error || !data) return { error: "publishFailed", values };

  await storeOfficialTranslation(supabase, user.id, data.id, title, body, locale);

  // The office is told after the resident has been sent to their own post, not
  // before. `after` still runs when the `redirect` below throws, so nothing is
  // lost by putting the resident first.
  after(() => notifyStaffOfNewTopic(data.id));

  revalidatePath(`/${locale}`);
  redirect(`/${locale}/sujets/${data.id}`);
}

/**
 * Store the other language, for a post the office published.
 *
 * A second statement rather than part of the insert, because it waits on a
 * network call: folding it in would hold the row open across an eight-second
 * timeout on a third party nobody here controls. The post is saved first and
 * the translation catches up a moment later.
 *
 * Silent when the author is not on the staff, which is the common case and the
 * one that must cost nothing.
 */
async function storeOfficialTranslation(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  issueId: string,
  title: string | null,
  body: string,
  locale: Locale,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "official") return;

  const translation = await translateForOffice(title, body, locale);

  // Written either way. On an edit the columns already hold the old wording,
  // and a translation that failed to refresh would go on being served as though
  // it were the post -- see `NO_TRANSLATION`.
  await supabase
    .from("issues")
    .update(translation ?? NO_TRANSLATION)
    .eq("id", issueId);
}

/**
 * Who is allowed to withdraw a given report.
 *
 * RLS enforces this independently; deciding it here as well is what lets the
 * page render the right controls and return a usable message instead of an
 * opaque policy error.
 */
async function removalRights(issueId: string) {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) {
    return {
      supabase,
      user: null,
      canParticipate: false,
      allowed: false,
      isOfficial: false,
      authorId: null,
    };
  }

  const [{ data: issue }, { data: profile }] = await Promise.all([
    supabase.from("issues").select("author_id").eq("id", issueId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const isOfficial = profile?.role === "official";
  const authorId = (issue?.author_id as string | undefined) ?? null;
  return {
    supabase,
    user,
    canParticipate,
    isOfficial,
    authorId,
    allowed: canParticipate && Boolean(authorId) && (authorId === user.id || isOfficial),
  };
}

/** Withdraw a report. Comments and votes cascade with it. */
export async function deleteIssue(issueId: string, formData: FormData): Promise<ActionState> {
  const { supabase, user, canParticipate, allowed } = await removalRights(issueId);
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };
  if (!allowed) return { error: "notAuthorized" };

  const locale = localeFrom(formData);
  const { error } = await supabase.from("issues").delete().eq("id", issueId);
  if (error) return { error: "notAuthorized" };

  revalidatePath(`/${locale}`);
  redirect(`/${locale}`);
}

/**
 * Post a reply — to the report itself, or to another reply when `parentId` is
 * given. Which issue the parent belongs to, and how deep the thread is allowed
 * to run, are settled by the trigger in migration 0014 rather than here: this
 * insert goes through the same API a signed-in browser can call directly.
 */
export async function addComment(
  issueId: string,
  parentId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { error: "commentTooShort", values: { body } };
  if (body.length > 5000) return { error: "commentTooLong", values: { body } };

  const verdict = await screen(supabase, body);
  if (verdict.verdict === "block") return { error: "messageRefused", values: { body } };

  // The official flag is derived from the server-side profile, never from the
  // client, so a citizen cannot post a reply styled as an official answer.
  // RLS enforces the same rule independently.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("comments").insert({
    issue_id: issueId,
    author_id: user.id,
    body,
    is_official: profile?.role === "official",
    // Only when there is one. Naming the column unconditionally would break
    // every comment on the site on a database where migration 0014 has not been
    // applied yet — and where the page never offers to reply to a reply anyway.
    ...(parentId ? { parent_id: parentId } : {}),
  });

  if (isBlocked(error)) return { error: "messageRefused", values: { body } };
  if (error) return { error: "commentFailed", values: { body } };

  revalidatePath(`/${locale}/sujets/${issueId}`);
  revalidatePath(`/${locale}`);
  return { error: null };
}

/**
 * Who may remove a given comment: the person who wrote it, or an elected
 * official acting as a moderator.
 *
 * The same shape as `removalRights` for reports, and for the same reason — RLS
 * decides this independently, and deciding it here as well is what lets the
 * thread render the right controls and return a usable message rather than an
 * opaque policy error.
 */
async function commentRights(commentId: string) {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) {
    return {
      supabase,
      user: null,
      canParticipate: false,
      allowed: false,
      isOfficial: false,
      issueId: null,
    };
  }

  const [{ data: comment }, { data: profile }] = await Promise.all([
    supabase.from("comments").select("author_id, issue_id").eq("id", commentId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const isOfficial = profile?.role === "official";
  const authorId = (comment?.author_id as string | undefined) ?? null;
  return {
    supabase,
    user,
    canParticipate,
    isOfficial,
    issueId: (comment?.issue_id as string | undefined) ?? null,
    allowed: canParticipate && Boolean(authorId) && (authorId === user.id || isOfficial),
  };
}

/** Remove a comment. The replies hanging off it go with it — see migration 0014. */
export async function deleteComment(
  commentId: string,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, canParticipate, allowed, issueId } = await commentRights(commentId);
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };
  if (!allowed) return { error: "notAuthorized" };

  const locale = localeFrom(formData);
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { error: "notAuthorized" };

  if (issueId) revalidatePath(`/${locale}/sujets/${issueId}`);
  revalidatePath(`/${locale}`);
  return { error: null };
}

/**
 * Officials only. Authorisation is enforced inside the `set_issue_status`
 * function in Postgres, so this cannot be bypassed by calling the API directly.
 */
export async function setIssueStatus(
  issueId: string,
  status: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const { error } = await supabase.rpc("set_issue_status", {
    p_issue_id: issueId,
    p_status: status,
  });

  if (error) return { error: "notAuthorized" };

  revalidatePath(`/${locale}/sujets/${issueId}`);
  revalidatePath(`/${locale}`);
  return { error: null };
}

/**
 * Dismiss a flag: an official read the message and it is fine.
 *
 * Cleared rather than deleted. The queue's job is partly to show that somebody
 * looked — a flag that vanishes on being read leaves no way to tell "reviewed
 * and allowed" apart from "never seen". Removing the message itself is the
 * other button, and it is the one that already exists.
 *
 * Authorisation is the UPDATE policy on `moderation_flags`, which only officials
 * satisfy; a resident's call writes no rows and reports it.
 */
export async function clearFlag(
  flagId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const { data, error } = await supabase
    .from("moderation_flags")
    .update({ cleared_at: new Date().toISOString(), cleared_by: user.id })
    .eq("id", flagId)
    .is("cleared_at", null)
    .select("id");

  if (error || !data?.length) return { error: "notAuthorized" };

  revalidatePath(`/${locale}/moderation`);
  return { error: null };
}

export async function toggleVote(
  issueId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const { data: existing } = await supabase
    .from("votes")
    .select("issue_id")
    .eq("issue_id", issueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("votes").delete().eq("issue_id", issueId).eq("user_id", user.id)
    : await supabase.from("votes").insert({ issue_id: issueId, user_id: user.id });

  if (error) return { error: "voteFailed" };

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/sujets/${issueId}`);
  return { error: null };
}

/**
 * Rewrite a topic's own words.
 *
 * There was no way to do this at all: RLS has allowed an author to update their
 * row since 0011 and an official to update anybody's, and nothing in the
 * interface ever offered it, so a typo in a title was permanent unless you
 * deleted the topic and lost its replies.
 *
 * The limits are the ones `createIssue` applies, read from the same place, so a
 * sentence that was publishable when written stays publishable when corrected.
 * Who may do it is left to the policies rather than decided here: this checks
 * membership because a lapsed member should not be editing, and the database
 * checks authorship because that is the part that must hold whatever calls it.
 */
export async function updateIssue(
  issueId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notSignedIn" };

  const { data: member } = await supabase.rpc("viewer_is_member");
  if (member !== true) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const values = { title, body, category };

  if (title.length < 5) return { error: "titleTooShort", values };
  if (title.length > 150) return { error: "titleTooLong", values };
  if (body.length < 20) return { error: "bodyTooShort", values };
  if (body.length > 5000) return { error: "bodyTooLong", values };
  if (!CATEGORY_KEYS.includes(category as Category)) return { error: "badCategory", values };

  const { error } = await supabase
    .from("issues")
    .update({ title, body, category, edited_at: new Date().toISOString(), edited_by: user.id })
    .eq("id", issueId);

  if (isBlocked(error)) return { error: "messageRefused", values };
  if (error) return { error: "publishFailed", values };

  // A ballot rides along in the same submission, because a topic that asks a
  // question and the choices under it are one thing to the person editing them.
  // Two buttons meant two saves, two chances to leave half the edit behind, and
  // no way to express "rename this choice and fix the typo in the title" as the
  // single act it is.
  const pollId = String(formData.get("pollId") ?? "");
  if (pollId) {
    const ids = formData.getAll("optionId").map((value) => String(value));
    const labels = formData.getAll("options").map((value) => String(value).trim());

    if (labels.length < 2 || labels.length > 10) return { error: "pollOptionsCount", values };
    if (labels.some((label) => label.length === 0)) return { error: "pollOptionEmpty", values };
    if (labels.some((label) => label.length > 120)) return { error: "pollOptionTooLong", values };
    if (new Set(labels.map((label) => label.toLocaleLowerCase())).size !== labels.length) {
      return { error: "pollOptionDuplicate", values };
    }

    const { error: ballotError } = await supabase.rpc("save_poll_options", {
      p_poll_id: pollId,
      p_options: labels.map((label, i) => ({ id: ids[i] || null, label })),
    });
    if (ballotError) return { error: "publishFailed", values };
  }

  await storeOfficialTranslation(supabase, user.id, issueId, title, body, locale);

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/sujets/${issueId}`);
  return { error: null };
}
