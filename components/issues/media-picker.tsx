"use client";

import { useEffect, useRef, useState } from "react";
import { getDictionary, type ErrorCode, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";
import { discardVideo, isVideo, uploadVideo, type UploadHandle } from "@/utils/upload-video";

/** What the post already carries, when this picker is editing one. */
export type ExistingMedia = { url: string; kind: "image" | "video" } | null;

/**
 * The one attachment a post carries, and the way to change it.
 *
 * Shared by the composer and by the editor, because the two have to behave
 * identically and the video half of this is not something to write twice: a
 * photograph rides along in the form and is re-encoded server-side, while a
 * video goes to storage from here and only its path is submitted.
 *
 * Three fields leave with the form. `image` is the file input, `videoPath` is
 * where a video landed, and `removeMedia` says "there was one and I dropped
 * it" — which the action cannot infer from the other two, since an edit that
 * touches only the title also arrives with both of them empty.
 */
export function MediaPicker({
  lang,
  disabled,
  existing,
  onBusy,
  onError,
}: {
  lang: Locale;
  disabled: boolean;
  existing?: ExistingMedia;
  /** True while a video is on its way to storage: the form must not submit. */
  onBusy: (busy: boolean) => void;
  onError: (error: ErrorCode | null) => void;
}) {
  const t = getDictionary(lang);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  /** Which of the two the preview is showing, so it knows what to render. */
  const [kind, setKind] = useState<"image" | "video" | null>(null);
  /** Where the video landed. The only thing about it the action ever sees. */
  const [videoPath, setVideoPath] = useState<string | null>(null);
  /** 0-100 while bytes are moving, null when nothing is in flight. */
  const [percent, setPercent] = useState<number | null>(null);
  /** The existing attachment was dropped and nothing was put in its place. */
  const [removed, setRemoved] = useState(false);
  const upload = useRef<UploadHandle | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  /**
   * The chosen photograph, held here because the input cannot hold it.
   *
   * React empties every uncontrolled field once a form action resolves, and a
   * file input is one of them. A submission the action refuses — a title five
   * characters short, a pin nobody dropped — therefore took the photo off the
   * form while the preview and the file name stayed on screen saying it was
   * still attached, and the next submit published the report without it and
   * said nothing. That is the bug this reference and the effect below close.
   */
  const photo = useRef<File | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // No dependency array: this has to run after every render, because the render
  // that empties the input is the one nothing here can see coming.
  useEffect(() => {
    const element = input.current;
    if (!element || !photo.current || element.files?.length) return;
    const carrier = new DataTransfer();
    carrier.items.add(photo.current);
    element.files = carrier.files;
  });

  const clearAttachment = () => {
    upload.current?.cancel();
    upload.current = null;
    if (videoPath) discardVideo(videoPath);
    photo.current = null;
    if (input.current) input.current.value = "";
    setVideoPath(null);
    setPercent(null);
    setKind(null);
    setFileName(null);
    setPreview(null);
    onBusy(false);
    onError(null);
  };

  /**
   * A photograph rides along in the form and is converted server-side. A video
   * is far too large for that, so it goes to storage on its own and only the
   * path it was given is submitted — leaving fifty megabytes on the input would
   * put them into the form body, which is the exact limit this path exists to
   * stay under.
   */
  const onPick = async (element: HTMLInputElement) => {
    const file = element.files?.[0];
    clearAttachment();
    if (!file) return;

    setFileName(file.name);
    setPreview(URL.createObjectURL(file));

    if (!isVideo(file)) {
      setKind("image");
      photo.current = file;
      return;
    }

    setKind("video");
    setPercent(0);
    onBusy(true);

    const handle = uploadVideo(file, setPercent);
    upload.current = handle;
    const result = await handle.promise;
    upload.current = null;
    setPercent(null);
    onBusy(false);

    if ("error" in result) {
      onError(result.error);
      setKind(null);
      setFileName(null);
      setPreview(null);
      return;
    }
    setVideoPath(result.path);
  };

  const picked = kind !== null;
  const showsExisting = Boolean(existing) && !picked && !removed;

  return (
    <div>
      <label htmlFor="issue-image" className="mb-2 block text-[15px] font-bold text-[#1a1a1a]">
        {t.issue.fieldPhoto} <span className="font-normal">{t.issue.fieldPhotoOptional}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <input
          id="issue-image"
          name="image"
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          disabled={disabled || percent !== null}
          onChange={(event) => void onPick(event.target)}
          className="peer sr-only"
        />
        <label
          htmlFor="issue-image"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#e9e0d6] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#a3162c] transition-all hover:border-[#a3162c] hover:bg-[#f6e7ea] peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#2a2a86] peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5V20h14v-5.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {showsExisting ? t.issue.mediaReplace : t.issue.fieldPhotoChoose}
        </label>

        {fileName && (
          <span className={`max-w-full break-all text-[13px] ${MUTED}`}>{fileName}</span>
        )}

        {(picked || showsExisting) && percent === null && (
          <button
            type="button"
            onClick={() => {
              clearAttachment();
              setRemoved(true);
            }}
            disabled={disabled}
            className="rounded-[8px] text-[13px] font-bold text-[#a3162c] hover:underline disabled:opacity-60"
          >
            {t.issue.mediaRemove}
          </button>
        )}
      </div>

      {/* Fifty megabytes over a phone connection is long enough that silence
          reads as a hang, and the one thing somebody does when a form looks
          stuck is press the button again. */}
      {percent !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className={MUTED}>{t.issue.mediaUploading}</span>
            <span className={MUTED}>{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.issue.mediaUploading}
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f2ece4]"
          >
            <div
              className="h-full bg-[#a3162c] transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* The upload finished while the rest of the form is still being written,
          so the state has to be visible or it reads as unsaved. */}
      {videoPath && percent === null && (
        <p className="mt-2 text-[13px] font-bold text-[#1f7a4d]">{t.issue.mediaUploaded}</p>
      )}

      {/* The two hidden fields are the whole of what the action receives about
          anything that is not a photograph: see `readMedia` in the action. */}
      <input type="hidden" name="videoPath" value={videoPath ?? ""} readOnly />
      <input
        type="hidden"
        name="removeMedia"
        value={removed && !picked ? "1" : ""}
        readOnly
      />

      <p className={`mt-1 text-[14px] ${MUTED}`}>{t.issue.fieldPhotoHint}</p>

      {showsExisting && existing?.kind === "image" && (
        /* eslint-disable-next-line @next/next/no-img-element -- storage asset, not a route the optimizer serves here */
        <img
          src={existing.url}
          alt={t.issue.photoAlt}
          className="mt-3 max-h-64 rounded-[14px] border border-[#e9e0d6]"
        />
      )}

      {showsExisting && existing?.kind === "video" && (
        <video
          src={existing.url}
          controls
          playsInline
          preload="metadata"
          className="mt-3 max-h-64 w-full rounded-[14px] border border-[#e9e0d6] bg-[#1c1714]"
        />
      )}

      {preview && kind === "image" && (
        /* eslint-disable-next-line @next/next/no-img-element -- blob: preview, not a remote asset */
        <img
          src={preview}
          alt={t.issue.photoPreviewAlt}
          className="mt-3 max-h-64 rounded-[14px] border border-[#e9e0d6]"
        />
      )}

      {/* Played from the local file rather than from storage: it is already on
          this device, and the upload may still be in flight behind it. */}
      {preview && kind === "video" && (
        <video
          src={preview}
          controls
          playsInline
          preload="metadata"
          className="mt-3 max-h-64 w-full rounded-[14px] border border-[#e9e0d6] bg-[#1c1714]"
        />
      )}
    </div>
  );
}
