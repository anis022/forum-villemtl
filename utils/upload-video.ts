import { createClient } from "@/utils/supabase/client";
import type { ErrorCode } from "@/utils/i18n";

/**
 * Put a video in storage from the browser, and say how far along it is.
 *
 * Everything else a report carries goes through `createIssue`, which re-checks
 * the session and re-encodes a photograph on the way past. A video cannot: a
 * server action caps its request body well below fifty megabytes, and pushing a
 * phone recording through a function only to hand it straight to storage would
 * be slow and no safer at the end of it. So this uploads first and the composer
 * submits the path.
 *
 * The storage policies in migration 0041 are therefore the only thing between
 * this request and the bucket. They confine a writer to a folder named after
 * their own uid and require a current membership, and both are checked by the
 * database against a signed token rather than by anything here.
 */

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

/**
 * `video/quicktime` is the .mov an iPhone produces. It is accepted because
 * turning somebody away at the picker over a container is worse than showing
 * them a message if the codec inside it turns out to be one their neighbour's
 * browser cannot decode. See `IssueVideo` for that end of it.
 */
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const isVideo = (file: File) =>
  file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);

/**
 * How long the file runs, read from the browser's own decoder.
 *
 * Null when it cannot say, which happens for a container it will not open. That
 * is not treated as a refusal: the size cap still applies, and refusing a file
 * because we could not measure it would turn "your browser cannot preview this"
 * into "you may not post this".
 */
export function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      probe.removeAttribute("src");
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

export type UploadHandle = {
  promise: Promise<{ path: string } | { error: ErrorCode }>;
  cancel: () => void;
};

/**
 * Uploads with progress, which `supabase.storage.upload` cannot report.
 *
 * The request is the one `@supabase/storage-js` would have made -- multipart
 * with `cacheControl` and the file under an empty field name, posted to
 * `/storage/v1/object/{bucket}/{path}` -- sent over XMLHttpRequest instead of
 * fetch, because XHR is still the only thing in a browser that will tell you
 * how many bytes have actually left. On a fifty-megabyte upload over cellular
 * that is the difference between a progress bar and a page that looks frozen.
 */
export function uploadVideo(
  file: File,
  onProgress: (percent: number) => void,
): UploadHandle {
  const request = new XMLHttpRequest();

  const promise = (async (): Promise<{ path: string } | { error: ErrorCode }> => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return { error: "videoType" };
    if (file.size > MAX_VIDEO_BYTES) return { error: "videoTooBig" };

    const seconds = await videoDuration(file);
    if (seconds !== null && seconds > MAX_VIDEO_SECONDS + 0.5) {
      return { error: "videoTooLong" };
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { error: "notSignedIn" };

    // Taken from the session rather than passed in. This is the id the storage
    // policy will compare the folder against, read from the same token it will
    // read, so the two cannot disagree.
    const userId = session.user.id;

    // The extension is taken from the type rather than the name: the name is
    // whatever the phone called it and the policy only ever reads the folder.
    const extension =
      file.type === "video/mp4" ? "mp4" : file.type === "video/webm" ? "webm" : "mov";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);

    return new Promise((resolve) => {
      request.open(
        "POST",
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/issue-videos/${path}`,
      );
      request.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      request.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      request.setRequestHeader("x-upsert", "false");

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          onProgress(100);
          resolve({ path });
        } else {
          console.error("[upload] storage refused", request.status, request.responseText);
          resolve({ error: "uploadFailed" });
        }
      };
      request.onerror = () => resolve({ error: "networkFailed" });
      request.onabort = () => resolve({ error: "uploadFailed" });
      request.send(body);
    });
  })();

  return { promise, cancel: () => request.abort() };
}

/**
 * Remove a video that was uploaded and then dropped.
 *
 * Best effort, and deliberately not awaited by anything that matters. Somebody
 * who picks a second video should not be made to wait on the deletion of the
 * first, and a file left behind costs storage rather than correctness.
 */
export async function discardVideo(path: string) {
  try {
    await createClient().storage.from("issue-videos").remove([path]);
  } catch (error) {
    console.error("[upload] could not remove an abandoned video:", error);
  }
}
