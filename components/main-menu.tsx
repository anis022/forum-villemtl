"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BARE_CONTROL } from "@/components/ui/styles";
import type { Locale } from "@/utils/i18n";

type Labels = {
  menu: string;
  sections: string;
  forum: string;
  projects: string;
  events: string;
  council: string;
  officials: string;
  forumDesc: string;
  projectsDesc: string;
  eventsDesc: string;
  councilDesc: string;
  officialsDesc: string;
  /** Only rendered for elected officials — see `moderation` below. */
  moderation: string;
  moderationDesc: string;
  short: {
    forum: string;
    officials: string;
    council: string;
    projects: string;
    events: string;
    moderation: string;
  };
};

/**
 * Navigation, in the two shapes ensemblemtl.org uses.
 *
 * From `lg` up it is their masthead nav: the sections spelt out in one line of
 * indigo links, no panel and no click needed to find out what the site
 * contains. Below `lg` six links do not fit, so it collapses to the hamburger
 * and the panel — which is also where the one-line descriptions live, since
 * that is the only place with room for them.
 *
 * The panel started as a copy of montreal.ca's, down to the square corners and
 * the flat shadow. Both are gone.
 */
export function MainMenu({
  lang,
  labels,
  moderationCount,
}: {
  lang: Locale;
  labels: Labels;
  /**
   * How many messages are waiting to be read, or null for anyone who is not an
   * elected official — which is how the entry stays out of the menu entirely
   * rather than appearing and refusing.
   */
  moderationCount: number | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const items = [
    { href: `/${lang}`, label: labels.forum, short: labels.short.forum, desc: labels.forumDesc },
    // Straight after the forum: the point of posting here is that someone is
    // meant to answer, and this is who that someone is.
    {
      href: `/${lang}/elus`,
      label: labels.officials,
      short: labels.short.officials,
      desc: labels.officialsDesc,
    },
    {
      href: `/${lang}/conseils`,
      label: labels.council,
      short: labels.short.council,
      desc: labels.councilDesc,
    },
    {
      href: `/${lang}/projets`,
      label: labels.projects,
      short: labels.short.projects,
      desc: labels.projectsDesc,
    },
    {
      href: `/${lang}/evenements`,
      label: labels.events,
      short: labels.short.events,
      desc: labels.eventsDesc,
    },
    // Last, and only for the people who can act on it. A queue is work, not a
    // section of the site, and it belongs after the things residents come for.
    ...(moderationCount === null
      ? []
      : [
          {
            href: `/${lang}/moderation`,
            label:
              moderationCount > 0 ? `${labels.moderation} (${moderationCount})` : labels.moderation,
            short:
              moderationCount > 0
                ? `${labels.short.moderation} (${moderationCount})`
                : labels.short.moderation,
            desc: labels.moderationDesc,
          },
        ]),
  ];

  return (
    <div ref={containerRef} className="flex min-w-0 items-center">
      {/* Their nav, from `lg`: indigo, bold, spelt out. The current section is
          underlined rather than recoloured — red would read as a button. */}
      <nav className="hidden min-w-0 lg:block">
        <ul className="flex items-center gap-1 xl:gap-2">
          {items.map((item) => {
            const current = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`${BARE_CONTROL} inline-flex h-10 items-center whitespace-nowrap px-2.5 font-nav text-[16px] font-bold leading-[24px] transition-colors ${
                    current
                      ? "text-[#2a2a86] underline decoration-[#fa3250] decoration-2 underline-offset-[6px]"
                      : "text-[#2a2a86] hover:text-[#fa3250]"
                  }`}
                >
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="main-menu-panel"
        aria-label={labels.menu}
        className={`flex h-10 shrink-0 items-center gap-2 ${BARE_CONTROL} px-2 font-nav text-[16px] font-bold leading-[24px] transition-colors sm:px-3 lg:hidden ${
          open ? "text-[#fa3250]" : "text-[#2a2a86] hover:text-[#fa3250]"
        }`}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M3 6.5h18M3 12h18M3 17.5h18"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <span className="hidden sm:inline">{labels.menu}</span>
      </button>

      {/* Always rendered so the panel can animate closed as well as open;
          `display: none` while shut keeps it out of the accessibility tree and
          out of the tab order. */}
      <div
        id="main-menu-panel"
        data-open={open ? "" : undefined}
        inert={!open}
        className="menu-panel absolute left-1/2 top-full z-50 w-[min(1080px,calc(100vw-2rem))] rounded-b-[16px] border-x border-b border-[#e9e0d6] bg-white px-4 py-8 shadow-[0_8px_24px_rgba(26,26,26,0.12)] lg:hidden"
      >
        <p className="mb-4 text-[20px] leading-[26px] text-[#1a1a1a]">{labels.sections}</p>
        <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="text-[14px] font-bold leading-[20px] text-[#fa3250] hover:underline"
              >
                {item.label}
              </Link>
              <p className="mt-1 text-[14px] leading-[20px] text-[#6e6a72]">{item.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
