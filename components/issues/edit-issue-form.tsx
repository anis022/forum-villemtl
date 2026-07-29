"use client";

import Link from "next/link";
import { useActionState } from "react";
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
