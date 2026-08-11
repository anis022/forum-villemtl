"use client";

import { useCallback, useState } from "react";
import { CommentForm } from "@/components/issues/comment-form";
import { getDictionary, type Locale } from "@/utils/i18n";
import { BTN_GHOST } from "@/components/ui/styles";

/**
 * The "Répondre" control under a comment, and the form it opens.
 *
 * Kept out of the thread renderer so that the conversation itself stays a
 * server component: one small island per comment, rather than shipping every
 * reply's text to the browser to make a button work.
 *
 * Renders a fragment, not a block — it sits in the same wrapping flex row as
 * the edit and delete controls, and the form takes `w-full` so that opening it
 * claims a line of its own instead of being squeezed between two buttons.
 */
export function ReplyBox({
  issueId,
  parentId,
  replyingTo,
  isOfficial,
  canReply,
  lang,
}: {
  issueId: string;
  parentId: string;
  replyingTo: string;
  isOfficial: boolean;
  /** Signed out, or the thread is already as deep as it may go. */
  canReply: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!canReply) return null;

  if (open) {
    return (
      <div className="mt-2 w-full rounded-[14px] border border-[#e9e0d6] bg-[#fef7f0] p-3 sm:p-4">
        <CommentForm
          issueId={issueId}
          parentId={parentId}
          replyingTo={replyingTo}
          isOfficial={isOfficial}
          lang={lang}
          onCancel={close}
          onSent={close}
        />
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setOpen(true)} className={BTN_GHOST}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 7L4 12l5 5M4.5 12H14a5.5 5.5 0 0 1 5.5 5.5V19"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {t.issue.reply}
    </button>
  );
}
