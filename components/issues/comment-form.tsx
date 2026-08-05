"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment, type ActionState } from "@/app/actions/issues";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_GHOST, BTN_PRIMARY, FIELD, LABEL, MUTED } from "@/components/ui/styles";

const initial: ActionState = { error: null };

export function CommentForm({
  issueId,
  parentId = null,
  isOfficial,
  lang,
  replyingTo,
  onCancel,
  onSent,
}: {
  issueId: string;
  /** Set when this form answers another reply rather than the report. */
  parentId?: string | null;
  isOfficial: boolean;
  lang: Locale;
  /** Whose comment is being answered — turns the label into a reply header. */
  replyingTo?: string;
  onCancel?: () => void;
  /** Told once the reply lands, so the box that opened this form can close. */
  onSent?: () => void;
}) {
  const t = getDictionary(lang);
  const formRef = useRef<HTMLFormElement>(null);
  const action = addComment.bind(null, issueId, parentId);
  const [state, formAction, pending] = useActionState(action, initial);
  const isReply = Boolean(parentId);
  const sent = useRef(false);

  // React already resets the form after a successful action; the ref is only
  // needed to clear a stale echoed value once a retry succeeds.
  useEffect(() => {
    if (!pending && !state.error && !state.values) formRef.current?.reset();
  }, [pending, state]);

  // A reply box folds itself away once the reply is posted — the reply is now
  // in the thread above, and an empty form left hanging under it reads as if
  // nothing was sent. Guarded so it fires on the transition, not on mount.
  useEffect(() => {
    if (pending) {
      sent.current = true;
      return;
    }
    if (sent.current && !state.error) {
      sent.current = false;
      onSent?.();
    }
  }, [pending, state, onSent]);

  return (
    <form ref={formRef} action={formAction} noValidate>
      <input type="hidden" name="locale" value={lang} />

      <label htmlFor={`comment-body-${parentId ?? "root"}`} className={LABEL}>
        {isReply
          ? t.issue.replyingTo(replyingTo ?? t.issue.anonymousAuthor)
          : isOfficial
            ? t.issue.replyAsOfficial
            : t.issue.addComment}
      </label>

      {isOfficial && !isReply && <p className={`mb-2 text-[14px] ${MUTED}`}>{t.issue.officialHint}</p>}

      <textarea
        id={`comment-body-${parentId ?? "root"}`}
        name="body"
        // A reply is an aside in a conversation, not a submission; three rows
        // ask for a sentence where five ask for an essay.
        rows={isReply ? 3 : 4}
        maxLength={5000}
        disabled={pending}
        autoFocus={isReply}
        defaultValue={state.values?.body ?? ""}
        placeholder={isReply ? t.issue.replyPlaceholder : t.issue.commentPlaceholder}
        className={`${FIELD} resize-y`}
      />

      {state.error && (
        <p role="alert" className={`mt-3 ${ALERT}`}>
          {t.errors[state.error]}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          {pending ? t.issue.sending : isReply ? t.issue.sendReply : t.issue.send}
        </button>

        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className={BTN_GHOST}>
            {t.issue.cancelReply}
          </button>
        )}
      </div>
    </form>
  );
}
