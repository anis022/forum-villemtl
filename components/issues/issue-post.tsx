"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Translated } from "@/components/translate";
import { updateIssue } from "@/app/actions/issues";
import type { ActionState } from "@/app/actions/issues";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import type { Ballot } from "@/utils/polls";
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
  isOfficialView,
  lang,
  ballot,
  editing,
  children,
}: {
  issueId: string;
  title: string;
  body: string;
  category: Category;
  canEdit: boolean;
  /** True when the office panel is showing, which is where the control goes. */
  isOfficialView: boolean;
  lang: Locale;
  /**
   * The ballot, when this topic has one, so that its choices are edited by the
   * same button and saved by the same submission. Two buttons meant two saves
   * and no way to express "rename that choice and fix the title" as one act.
   */
  ballot?: Ballot | null;
  /**
   * Whether the form is open, decided by `?edit=1` rather than by state here.
   *
   * The control that opens it sits in the office panel, three blocks down the
   * page and inside another component; a boolean in this one could not be
   * reached from there without lifting the whole editing concern into a wrapper
   * that exists only to hold it. A URL is the state both of them already share.
   */
  editing: boolean;
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
  const pathname = usePathname();
  const close = () => router.push(pathname);
  const [choices, setChoices] = useState(() =>
    (ballot?.options ?? []).map((option) => ({ ...option })),
  );
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, data) => {
      const result = await updateIssue(issueId, previous, data);
      if (!result.error) {
        close();
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

        {/* Justified, with hyphenation on. The two go together: justifying
            without it stretches the word spaces to cover whatever the line is
            short by, and French runs long enough ("stationnement",
            "arrondissement") that the gaps turn into rivers down the column.
            `hyphens-auto` reads the `lang` on <html>, which the layout sets
            per locale, so each language breaks by its own rules. */}
        <p className="mt-3 max-w-[68ch] hyphens-auto whitespace-pre-wrap break-words text-justify text-[17px] leading-[27px]">
          <Translated field="body">{body}</Translated>
        </p>

        {children}

        {/* An author who is not on the staff has no office panel to keep this
            in, so for them it stays with the words it edits. */}
        {canEdit && !isOfficialView && (
          <Link href="?edit=1" className={`mt-4 ${BTN_SECONDARY}`}>
            {t.issue.editPost}
          </Link>
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

      {ballot && ballot.kind === "choice" && (
        <div>
          <p className={LABEL}>{t.poll.choicesTitle}</p>
          <input type="hidden" name="pollId" value={ballot.id} />
          <div className="flex flex-col gap-2">
            {choices.map((choice, i) => (
              <div key={choice.id || `new-${i}`} className="flex items-center gap-2">
                <input type="hidden" name="optionId" value={choice.id} />
                <input
                  name="options"
                  className={FIELD}
                  value={choice.label}
                  disabled={pending}
                  aria-label={`${t.poll.choiceLabel} ${i + 1}`}
                  placeholder={t.poll.choicePlaceholder}
                  onChange={(event) =>
                    setChoices(
                      choices.map((c, k) =>
                        k === i ? { ...c, label: event.target.value } : c,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setChoices(choices.filter((_, k) => k !== i))}
                  disabled={choices.length <= 2 || pending}
                  aria-label={t.poll.removeChoice}
                  title={
                    choice.voteCount > 0
                      ? t.poll.removeKeepsNoVotes(choice.voteCount)
                      : t.poll.removeChoice
                  }
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#a9a3aa] transition-colors hover:bg-[#f6e7ea] hover:text-[#a3162c] disabled:opacity-40"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {choices.length < 10 && (
            <button
              type="button"
              className={`${BTN_SECONDARY} mt-2`}
              onClick={() => setChoices([...choices, { id: "", label: "", voteCount: 0 }])}
            >
              {t.poll.addChoice}
            </button>
          )}
          <p className={`mt-2 text-[13px] leading-[19px] ${MUTED}`}>{t.poll.editWarning}</p>
        </div>
      )}

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
          onClick={close}
          disabled={pending}
        >
          {t.issue.cancelEdit}
        </button>
      </div>

      <p className={`text-[13px] leading-[19px] ${MUTED}`}>{t.issue.editNote}</p>
    </form>
  );
}
