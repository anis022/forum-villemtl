"use client";

import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "@/utils/i18n";

/**
 * Share an issue.
 *
 * Uses the native share sheet where the browser offers one — on a phone that
 * is the whole point, since it reaches the apps people actually pass links
 * through. Everywhere else it copies the link and says so for a moment, which
 * is the only feedback that makes a copy action feel like it worked.
 */
export function ShareButton({
  path,
  title,
  lang,
  className = "",
}: {
  path: string;
  title: string;
  lang: Locale;
  className?: string;
}) {
  const t = getDictionary(lang);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissing the sheet lands here; fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context, permissions): stay silent rather
      // than claim a copy that did not happen.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={t.issue.share}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-bold leading-[20px] text-[#5d6b66] transition-colors hover:bg-[#f2f6f4] hover:text-[#16241f] ${className}`}
    >
      {copied ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14 9V5.5L21 12l-7 6.5V15c-4 0-7 1.2-9 4 .8-4.4 3.4-8.5 9-10z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="hidden sm:inline">{copied ? t.issue.copied : t.issue.share}</span>
    </button>
  );
}
