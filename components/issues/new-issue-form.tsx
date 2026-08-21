"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
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

const initial: ActionState = { error: null };

export function NewIssueForm({ lang }: { lang: Locale; isAdmin?: boolean }) {
  const t = getDictionary(lang);
  const [state, formAction, pending] = useActionState(createIssue, initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [titleLength, setTitleLength] = useState(0);
  const [bodyLength, setBodyLength] = useState(0);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

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
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name ?? null);
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor="issue-image"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#e9e0d6] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#fa3250] transition-all hover:border-[#fa3250] hover:bg-[#fde8eb] peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#2a2a86] peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
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
        </div>
        <p className={`mt-1 text-[14px] ${MUTED}`}>{t.issue.fieldPhotoHint}</p>

        {preview && (
          /* eslint-disable-next-line @next/next/no-img-element -- blob: preview, not a remote asset */
          <img
            src={preview}
            alt={t.issue.photoPreviewAlt}
            className="mt-3 max-h-64 rounded-[14px] border border-[#e9e0d6]"
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

      {state.error && (
        <p role="alert" className={`mb-5 ${ALERT}`}>
          {t.errors[state.error]}
        </p>
      )}

      <button type="submit" disabled={pending} className={BTN_PRIMARY}>
        {pending ? t.issue.publishing : t.issue.publish}
      </button>
    </form>
  );
}
