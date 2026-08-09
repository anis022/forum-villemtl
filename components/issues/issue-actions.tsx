"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteIssue } from "@/app/actions/issues";
import type { Locale } from "@/utils/i18n";

export type ActionLabels = {
  edit: string;
  withdraw: string;
  withdrawing: string;
  confirmTitle: string;
  confirmBody: string;
  confirmYes: string;
  cancel: string;
  officialNote: string;
};

/**
 * Edit and withdraw, for the author or an elected official.
 *
 * Withdrawing asks first, inline rather than through `window.confirm`: a native
 * dialog cannot explain that the replies go with it, and this is not an action
 * anyone should be able to complete by reflex.
 *
 * When an official is acting on someone else's report the panel says so before
 * the buttons. Nobody should remove a resident's words while under the
 * impression they are tidying their own.
 */
export function IssueActions({
  issueId,
  lang,
  canEdit,
  actingAsOfficial,
  labels,
}: {
  issueId: string;
  lang: Locale;
  canEdit: boolean;
  actingAsOfficial: boolean;
  labels: ActionLabels;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  const withdraw = () => {
    const data = new FormData();
    data.set("locale", lang);
    startTransition(async () => {
      await deleteIssue(issueId, data);
    });
  };

  return (
    <div className="mt-5 rounded-[14px] border border-[#dde5e1] bg-[#f8faf9] p-4">
      {actingAsOfficial && (
        <p className="mb-3 flex items-start gap-2 text-[13px] leading-[19px] text-[#b8660a]">
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
          {labels.officialNote}
        </p>
      )}

      {confirming ? (
        <div>
          <p className="text-[15px] font-bold leading-[22px]">{labels.confirmTitle}</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[#5d6b66]">{labels.confirmBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={withdraw}
              disabled={pending}
              className="rounded-[10px] border border-[#c0392f] bg-[#c0392f] px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-[#a4231f] disabled:opacity-60"
            >
              {pending ? labels.withdrawing : labels.confirmYes}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-[10px] border border-[#dde5e1] bg-white px-4 py-2 text-[14px] font-bold text-[#5d6b66] transition-colors hover:border-[#637381] hover:text-[#16241f] disabled:opacity-60"
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${lang}/sujets/${issueId}/modifier`}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#dde5e1] bg-white px-4 py-2 text-[14px] font-bold text-[#097d6c] transition-colors hover:border-[#097d6c] hover:bg-[#e2f0ec]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 20h4l10-10-4-4L4 16v4zM14.5 5.5l4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {labels.edit}
          </Link>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#dde5e1] bg-white px-4 py-2 text-[14px] font-bold text-[#5d6b66] transition-colors hover:border-[#c0392f] hover:text-[#c0392f]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 7h14M9.5 7V5h5v2M7 7l.8 12h8.4L17 7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {labels.withdraw}
          </button>
        </div>
      )}
    </div>
  );
}
