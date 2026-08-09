"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { ErrorCode } from "@/utils/i18n";

export type ProfileResult = { ok: true } | { ok: false; error: ErrorCode };

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Replace the signed-in user's avatar.
 *
 * The file is stored under `<user-id>/avatar.<ext>`, which is what the storage
 * policy checks ownership against — the path itself is the authorisation. The
 * URL carries a cache-busting suffix because the object name is stable across
 * uploads, so browsers would otherwise keep showing the previous photo.
 */
export async function updateAvatar(formData: FormData): Promise<ProfileResult> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notSignedIn" };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "uploadFailed" };
  }
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: "imageType" };
  if (file.size > MAX_BYTES) return { ok: false, error: "imageTooBig" };

  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { ok: false, error: "uploadFailed" };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: saveError } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", user.id);
  if (saveError) return { ok: false, error: "uploadFailed" };

  // The avatar appears on every list, not just the profile page.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Drop the photo and fall back to initials. */
export async function removeAvatar(): Promise<ProfileResult> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notSignedIn" };

  await supabase.storage
    .from("avatars")
    .remove(Object.values(TYPES).map((ext) => `${user.id}/avatar.${ext}`));

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "uploadFailed" };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Close the caller's account.
 *
 * The work happens in `public.close_my_account` (migration 0021), which reads
 * `auth.uid()` itself — there is no id to pass and therefore none to forge. All
 * this does is call it, sign the browser out, and send the person to the home
 * page, because the session it was holding now points at a user that no longer
 * exists.
 *
 * Nothing about it is undoable, which is why the button that reaches it makes
 * you type the word first.
 */
export async function closeAccount(): Promise<ProfileResult> {
  const supabase = createClient(await cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notSignedIn" };

  const { error } = await supabase.rpc("close_my_account");
  if (error) return { ok: false, error: "publishFailed" };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true };
}
