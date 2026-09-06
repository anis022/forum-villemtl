"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
import { MediaPicker } from "./media-picker";
import { resilient } from "@/utils/resilient-action";
import type { ErrorCode } from "@/utils/i18n";

const initial: ActionState = { error: null };

export function NewIssueForm({ lang }: { lang: Locale; isAdmin?: boolean }) {
  const t = getDictionary(lang);
  const [state, formAction, pending] = useActionState(resilient(createIssue), initial);
  /** True while a video is on its way to storage. Publishing then would file
      the report without the file that is still travelling. */
  const [mediaBusy, setMediaBusy] = useState(false);
  const [uploadError, setUploadError] = useState<ErrorCode | null>(null);
  const [titleLength, setTitleLength] = useState(0);
  const [bodyLength, setBodyLength] = useState(0);

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
        <MediaPicker
          lang={lang}
          disabled={pending}
          onBusy={setMediaBusy}
          onError={setUploadError}
        />
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
        disabled={pending || mediaBusy}
        className={BTN_PRIMARY}
        title={mediaBusy ? t.issue.mediaWait : undefined}
      >
        {pending ? t.issue.publishing : t.issue.publish}
      </button>
    </form>
  );
}
