import type { createClient } from "@/utils/supabase/server";
import { imageFileToWebp } from "@/utils/server-image";
import type { ErrorCode } from "@/utils/i18n";

/**
 * The one file a topic carries, read off a submission and put into storage.
 *
 * Shared by the two actions that write a topic — `createIssue`/`updateIssue`
 * and `createPoll` — rather than living in either. A ballot is a topic with
 * choices under it, so it takes an attachment on the same terms as any other
 * post, and the terms are fiddly enough (a photograph re-encoded here, a video
 * already in storage and named by a path we have to distrust) that a second
 * copy would be a second thing to get wrong.
 *
 * Not exported from an action file: everything a `"use server"` module exports
 * becomes a server action, and these take a Supabase client, which is not
 * something that can cross that boundary.
 */

type Supabase = ReturnType<typeof createClient>;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * A video arrives as a path, not as bytes.
 *
 * Everything else attached to a report is uploaded inside the action, after the
 * session has been re-checked, and a photograph is re-encoded on the way
 * through so storage never sees the original file. None of that survives
 * contact with fifty megabytes: a server action caps its request body, and
 * buffering a phone video through a function to hand it straight back to
 * storage would be slow, expensive, and no safer at the end of it.
 *
 * So the browser uploads to `issue-videos` first and submits what it got back.
 * The storage policies in 0041 are what make that safe rather than this
 * function, because they are the only thing standing between the request and
 * the bucket. What is left to check here is that the path is one those policies
 * could have produced: they confine a writer to a folder named after their own
 * uid, so a path outside the caller's folder is a path they did not write and
 * has no business being attached to their post.
 */
export const ownedVideoPath = (path: string, userId: string) =>
  path.startsWith(`${userId}/`) && !path.includes("..") && path.length <= 200;

/**
 * What a submission says about the attachment.
 *
 * `keep` is the common case on an edit: somebody fixed a typo and never went
 * near the attachment. It is not the same as `clear`, which is somebody
 * pressing "Retirer" — and nothing in the form body distinguishes the two on
 * its own, since both arrive with an empty file input, so the picker sends
 * `removeMedia` to say which happened.
 */
export type MediaChoice =
  | { kind: "keep" }
  | { kind: "clear" }
  | { kind: "set"; path: string; type: "image" | "video" }
  | { kind: "error"; error: ErrorCode };

/**
 * Read the attachment off a submission, uploading a photograph on the way.
 *
 * The video is looked at first. A submission carrying both did not come from
 * the picker, which offers one attachment and swaps it when you pick again; and
 * between the two, the video is the one that already cost an upload.
 */
export async function readMedia(
  supabase: Supabase,
  userId: string,
  formData: FormData,
): Promise<MediaChoice> {
  // Already in storage by the time this runs: the picker uploads a video before
  // the form is submitted. Only the path comes through here, and
  // `ownedVideoPath` says why that is the whole of what can be checked.
  const videoPath = String(formData.get("videoPath") ?? "").trim();
  if (videoPath) {
    if (!ownedVideoPath(videoPath, userId)) {
      console.error("[media] video path outside the uploader's folder:", userId);
      return { kind: "error", error: "uploadFailed" };
    }
    return { kind: "set", path: videoPath, type: "video" };
  }

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      return { kind: "error", error: "imageType" };
    }
    if (image.size > MAX_IMAGE_BYTES) return { kind: "error", error: "imageTooBig" };

    // The uid folder prefix is what the storage policy checks.
    const path = `${userId}/${crypto.randomUUID()}.webp`;

    let webp: Buffer;
    try {
      webp = await imageFileToWebp(image);
    } catch (conversionError) {
      console.error("[media] image conversion:", conversionError);
      return { kind: "error", error: "imageType" };
    }

    const { error } = await supabase.storage
      .from("issue-images")
      .upload(path, webp, { contentType: "image/webp" });

    if (error) {
      console.error("[media] photo upload:", error.message);
      return { kind: "error", error: "uploadFailed" };
    }
    return { kind: "set", path, type: "image" };
  }

  return String(formData.get("removeMedia") ?? "") === "1"
    ? { kind: "clear" }
    : { kind: "keep" };
}

/**
 * Take a replaced attachment out of storage.
 *
 * Awaited by its callers rather than deferred. A file the row no longer points
 * at is still a public URL somebody could hand around, so "the photo I put up
 * by mistake is gone" has to be true when the save returns, not eventually —
 * and a deletion left running past the response had no one left to report to
 * when it failed, which is how the first version of this quietly kept every
 * replaced file.
 *
 * The delete policies are migration 0043 for photographs and 0041 for video,
 * and both confine the caller to their own folder unless they hold office — so
 * a resident replacing their own picture removes their own picture, and nothing
 * else. A policy that refuses removes no rows and reports no error, so the
 * empty result is checked rather than the error alone.
 */
export async function discardMedia(
  supabase: Supabase,
  path: string | null,
  type: string | null,
) {
  // A path starting with `/` is a file shipped in `public/` by the demonstration
  // seed, not something in a bucket. See `publicUrl` in utils/supabase/issues.
  if (!path || path.startsWith("/")) return;
  const bucket = type === "video" ? "issue-videos" : "issue-images";
  const { data, error } = await supabase.storage.from(bucket).remove([path]);
  if (error || !data?.length) {
    console.error(
      "[media] a replaced file stayed in storage:",
      bucket,
      path,
      error?.message ?? "the delete policy matched no row",
    );
  }
}

/**
 * Attach a file to a topic that has just been written.
 *
 * `media_type` arrives with migration 0041 and the queries that read it already
 * fall back when it is absent, so this does the same: on a database that has
 * not caught up, naming the column would fail the update and lose the
 * attachment rather than merely lose the distinction between a photograph and
 * a video — and everything before 0041 was a photograph anyway.
 */
export async function attachMedia(
  supabase: Supabase,
  issueId: string,
  path: string,
  type: "image" | "video",
) {
  const save = (withMediaType: boolean) =>
    supabase
      .from("issues")
      .update({ image_path: path, ...(withMediaType ? { media_type: type } : {}) })
      .eq("id", issueId);

  let { error } = await save(true);
  if (error?.message.includes("media_type")) ({ error } = await save(false));
  if (error) console.error("[media] could not attach the file to the topic:", error.message);
  return !error;
}
