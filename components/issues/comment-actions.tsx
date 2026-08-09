"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteComment, updateComment, type ActionState } from "@/app/actions/issues";
import { ReplyBox } from "@/components/issues/reply-box";
import { TranslateButton } from "@/components/translate";
import { getDictionary, type Locale } from "@/utils/i18n";
import { ALERT, BTN_GHOST, BTN_PRIMARY, FIELD } from "@/components/ui/styles";

const initial: ActionState = { error: null };

/**
 * Correcting and removing a comment.
 *
 * Wraps the comment's own text rather than sitting beside it: editing swaps the
 * words for a field in the place they were, so the correction happens where the
 * sentence is instead of in a form somewhere else on the page. The text arrives
 * as `children`, server-rendered, so a reader who cannot touch this comment
 * never pays for the machinery that would let them.
 *
 * `actingAsOfficial` is not decoration. Someone moderating another person's
 * words should be told that is what they are doing, before the buttons and
 * again in the confirmation.
 */
export function CommentActions({
  commentId,
  issueId,
  body,
  author,
  lang,
  canManage,
  canReply,
  actingAsOfficial,
  readerIsOfficial,
  children,
}: {
  commentId: string;
  issueId: string;
  /** The raw text, for the field. Only sent when the reader may edit it. */
  body: string;
  /** Who wrote it — named in the reply form's heading. */
  author: string;
  lang: Locale;
  canManage: boolean;
  canReply: boolean;
  /** The reader is moderating someone else's words rather than fixing their own. */
  actingAsOfficial: boolean;
  /** Whether the *reader* is an elected official, which changes the reply form. */
  readerIsOfficial: boolean;
  children: React.ReactNode;
}) {
  const t = getDictionary(lang);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [state, formAction, saving] = useActionState(
    updateComment.bind(null, commentId),
    initial,
  );
  const saved = useRef(false);

  // Close the field once the correction lands. Same guard as the reply form:
  // this has to fire on the transition, not on mount.
  useEffect(() => {
    if (saving) {
      saved.current = true;
      return;
    }
    if (saved.current && !state.error) {
      saved.current = false;
      setEditing(false);
    }
  }, [saving, state]);

  const replyControl = (
    <ReplyBox
      issueId={issueId}
      parentId={commentId}
      replyingTo={author}
      isOfficial={readerIsOfficial}
      canReply={canReply}
      lang={lang}
    />
  );

  if (!canManage) {
    return (
      <>
        {children}
        <div className="mt-1 flex flex-wrap items-center gap-1 [&>button:first-child]:-ml-3.5">
          {replyControl}
          <TranslateButton className="ml-auto" />
        </div>
      </>
    );
  }

  const remove = () => {
    const data = new FormData();
    data.set("locale", lang);
    startRemoving(async () => {
      await deleteComment(commentId, data);
    });
  };

  if (editing) {
    return (
      <form action={formAction} noValidate className="mt-1.5">
        <input type="hidden" name="locale" value={lang} />

        {actingAsOfficial && <ModerationNote text={t.issue.moderateNote} />}

        <label htmlFor={`edit-${commentId}`} className="sr-only">
          {t.issue.edit}
        </label>
        <textarea
          id={`edit-${commentId}`}
          name="body"
          rows={4}
          maxLength={5000}
          disabled={saving}
          autoFocus
          defaultValue={state.values?.body ?? body}
          className={`${FIELD} resize-y`}
        />

        {state.error && (
          <p role="alert" className={`mt-3 ${ALERT}`}>
            {t.errors[state.error]}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? t.issue.saving : t.issue.save}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className={BTN_GHOST}
          >
            {t.issue.cancelEdit}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      {children}

      {confirming ? (
        /* Asked inline rather than through `window.confirm`: a native dialog
           cannot say that the replies underneath go too, and removing someone
           else's words should not be completable by reflex. */
        <div className="mt-2 rounded-[14px] border border-[#f3ccc8] bg-[#fdeceb] p-3">
          {actingAsOfficial && <ModerationNote text={t.issue.moderateNote} />}
          <p className="text-[14px] font-bold leading-[20px]">{t.issue.deleteReplyTitle}</p>
          <p className="mt-1 text-[13px] leading-[19px] text-[#5d6b66]">
            {t.issue.deleteReplyBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              className="rounded-[10px] border border-[#c0392f] bg-[#c0392f] px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-[#a4231f] disabled:opacity-60"
            >
              {removing ? t.issue.deleting : t.issue.deleteReplyYes}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={removing}
              className="rounded-[10px] border border-[#dde5e1] bg-white px-4 py-2 text-[14px] font-bold text-[#5d6b66] transition-colors hover:border-[#637381] hover:text-[#16241f] disabled:opacity-60"
            >
              {t.issue.cancelEdit}
            </button>
          </div>
        </div>
      ) : (
        /* One row: reply, edit and delete on the left, translate pushed to the
           far right. Two rows of quiet buttons under every comment is most of a
           thread's height spent on controls — but translating is not one of
           these. It changes nothing about the comment, only how you read it, so
           it keeps its distance from the three that do, the same way it sits
           apart from voting and replying on a card.

           The negative margin pulls the first button's padding back so the row
           starts on the same edge as the text above it. */
        <div className="mt-1 flex flex-wrap items-center gap-1 [&>button:first-child]:-ml-3.5">
          {replyControl}
          <button type="button" onClick={() => setEditing(true)} className={BTN_GHOST}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 20h4l10-10-4-4L4 16v4zM14.5 5.5l4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t.issue.edit}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${BTN_GHOST} hover:bg-[#fdeceb] hover:text-[#a4231f]`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 7h14M9.5 7V5h5v2M7 7l.8 12h8.4L17 7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t.issue.deleteReply}
          </button>

          <TranslateButton className="ml-auto" />
        </div>
      )}
    </>
  );
}

function ModerationNote({ text }: { text: string }) {
  return (
    <p className="mb-2 flex items-start gap-2 text-[13px] leading-[19px] text-[#b8660a]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <path
          d="M12 3.5l9 15.5H3l9-15.5zM12 9.5v4.2M12 16.3v.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {text}
    </p>
  );
}
