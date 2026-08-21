"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Translated } from "@/components/translate";
import { updateIssue } from "@/app/actions/issues";
import type { ActionState } from "@/app/actions/issues";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, BTN_SECONDARY, FIELD, LABEL, MUTED } from "@/components/ui/styles";

const initial: ActionState = { error: null };

/**
 * A topic's own words, and the way to correct them.
 *
 * Until now there was none: the policies have allowed an author to update their
 * row since migration 0011, but nothing on screen ever offered it, so a typo in
 * a title was permanent unless the whole topic was deleted — taking every reply
 * with it.
 *
 * Reading and editing are the same block rather than a page of their own. The
 * heading stays a heading, the body stays a paragraph, and pressing the control
 * swaps them for fields of the same size in the same place, so nothing moves
 * and it is obvious what is being changed.
 */
export function IssuePost({
  issueId,
  title,
  body,
  category,
  canEdit,
  lang,
  children,
}: {
  issueId: string;
  title: string;
  body: string;
  category: Category;
  canEdit: boolean;
  lang: Locale;
  /**
   * The ballot, when this topic carries one.
   *
   * Taken as children rather than rendered by the page after this block, so
   * that the control that edits the topic comes *after* everything the topic
   * says. Between the body and its own ballot it read as a caption on the
   * paragraph above it.
   */
  children?: React.ReactNode;
}) {
  const t = getDictionary(lang);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, data) => {
      const result = await updateIssue(issueId, previous, data);
      if (!result.error) {
        setEditing(false);
        router.refresh();
      }
      return result;
    },
    initial,
  );

  if (!editing) {
    return (
      <>
        <h1 className="mt-4 text-[24px] leading-[32px] break-words md:text-[30px] md:leading-[38px]">
          <Translated field="title">{title}</Translated>
        </h1>

        <p className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words text-[17px] leading-[27px]">
          <Translated field="body">{body}</Translated>
        </p>

        {children}

        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`mt-4 ${BTN_SECONDARY}`}
          >
            {t.issue.editPost}
          </button>
        )}
      </>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="locale" value={lang} />

      <div>
        <label htmlFor="edit-title" className={LABEL}>
          {t.issue.fieldTitle}
        </label>
        <input
          id="edit-title"
          name="title"
          defaultValue={state.values?.title ?? title}
          minLength={5}
          maxLength={150}
          required
          disabled={pending}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="edit-body" className={LABEL}>
          {t.issue.fieldBody}
        </label>
        <textarea
          id="edit-body"
          name="body"
          rows={7}
          defaultValue={state.values?.body ?? body}
          minLength={20}
          maxLength={5000}
          required
          disabled={pending}
          className={`${FIELD} resize-y`}
        />
      </div>

      <div>
        <label htmlFor="edit-category" className={LABEL}>
          {t.issue.fieldCategory}
        </label>
        <select
          id="edit-category"
          name="category"
          defaultValue={state.values?.category ?? category}
          disabled={pending}
          className={FIELD}
        >
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {t.categories[key]}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className={ALERT}>
          {t.errors[state.error]}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={pending}>
          {pending ? t.issue.savingEdit : t.issue.saveEdit}
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          {t.issue.cancelEdit}
        </button>
      </div>

      <p className={`text-[13px] leading-[19px] ${MUTED}`}>{t.issue.editNote}</p>
    </form>
  );
}
