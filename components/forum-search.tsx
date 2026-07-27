"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Locale } from "@/utils/i18n";

/**
 * The montreal.ca search field: a 56px pill with the magnifier inset on the
 * left (border 0.8px #637381, radius 28px).
 *
 * Searching is live — the query is pushed into the URL after a short debounce
 * and the server re-renders the filtered list, so results are shareable and
 * survive a reload. `isPending` drives the spinner and the list's dimming.
 */
export function ForumSearch({
  lang,
  defaultValue,
  placeholder,
  clearLabel,
}: {
  lang: Locale;
  defaultValue: string;
  placeholder: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't re-navigate on mount, only on real edits.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const query = value.trim();
      startTransition(() => {
        router.replace(query ? `/${lang}?q=${encodeURIComponent(query)}` : `/${lang}`, {
          scroll: false,
        });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, lang, router]);

  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
      <span className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-[#637381]">
        {isPending ? (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="search-spinner">
            <circle cx="10" cy="10" r="7" stroke="#ced4da" strokeWidth="2" fill="none" />
            <path
              d="M10 3a7 7 0 0 1 7 7"
              stroke="#097d6c"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
            <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </span>

      <input
        id="forum-search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-14 w-full rounded-[28px] border-[0.8px] border-[#637381] bg-white pl-14 pr-14 text-[16px] leading-[24px] text-[#212529] transition-[border-color] duration-150 focus:border-[#097d6c] [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={clearLabel}
          className="clear-btn absolute right-5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#637381] hover:bg-[#f8f9fa] hover:text-[#212529]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </form>
  );
}
