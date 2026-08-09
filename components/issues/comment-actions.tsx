"use client";

import { useState, useTransition } from "react";
import { deleteComment } from "@/app/actions/issues";
import { ReplyBox } from "@/components/issues/reply-box";
import { TranslateButton } from "@/components/translate";
import { getDictionary, type Locale } from "@/utils/i18n";
import { BTN_GHOST } from "@/components/ui/styles";

/**
 * Replying to a comment, and removing one.
 *
 * Correcting used to be here too, and is deliberately gone: a thread where the
 * words can change under a reply is a thread nobody can be held to. What was a
 * three-button row is a two-button one, and the answer to a mistake is to
 * withdraw the message and write it again — see migration 0019.
 *
 * Wraps the comment's own text rather than sitting beside it, so a reader who
 * cannot touch this comment never pays for the machinery that would let them.
 *
 * `actingAsOfficial` is not decoration. Someone removing another person's words
 * should be told that is what they are doing, before the button and again in the
 * confirmation.
 */
export function CommentActions({
  commentId,
  issueId,
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
  /** Who wrote it — named in the reply form's heading. */
  author: string;
  lang: Locale;
  canManage: boolean;
  canReply: boolean;
  /** The reader is removing someone else's words rather than their own. */
  actingAsOfficial: boolean;
  /** Whether the *reader* is an elected official, which changes the reply form. */
  readerIsOfficial: boolean;
  children: React.ReactNode;
}) {
  const t = getDictionary(lang);
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();

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
        /* One row: reply and delete on the left, translate pushed to the far
           right. Translating is not one of the two that change the thread — it
           changes nothing about the comment, only how you read it, so it keeps
           its distance, the same way it sits apart from voting and replying on
           a card.

           The negative margin pulls the first button's padding back so the row
           starts on the same edge as the text above it. */
        <div className="mt-1 flex flex-wrap items-center gap-1 [&>button:first-child]:-ml-3.5">
          {replyControl}
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
