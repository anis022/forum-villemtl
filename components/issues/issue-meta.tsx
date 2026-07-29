import type { Author, Category, Status } from "@/utils/issues";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";

export function authorName(author: Author, fallback: string) {
  return [author.firstName, author.lastName].filter(Boolean).join(" ") || fallback;
}

export function formatDate(iso: string, lang: Locale) {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Category and status sit side by side, but they answer different questions —
 * what this is about, and where it stands — so they must not look alike. The
 * category is an outline pill; status is filled and carries a dot.
 */
export function CategoryTag({ category, lang }: { category: Category; lang: Locale }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#dde5e1] px-2.5 py-1 text-[12px] font-bold text-[#5d6b66]">
      {getDictionary(lang).categories[category]}
    </span>
  );
}

/**
 * Status carries a dot as well as a colour: colour alone is not a signal for
 * anyone who cannot separate these hues.
 */
const STATUS_STYLES: Record<Status, { pill: string; dot: string }> = {
  open: { pill: "bg-[#f2f6f4] text-[#5d6b66]", dot: "bg-[#93a19c]" },
  answered: { pill: "bg-[#e2f0ec] text-[#097d6c]", dot: "bg-[#097d6c]" },
  resolved: { pill: "bg-[#e8eef9] text-[#1c4fa1]", dot: "bg-[#1c4fa1]" },
};

export function StatusTag({ status, lang }: { status: Status; lang: Locale }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${style.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {getDictionary(lang).statuses[status]}
    </span>
  );
}

/** Verified checkmark shown beside an elected official's name. */
export function OfficialBadge({ lang }: { lang: Locale }) {
  const label = getDictionary(lang).official.badge;
  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0 align-middle">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="#097d6c" />
        <path
          d="M4.6 8.3l2.2 2.2 4.6-4.7"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
