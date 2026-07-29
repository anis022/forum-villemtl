"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
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

  if (error || !data) return { error: "publishFailed", values };

  revalidatePath(`/${locale}`);
  redirect(`/${locale}/sujets/${data.id}`);
}

/**
 * Who is allowed to change or withdraw a given report.
 *
 * RLS enforces this independently; deciding it here as well is what lets the
 * page render the right controls and return a usable message instead of an
 * opaque policy error.
 */
async function editRights(issueId: string) {
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

/**
 * Edit a report: words, category, and the attached photo.
 *
 * The location stays fixed. A pin is not a detail of the report, it is what
 * the report points at, and moving it would silently turn one report into
 * another. Correcting a wrong location means withdrawing and re-filing.
 *
 * When the editor is not the author, `edited_by` records it so the page can say
 * an elected official altered a resident's text. An invisible edit by someone
 * with authority is indistinguishable from censorship.
 */
export async function updateIssue(
  issueId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, allowed } = await editRights(issueId);
  if (!user) return { error: "notSignedIn" };
  if (!allowed) return { error: "notAuthorized" };

  const locale = localeFrom(formData);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "general") as Category;
  const values = { title, body, category };

  if (title.length < 5) return { error: "titleTooShort", values };
  if (title.length > 150) return { error: "titleTooLong", values };
  if (body.length < 20) return { error: "bodyTooShort", values };
  if (body.length > 5000) return { error: "bodyTooLong", values };
  if (!CATEGORY_KEYS.includes(category)) return { error: "badCategory", values };

  // Read the stored path server-side rather than trusting a hidden field: a
  // forged one would point the delete below at somebody else's file.
  const { data: current } = await supabase
    .from("issues")
    .select("image_path")
    .eq("id", issueId)
    .maybeSingle();

  const image = formData.get("image");
  const removeImage = formData.get("removeImage") === "1";

  let imagePath: string | null = (current?.image_path as string | null) ?? null;
  let orphaned: string | null = null;

  if (image instanceof File && image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) return { error: "imageType", values };
    if (image.size > MAX_IMAGE_BYTES) return { error: "imageTooBig", values };

    const extension = image.type.split("/")[1].replace("jpeg", "jpg");
    // Filed under the uploader's uid — the folder prefix is what the storage
    // policy checks, so an official's replacement lands under their own name.
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("issue-images")
      .upload(path, image, { contentType: image.type });
    if (uploadError) return { error: "uploadFailed", values };

    orphaned = imagePath;
    imagePath = path;
  } else if (removeImage) {
    orphaned = imagePath;
    imagePath = null;
  }

  const { error } = await supabase
    .from("issues")
    .update({
      title,
      body,
      category,
      image_path: imagePath,
      edited_at: new Date().toISOString(),
      edited_by: user.id,
    })
    .eq("id", issueId);

  if (error) return { error: "publishFailed", values };

  // Only after the row stops pointing at it, so a failed update never leaves a
  // report referencing a file that has already been deleted.
  if (orphaned) {
    await supabase.storage.from("issue-images").remove([orphaned]);
  }

  revalidatePath(`/${locale}/sujets/${issueId}`);
  revalidatePath(`/${locale}`);
  redirect(`/${locale}/sujets/${issueId}`);
}

/** Withdraw a report. Comments and votes cascade with it. */
export async function deleteIssue(issueId: string, formData: FormData): Promise<ActionState> {
  const { supabase, user, allowed } = await editRights(issueId);
  if (!user) return { error: "notSignedIn" };
  if (!allowed) return { error: "notAuthorized" };

  const locale = localeFrom(formData);
  const { error } = await supabase.from("issues").delete().eq("id", issueId);
  if (error) return { error: "notAuthorized" };

  revalidatePath(`/${locale}`);
  redirect(`/${locale}`);
}

export async function addComment(
  issueId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "notSignedIn" };

  const locale = localeFrom(formData);
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { error: "commentTooShort", values: { body } };
  if (body.length > 5000) return { error: "commentTooLong", values: { body } };

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
  });

  if (error) return { error: "commentFailed", values: { body } };

  revalidatePath(`/${locale}/sujets/${issueId}`);
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
