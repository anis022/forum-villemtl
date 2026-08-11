"use client";

import { useActionState, useState } from "react";
import { createIssue, type ActionState } from "@/app/actions/issues";
import { CATEGORY_KEYS } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, CARD, FIELD, LABEL, LINK, MUTED } from "@/components/ui/styles";
import { LocationPicker } from "./location-picker";

const initial: ActionState = { error: null };

export function NewIssueForm({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  const [state, formAction, pending] = useActionState(createIssue, initial);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={formAction} noValidate className={`${CARD} p-6`}>
      {/* Lets the action localize its redirect and revalidation paths. */}
      <input type="hidden" name="locale" value={lang} />

      <div className="mb-5">
        <label htmlFor="issue-title" className={LABEL}>
          {t.issue.fieldTitle}
        </label>
        <input
          id="issue-title"
          name="title"
          type="text"
          maxLength={150}
          disabled={pending}
          defaultValue={state.values?.title ?? ""}
          placeholder={t.issue.fieldTitlePlaceholder}
          className={FIELD}
        />
        <p className={`mt-1 text-[14px] ${MUTED}`}>{t.issue.fieldTitleHint}</p>
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
        <textarea
          id="issue-body"
          name="body"
          rows={7}
          maxLength={5000}
          disabled={pending}
          defaultValue={state.values?.body ?? ""}
          placeholder={t.issue.fieldBodyPlaceholder}
          className={`${FIELD} resize-y`}
        />
        <p className={`mt-1 text-[14px] ${MUTED}`}>{t.issue.fieldBodyHint}</p>
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
        <input
          id="issue-image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="block w-full text-[15px] file:mr-4 file:rounded-[10px] file:border file:border-[#e9e0d6] file:bg-white file:px-4 file:py-2 file:text-[15px] file:font-bold file:text-[#fa3250] hover:file:bg-[#faf1e8]"
        />
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
