"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FIELD } from "@/components/ui/styles";
import { SEARCH_PANEL_ID, SEARCH_STATE, SEARCH_TOGGLE } from "@/utils/forum-search";
import type { Locale } from "@/utils/i18n";

/**
 * The forum search shares the same field shape and border as the rest of the
 * site. The magnifier and clear action give it its search-specific identity
 * without introducing a one-off pill treatment.
 *
 * It is **folded away until asked for**. A field that is only used when someone
 * has a specific thing to look for was taking the best row of the hero on every
 * visit; the "Recherche" control in the masthead unfolds it, and the space it
 * used to hold now carries the categories people actually browse.
 *
 * Searching is live — the query is pushed into the URL after a short debounce
 * and the server re-renders the filtered list, so results are shareable and
 * survive a reload. `isPending` drives the spinner.
 */
export function ForumSearch({
  lang,
  defaultValue,
  startOpen,
  keep,
  placeholder,
  clearLabel,
  closeLabel,
}: {
  lang: Locale;
  defaultValue: string;
  /** Someone asked for the field from another page and was sent here. */
  startOpen: boolean;
  /**
   * The feed's other URL parameters — sort, view, category. Searching rewrites
   * the address, and without these it would quietly drop whatever else the
   * person had set. `n` is deliberately absent: a new query starts at page one.
   */
  keep: Record<string, string | undefined>;
  placeholder: string;
  clearLabel: string;
  closeLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  /**
   * Open when there is already a query, so a shared or reloaded search URL
   * arrives with its terms on screen — a filtered feed with no visible reason
   * for it is the worst version of this — and open when someone asked for the
   * field on the way in. Both are known on the server, so the field renders in
   * its final state rather than unfolding after hydration.
   */
  const [open, setOpen] = useState(startOpen || Boolean(defaultValue));
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(open);
  /**
   * Held in a ref rather than read as a dependency: `keep` is a fresh object on
   * every server render, so depending on it would restart the debounce — and
   * re-push the same URL — every time a chip changed the category.
   */
  const keepRef = useRef(keep);
  useEffect(() => {
    keepRef.current = keep;
  });

  /**
   * Folding the field away ends the search. Leaving a filtered feed behind a
   * hidden field is how someone ends up staring at three results with nothing
   * on the page explaining why.
   */
  const close = () => {
    setOpen(false);
    setValue("");
  };

  // Re-registered whenever `open` changes: the masthead sends one event for
  // both directions, so the handler has to know which way it is going.
  useEffect(() => {
    const toggle = () => (open ? close() : setOpen(true));
    window.addEventListener(SEARCH_TOGGLE, toggle);
    return () => window.removeEventListener(SEARCH_TOGGLE, toggle);
  }, [open]);

  // Tell the masthead control what it is controlling. Fires on mount too, which
  // is how the header learns this page has a field at all.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SEARCH_STATE, { detail: { open } }));
  }, [open]);

  useEffect(() => {
    // Only on a real unfolding, never on mount: a page that loads with a query
    // would otherwise yank focus — and the scroll with it — out from under the
    // reader. `requestAnimationFrame` waits for the panel to leave
    // `display: none`, since a hidden input cannot take focus.
    if (open && !wasOpen.current) requestAnimationFrame(() => inputRef.current?.focus());
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    // Don't re-navigate on mount, only on real edits.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const query = value.trim();
      const next = new URLSearchParams();
      for (const [key, param] of Object.entries(keepRef.current)) if (param) next.set(key, param);
      if (query) next.set("q", query);
      const search = next.toString();

      startTransition(() => {
        router.replace(search ? `/${lang}?${search}` : `/${lang}`, { scroll: false });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, lang, router]);

  return (
    /* Always rendered, so it can animate shut as well as open; `display: none`
       while folded keeps it out of the tab order and the accessibility tree.
       Same mechanism as the mega-menu panel. */
    <div
      id={SEARCH_PANEL_ID}
      data-open={open ? "" : undefined}
      inert={!open}
      className="search-panel mt-5 max-w-[680px]"
    >
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className="relative"
      >
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6e6a72]">
          {isPending ? (
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="search-spinner">
              <circle cx="10" cy="10" r="7" stroke="#e9e0d6" strokeWidth="2" fill="none" />
              <path
                d="M10 3a7 7 0 0 1 7 7"
                stroke="#fa3250"
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
          ref={inputRef}
          id="forum-search"
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${FIELD} h-12 pl-12 pr-12 [&::-webkit-search-cancel-button]:appearance-none`}
        />

        {/* One control, always there, always doing the next obvious thing: it
            empties the field while there is something in it, and folds the
            whole search away once there isn't. On a phone that is the only
            visible way back out, and it sits where the eye already is. */}
        <button
          type="button"
          onClick={() => (value ? setValue("") : close())}
          aria-label={value ? clearLabel : closeLabel}
          className="clear-btn absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#6e6a72] hover:bg-[#faf1e8] hover:text-[#1a1a1a]"
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
      </form>
    </div>
  );
}
