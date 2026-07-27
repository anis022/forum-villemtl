"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment, type ActionState } from "@/app/actions/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, FIELD, LABEL, MUTED } from "@/components/ui/styles";

const initial: ActionState = { error: null };

export function CommentForm({
  issueId,
  isOfficial,
  lang,
}: {
  issueId: string;
  isOfficial: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const formRef = useRef<HTMLFormElement>(null);
  const action = addComment.bind(null, issueId);
  const [state, formAction, pending] = useActionState(action, initial);

  // React already resets the form after a successful action; the ref is only
  // needed to clear a stale echoed value once a retry succeeds.
  useEffect(() => {
    if (!pending && !state.error && !state.values) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} noValidate>
      <input type="hidden" name="locale" value={lang} />

      <label htmlFor="comment-body" className={LABEL}>
        {isOfficial ? t.issue.replyAsOfficial : t.issue.addComment}
      </label>

      {isOfficial && <p className={`mb-2 text-[14px] ${MUTED}`}>{t.issue.officialHint}</p>}

      <textarea
        id="comment-body"
        name="body"
        rows={4}
        maxLength={5000}
        disabled={pending}
        defaultValue={state.values?.body ?? ""}
        placeholder={t.issue.commentPlaceholder}
        className={`${FIELD} resize-y`}
      />

      {state.error && (
        <p role="alert" className={`mt-3 ${ALERT}`}>
          {t.errors[state.error]}
        </p>
      )}

      <button type="submit" disabled={pending} className={`mt-3 ${BTN_PRIMARY}`}>
        {pending ? t.issue.sending : t.issue.send}
      </button>
    </form>
  );
}
