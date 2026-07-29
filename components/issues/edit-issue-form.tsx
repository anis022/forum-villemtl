"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateIssue, type ActionState } from "@/app/actions/issues";
import { CATEGORY_KEYS, type Issue } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED } from "@/components/ui/styles";

const initial: ActionState = { error: null };

/**
 * Correcting the words of a report.
 *
 * Deliberately narrower than the reporting form: title, category and
 * description only. The location and the photo are what the report *is* — a
 * changed pin or a swapped photo would make it a different report, and on a
 * public forum that should be a new one rather than a quiet rewrite.
 */
export function EditIssueForm({
  issue,
  lang,
  actingAsOfficial,
}: {
  issue: Issue;
  lang: Locale;
  actingAsOfficial: boolean;
}) {
  const t = getDictionary(lang);
  const action = updateIssue.bind(null, issue.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  return (
    <form action={formAction} noValidate className={`${CARD} p-6`}>
      <input type="hidden" name="locale" value={lang} />

      {actingAsOfficial && (
        <p className="mb-5 rounded-[12px] border border-[#f0dcb8] bg-[#fdf6e3] px-4 py-3 text-[14px] leading-[20px]">
          {t.issue.editOfficialWarning}
        </p>
      )}

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
          defaultValue={state.values?.title ?? issue.title}
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
          defaultValue={state.values?.category ?? issue.category}
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
          rows={8}
          maxLength={5000}
          disabled={pending}
          defaultValue={state.values?.body ?? issue.body}
          className={`${FIELD} resize-y`}
        />
        <p className={`mt-1 text-[14px] ${MUTED}`}>{t.issue.fieldBodyHint}</p>
      </div>

      <div className="mb-5">
        <label htmlFor="issue-image" className={LABEL}>
          {t.issue.fieldPhoto} <span className="font-normal">{t.issue.fieldPhotoOptional}</span>
        </label>

        {/* The current photo stays visible while choosing a new one, so the
            swap is a comparison rather than a leap of faith. */}
        {issue.imageUrl && !removed && !preview && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage URL, already public */}
            <img
              src={issue.imageUrl}
              alt={t.issue.photoAlt}
              className="max-h-64 rounded-[14px] border border-[#dde5e1]"
            />
            <button
              type="button"
              onClick={() => setRemoved(true)}
              disabled={pending}
              className="mt-2 text-[13px] font-bold text-[#5d6b66] underline hover:text-[#c0392f]"
            >
              {t.issue.removePhoto}
            </button>
          </div>
        )}

        {removed && !preview && (
          <p className="mb-3 flex flex-wrap items-center gap-3 text-[14px] text-[#5d6b66]">
            {t.issue.photoWillBeRemoved}
            <button
              type="button"
              onClick={() => setRemoved(false)}
              className="text-[13px] font-bold text-[#097d6c] underline"
            >
              {t.issue.undo}
            </button>
          </p>
        )}

        <input type="hidden" name="removeImage" value={removed ? "1" : "0"} />

        <input
          id="issue-image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
            if (file) setRemoved(false);
          }}
          className="block w-full text-[15px] file:mr-4 file:rounded-full file:border file:border-[#dde5e1] file:bg-white file:px-4 file:py-2 file:text-[15px] file:font-bold file:text-[#097d6c] hover:file:bg-[#e2f0ec]"
        />
        <p className={`mt-1 text-[14px] ${MUTED}`}>
          {issue.imageUrl ? t.issue.replacePhotoHint : t.issue.fieldPhotoHint}
        </p>

        {preview && (
          /* eslint-disable-next-line @next/next/no-img-element -- blob: preview, not a remote asset */
          <img
            src={preview}
            alt={t.issue.photoPreviewAlt}
            className="mt-3 max-h-64 rounded-[14px] border border-[#dde5e1]"
          />
        )}
      </div>

      <p className={`mb-5 text-[14px] ${MUTED}`}>{t.issue.editLocationNote}</p>

      {state.error && (
        <p role="alert" className={`mb-5 ${ALERT}`}>
          {t.errors[state.error]}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          {pending ? t.issue.saving : t.issue.save}
        </button>
        <Link
          href={`/${lang}/sujets/${issue.id}`}
          className="text-[15px] font-bold text-[#5d6b66] underline hover:text-[#16241f]"
        >
          {t.issue.cancelEdit}
        </Link>
      </div>
    </form>
  );
}
