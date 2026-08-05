"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BARE_CONTROL } from "@/components/ui/styles";
import { SEARCH_PANEL_ID, SEARCH_PARAM, SEARCH_STATE, SEARCH_TOGGLE } from "@/utils/forum-search";
import type { Locale } from "@/utils/i18n";

/**
 * The "Recherche" entry in the montreal.ca masthead — now the only way the
 * search field appears. It used to jump to a field that was always on screen;
 * the field is folded away by default so the hero can lead with the categories
 * people browse, and this control unfolds it, or folds it back.
 *
 * The field lives on the forum page, not in the header, so off the forum this
 * is a navigation carrying the request in the hash.
 */
export function HeaderSearchButton({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  /**
   * The last thing a field said, and the page it said it from. Stamped with the
   * route rather than cleared on navigation: a report from the forum says
   * nothing about the page someone moved on to, and comparing is how that stays
   * true without a second piece of state chasing the first.
   */
  const [panel, setPanel] = useState<{ path: string; open: boolean } | null>(null);

  useEffect(() => {
    const sync = (event: Event) =>
      setPanel({
        path: window.location.pathname,
        open: (event as CustomEvent<{ open: boolean }>).detail.open,
      });
    window.addEventListener(SEARCH_STATE, sync);
    return () => window.removeEventListener(SEARCH_STATE, sync);
  }, []);

  /** `null` while no field on this page has introduced itself. */
  const expanded = panel && panel.path === pathname ? panel.open : null;

  const activate = () => {
    if (document.getElementById(SEARCH_PANEL_ID)) {
      window.dispatchEvent(new Event(SEARCH_TOGGLE));
      return;
    }
    router.push(`/${lang}?${SEARCH_PARAM}=1`);
  };

  return (
    <button
      type="button"
      onClick={activate}
      aria-label={label}
      aria-expanded={expanded ?? undefined}
      aria-controls={expanded === null ? undefined : SEARCH_PANEL_ID}
      className={`flex h-10 shrink-0 items-center gap-2 ${BARE_CONTROL} px-2 text-[16px] font-bold leading-[24px] transition-colors sm:px-3 ${
        expanded ? "text-[#097d6c]" : "text-[#16241f] hover:text-[#097d6c]"
      }`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" className="shrink-0">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
