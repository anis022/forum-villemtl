"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { ErrorCode } from "@/utils/i18n";
import { isBoroughSlug } from "@/utils/boroughs";
import { imageFileToWebp } from "@/utils/server-image";

export type ProfileResult = { ok: true } | { ok: false; error: ErrorCode };

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Record which borough the signed-in person is here about.
 *
 * The slug is checked against the same list the selector was drawn from, not
 * trusted from the form: a server action is a public endpoint, and the check
 * constraint in migration 0024 would otherwise be the only thing between a
 * hand-written request and a profile pointing at a borough with no data behind
 * it.
 */
export async function updateBorough(slug: string): Promise<ProfileResult> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notSignedIn" };
  if (!isBoroughSlug(slug)) return { ok: false, error: "boroughUnknown" };

  const { error } = await supabase.from("profiles").update({ borough: slug }).eq("id", user.id);
  if (error) return { ok: false, error: "boroughFailed" };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Replace the signed-in user's avatar.
 *
 * The converted file is stored under `<user-id>/avatar.webp`, which is what the storage
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
  if (!TYPES[file.type]) return { ok: false, error: "imageType" };
  if (file.size > MAX_BYTES) return { ok: false, error: "imageTooBig" };

  let webp: Buffer;
  try {
    webp = await imageFileToWebp(file, { maxDimension: 1024, quality: 80 });
  } catch (conversionError) {
    console.error("[profile] avatar conversion:", conversionError);
    return { ok: false, error: "imageType" };
  }

  const path = `${user.id}/avatar.webp`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, webp, { upsert: true, contentType: "image/webp" });
  if (uploadError) {
    console.error("[profile] avatar upload:", uploadError.message);
    return { ok: false, error: "uploadFailed" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: saveError } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", user.id);
  if (saveError) {
    console.error("[profile] avatar url save:", saveError.message);
    return { ok: false, error: "uploadFailed" };
  }

  // Earlier versions stored the original extension. Once the WebP is live,
  // remove those now-unreferenced copies so optimization also reduces storage.
  await supabase.storage
    .from("avatars")
    .remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`]);

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
  if (error) {
    console.error("[profile] avatar clear:", error.message);
    return { ok: false, error: "uploadFailed" };
  }

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
  if (error) {
    console.error("[profile] close account:", error.message);
    return { ok: false, error: "publishFailed" };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true };
}
