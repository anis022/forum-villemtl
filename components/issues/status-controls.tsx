"use client";

import { useState, useTransition } from "react";
import { setIssueStatus } from "@/app/actions/issues";
import { ALERT, BTN_SECONDARY, MUTED } from "@/components/ui/styles";
import type { Status } from "@/utils/issues";
import { getDictionary, type ErrorCode, type Locale } from "@/utils/i18n";

/**
 * Only rendered for officials. The database function is the real gate — this
 * is just the control surface.
 */
export function StatusControls({
  issueId,
  status,
  lang,
  children,
}: {
  issueId: string;
  status: Status;
  lang: Locale;
  /** Extra office actions, shown in the same row as the status buttons. */
  children?: React.ReactNode;
}) {
  const t = getDictionary(lang);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);

  const change = (next: Status) => {
    startTransition(async () => {
      const result = await setIssueStatus(issueId, next, lang);
      setError(result.error);
    });
  };

  return (
    <div className="mt-5 rounded-[14px] border border-[#a3162c] bg-[#f6e7ea] p-5">
      <p className="font-bold text-[#a3162c]">{t.issue.officialSpace}</p>
      <p className={`mt-1 text-[15px] ${MUTED}`}>
        {t.issue.officialSpaceHint}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {status !== "resolved" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => change("resolved")}
            className={BTN_SECONDARY}
          >
            {pending ? "…" : t.issue.close}
          </button>
        )}
        {status === "resolved" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => change("open")}
            className={BTN_SECONDARY}
          >
            {pending ? "…" : t.issue.reopen}
          </button>
        )}
        {children}
      </div>

      {error && (
        <p role="alert" className={`mt-4 ${ALERT}`}>
          {t.errors[error]}
        </p>
      )}
    </div>
  );
}
