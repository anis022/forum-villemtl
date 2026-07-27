"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/utils/i18n";

type Labels = {
  menu: string;
  sections: string;
  forum: string;
  projects: string;
  events: string;
  forumDesc: string;
  projectsDesc: string;
  eventsDesc: string;
};

/**
 * The montreal.ca mega-menu, measured off the live site: a 1080px panel
 * centred in the viewport, dropping from the bottom edge of the header,
 * square corners, shadow 0 2px 8px rgba(0,0,0,.1), a 20px bold heading and
 * 14px bold teal links.
 *
 * Their panel is that wide because it carries ~25 links across four columns.
 * With three, each link gets a one-line description so the width is actually
 * used instead of leaving a third of the panel blank.
 */
export function MainMenu({ lang, labels }: { lang: Locale; labels: Labels }) {
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
    { href: `/${lang}`, label: labels.forum, desc: labels.forumDesc },
    { href: `/${lang}/projets`, label: labels.projects, desc: labels.projectsDesc },
    { href: `/${lang}/evenements`, label: labels.events, desc: labels.eventsDesc },
  ];

  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="main-menu-panel"
        aria-label={labels.menu}
        className={`flex h-10 items-center gap-2 rounded-[4px] px-2 text-[16px] font-bold leading-[24px] transition-colors md:gap-3 md:px-3 ${
          open ? "text-[#097d6c]" : "text-[#212529] hover:text-[#097d6c]"
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

      {open && (
        <div
          id="main-menu-panel"
          className="menu-panel absolute left-1/2 top-full z-50 w-[min(1080px,calc(100vw-2rem))] bg-white px-4 py-8 shadow-[0_2px_8px_0_rgba(0,0,0,0.1)]"
        >
          <p className="mb-4 text-[20px] font-bold leading-[24px] text-[#212529]">
            {labels.sections}
          </p>
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="text-[14px] font-bold leading-[20px] text-[#097d6c] hover:underline"
                >
                  {item.label}
                </Link>
                <p className="mt-1 text-[14px] leading-[20px] text-[#637381]">{item.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
