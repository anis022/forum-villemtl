"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import { isBlocked, type Score } from "@/utils/moderation";
import { DEFAULT_LOCALE, isLocale, type ErrorCode, type Locale } from "@/utils/i18n";

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
  return { supabase, user };
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
  const { supabase, user } = await requireUser();
  if (!user) return { error: "notSignedIn" };

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

    const extension = image.type.split("/")[1].replace("jpeg", "jpg");
    // The uid folder prefix is what the storage policy checks.
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("issue-images")
      .upload(path, image, { contentType: image.type });

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

  revalidatePath(`/${locale}`);
  redirect(`/${locale}/sujets/${data.id}`);
}

/**
 * Who is allowed to withdraw a given report.
 *
 * RLS enforces this independently; deciding it here as well is what lets the
 * page render the right controls and return a usable message instead of an
 * opaque policy error.
 */
async function removalRights(issueId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { supabase, user: null, allowed: false, isOfficial: false, authorId: null };

  const [{ data: issue }, { data: profile }] = await Promise.all([
    supabase.from("issues").select("author_id").eq("id", issueId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const isOfficial = profile?.role === "official";
  const authorId = (issue?.author_id as string | undefined) ?? null;
  return {
    supabase,
    user,
    isOfficial,
    authorId,
    allowed: Boolean(authorId) && (authorId === user.id || isOfficial),
  };
}

/** Withdraw a report. Comments and votes cascade with it. */
export async function deleteIssue(issueId: string, formData: FormData): Promise<ActionState> {
  const { supabase, user, allowed } = await removalRights(issueId);
  if (!user) return { error: "notSignedIn" };
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
  const { supabase, user } = await requireUser();
  if (!user) return { error: "notSignedIn" };

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
  const { supabase, user } = await requireUser();
  if (!user) return { supabase, user: null, allowed: false, isOfficial: false, issueId: null };

  const [{ data: comment }, { data: profile }] = await Promise.all([
    supabase.from("comments").select("author_id, issue_id").eq("id", commentId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const isOfficial = profile?.role === "official";
  const authorId = (comment?.author_id as string | undefined) ?? null;
  return {
    supabase,
    user,
    isOfficial,
    issueId: (comment?.issue_id as string | undefined) ?? null,
    allowed: Boolean(authorId) && (authorId === user.id || isOfficial),
  };
}

/** Remove a comment. The replies hanging off it go with it — see migration 0014. */
export async function deleteComment(
  commentId: string,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, allowed, issueId } = await commentRights(commentId);
  if (!user) return { error: "notSignedIn" };
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
  const { supabase, user } = await requireUser();
  if (!user) return { error: "notSignedIn" };

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
  const { supabase, user } = await requireUser();
  if (!user) return { error: "notSignedIn" };

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
  const { supabase, user } = await requireUser();
  if (!user) return { error: "notSignedIn" };

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
