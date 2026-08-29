"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createIssue, type ActionState } from "@/app/actions/issues";
import { CATEGORY_KEYS } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import {
  ALERT,
  BTN_SECONDARY,
  BTN_PRIMARY,
  CARD,
  FIELD,
  LABEL,
  LINK,
  MUTED,
} from "@/components/ui/styles";
import { CharacterCounter } from "@/components/ui/character-counter";
import { LocationPicker } from "./location-picker";
import { resilient } from "@/utils/resilient-action";
import { discardVideo, isVideo, uploadVideo, type UploadHandle } from "@/utils/upload-video";
import type { ErrorCode } from "@/utils/i18n";

const initial: ActionState = { error: null };

export function NewIssueForm({ lang }: { lang: Locale; isAdmin?: boolean }) {
  const t = getDictionary(lang);
  const [state, formAction, pending] = useActionState(resilient(createIssue), initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  /** Which of the two the preview is showing, so it knows what to render. */
  const [kind, setKind] = useState<"image" | "video" | null>(null);
  /** Where the video landed. The only thing about it the action ever sees. */
  const [videoPath, setVideoPath] = useState<string | null>(null);
  /** 0-100 while bytes are moving, null when nothing is in flight. */
  const [percent, setPercent] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<ErrorCode | null>(null);
  const upload = useRef<UploadHandle | null>(null);
  const [titleLength, setTitleLength] = useState(0);
  const [bodyLength, setBodyLength] = useState(0);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // Nothing restores `videoPath` after a refused submission because nothing has
  // to: `useActionState` re-renders this component rather than remounting it,
  // so an upload that already succeeded is still in state when the error comes
  // back. Somebody who mistyped a title retypes the title, not the video.

  const clearAttachment = () => {
    upload.current?.cancel();
    upload.current = null;
    if (videoPath) discardVideo(videoPath);
    setVideoPath(null);
    setPercent(null);
    setKind(null);
    setFileName(null);
    setPreview(null);
    setUploadError(null);
  };

  /**
   * A photograph rides along in the form and is converted server-side. A video
   * is far too large for that, so it goes to storage on its own and only the
   * path it was given is submitted.
   *
   * The input is emptied once a video has been taken off it. Leaving the file
   * on the input would put fifty megabytes into the form body, which is the
   * exact limit this whole path exists to stay under.
   */
  const onPick = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    clearAttachment();
    if (!file) return;

    setFileName(file.name);
    setPreview(URL.createObjectURL(file));

    if (!isVideo(file)) {
      setKind("image");
      return;
    }

    setKind("video");
    input.value = "";
    setPercent(0);

    const handle = uploadVideo(file, setPercent);
    upload.current = handle;
    const result = await handle.promise;
    upload.current = null;
    setPercent(null);

    if ("error" in result) {
      setUploadError(result.error);
      setKind(null);
      setFileName(null);
      setPreview(null);
      return;
    }
    setVideoPath(result.path);
  };

  return (
    <form action={formAction} noValidate className={`${CARD} p-6`}>
      {/* Lets the action localize its redirect and revalidation paths. */}
      <input type="hidden" name="locale" value={lang} />

      {/* A ballot is a topic with choices under it, so the way in sits on the
          form that writes a topic rather than on a page of its own. Butter and
          indigo, which the site already uses for "here is something you can
          also do" — the aubergine this replaced was a colour invented for
          polls and used nowhere else, which is what made the feature look
          bolted on. */}
      <section className="mb-6 grid gap-4 rounded-[14px] border border-[#f2eadf] bg-[#fffbe5] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div>
          <h2 className="text-[17px] font-bold leading-[24px] text-[#2a2a86]">
            {t.poll.ctaTitle}
          </h2>
          <p className={`mt-1 max-w-[58ch] text-[14px] leading-[21px] ${MUTED}`}>
            {t.poll.ctaBody}
          </p>
        </div>
        <Link href={`/${lang}/sujets/sondage`} className={`${BTN_SECONDARY} shrink-0`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 6h14M5 12h9M5 18h6M17 15v6m-3-3h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          {t.poll.ctaButton}
        </Link>
      </section>

      <div className="mb-5">
        <label htmlFor="issue-title" className={LABEL}>
          {t.issue.fieldTitle}
        </label>
        <div className="relative">
          <input
            id="issue-title"
            name="title"
            type="text"
            minLength={5}
            maxLength={150}
            disabled={pending}
            defaultValue={state.values?.title ?? ""}
            onChange={(event) => setTitleLength(event.currentTarget.value.length)}
            aria-describedby="issue-title-length-hint"
            placeholder={t.issue.fieldTitlePlaceholder}
            className={`${FIELD} pr-20`}
          />
          <CharacterCounter count={titleLength} max={150} />
        </div>
        <span id="issue-title-length-hint" className="sr-only">
          {t.issue.fieldTitleHint}
        </span>
      </div>

      <div className="mb-5">
        <label htmlFor="issue-category" className={LABEL}>
          {t.issue.fieldCategory}
        </label>
        <select
          id="issue-category"
          name="category"
          disabled={pending}
          defaultValue={state.values?.category ?? "general"}
          className={FIELD}
        >
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {t.categories[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label htmlFor="issue-body" className={LABEL}>
          {t.issue.fieldBody}
        </label>
        <div className="relative">
          <textarea
            id="issue-body"
            name="body"
            rows={7}
            minLength={20}
            maxLength={5000}
            disabled={pending}
            defaultValue={state.values?.body ?? ""}
            onChange={(event) => setBodyLength(event.currentTarget.value.length)}
            aria-describedby="issue-body-length-hint"
            placeholder={t.issue.fieldBodyPlaceholder}
            className={`${FIELD} resize-y pr-20 pb-9`}
          />
          <CharacterCounter count={bodyLength} max={5000} />
        </div>
        <span id="issue-body-length-hint" className="sr-only">
          {t.issue.fieldBodyHint}
        </span>
      </div>

      <div className="mb-5">
        <span className={LABEL}>{t.issue.fieldLocation}</span>
        <LocationPicker
          disabled={pending}
          defaultLat={state.values?.lat}
          defaultLon={state.values?.lon}
          labels={{
            hint: t.issue.locationHint,
            chosen: t.issue.locationChosen,
            locate: t.issue.locationUseMine,
            locating: t.issue.locationLocating,
            outside: t.issue.locationOutside,
            denied: t.issue.locationDenied,
            clear: t.issue.locationClear,
          }}
        />
      </div>

      <div className="mb-5">
        <label htmlFor="issue-image" className={LABEL}>
          {t.issue.fieldPhoto}{" "}
          <span className="font-normal">{t.issue.fieldPhotoOptional}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="issue-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            disabled={pending || percent !== null}
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
            {t.issue.fieldPhotoChoose}
          </label>
          {fileName && (
            <span className={`max-w-full break-all text-[13px] ${MUTED}`}>{fileName}</span>
          )}
          {fileName && percent === null && (
            <button
              type="button"
              onClick={clearAttachment}
              disabled={pending}
              className="text-[13px] font-bold text-[#a3162c] hover:underline disabled:opacity-60"
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

        {/* The upload finished while the rest of the form is still being
            written, so the state has to be visible or it reads as unsaved. */}
        {videoPath && percent === null && (
          <p className="mt-2 text-[13px] font-bold text-[#1f7a4d]">{t.issue.mediaUploaded}</p>
        )}

        {/* The hidden field is the whole of what the action receives about a
            video: see `ownedVideoPath` for what it can and cannot conclude. */}
        <input type="hidden" name="videoPath" value={videoPath ?? ""} readOnly />
        <p className={`mt-1 text-[14px] ${MUTED}`}>{t.issue.fieldPhotoHint}</p>

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

      {/* Last thing before the error slot and the publish button. A report
          carries more than words — a photograph and a pin precise enough to be
          a home address — and this is the only place a resident is looking at
          all three at once. */}
      <p className={`mb-5 text-[14px] leading-[21px] ${MUTED}`}>
        {t.issue.collectionNotice}{" "}
        <a href={`/${lang}/confidentialite`} className={LINK}>
          {t.privacy.title}
        </a>
      </p>

      {(uploadError ?? state.error) && (
        <p role="alert" className={`mb-5 ${ALERT}`}>
          {t.errors[(uploadError ?? state.error)!]}
        </p>
      )}

      {/* Publishing mid-upload would file the report without the video that is
          still on its way to storage, and nothing afterwards would attach it. */}
      <button
        type="submit"
        disabled={pending || percent !== null}
        className={BTN_PRIMARY}
        title={percent !== null ? t.issue.mediaWait : undefined}
      >
        {pending ? t.issue.publishing : t.issue.publish}
      </button>
    </form>
  );
}
