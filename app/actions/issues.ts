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
  values?: { title?: string; body?: string; category?: string };
};

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
  const values = { title, body, category };

  if (title.length < 5) return { error: "titleTooShort", values };
  if (title.length > 150) return { error: "titleTooLong", values };
  if (body.length < 20) return { error: "bodyTooShort", values };
  if (body.length > 5000) return { error: "bodyTooLong", values };
  if (!CATEGORY_KEYS.includes(category)) return { error: "badCategory", values };

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
    .insert({ author_id: user.id, title, body, category, image_path: imagePath })
    .select("id")
    .single();

  if (error || !data) return { error: "publishFailed", values };

  revalidatePath(`/${locale}`);
  redirect(`/${locale}/sujets/${data.id}`);
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
