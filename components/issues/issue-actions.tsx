"use client";

import { useState, useTransition } from "react";
import { deleteIssue } from "@/app/actions/issues";
import type { Locale } from "@/utils/i18n";

export type ActionLabels = {
  withdraw: string;
  withdrawing: string;
  confirmTitle: string;
  confirmBody: string;
  confirmYes: string;
  cancel: string;
  officialNote: string;
};

/**
 * Withdrawing a report, for the author or an elected official.
 *
 * Editing used to sit beside this and is deliberately gone: a report can be
 * backed by two hundred residents, and words that change afterwards carry that
 * support somewhere nobody agreed to go. Withdrawing and filing again costs the
 * author their votes and their replies, which is the point — see migration 0019.
 *
 * It asks first, inline rather than through `window.confirm`: a native dialog
 * cannot explain that the replies go with it, and this is not an action anyone
 * should be able to complete by reflex.
 *
 * When an official is acting on someone else's report the panel says so before
 * the button. Nobody should remove a resident's words while under the
 * impression they are tidying their own.
 */
export function IssueActions({
  issueId,
  lang,
  canWithdraw,
  actingAsOfficial,
  labels,
}: {
  issueId: string;
  lang: Locale;
  canWithdraw: boolean;
  actingAsOfficial: boolean;
  labels: ActionLabels;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canWithdraw) return null;

  const withdraw = () => {
    const data = new FormData();
    data.set("locale", lang);
    startTransition(async () => {
      await deleteIssue(issueId, data);
    });
  };

  return (
    <div className="mt-5 rounded-[14px] border border-[#e9e0d6] bg-[#fef7f0] p-4">
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
          <p className="mt-1 text-[14px] leading-[20px] text-[#6e6a72]">{labels.confirmBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={withdraw}
              disabled={pending}
              className="rounded-[10px] border border-[#ab1f5c] bg-[#ab1f5c] px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-[#b3122c] disabled:opacity-60"
            >
              {pending ? labels.withdrawing : labels.confirmYes}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-[10px] border border-[#e9e0d6] bg-white px-4 py-2 text-[14px] font-bold text-[#6e6a72] transition-colors hover:border-[#6e6a72] hover:text-[#1a1a1a] disabled:opacity-60"
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#e9e0d6] bg-white px-4 py-2 text-[14px] font-bold text-[#6e6a72] transition-colors hover:border-[#ab1f5c] hover:text-[#ab1f5c]"
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
