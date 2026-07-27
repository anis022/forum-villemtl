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

export function CategoryTag({ category, lang }: { category: Category; lang: Locale }) {
  return (
    <span className="rounded-[4px] bg-[#eef1f4] px-2 py-1 text-[13px] font-bold text-[#3d4a56]">
      {getDictionary(lang).categories[category]}
    </span>
  );
}

const STATUS_STYLES: Record<Status, string> = {
  open: "bg-[#eef1f4] text-[#3d4a56]",
  answered: "bg-[#e6f4f1] text-[#097d6c]",
  resolved: "bg-[#e8eef9] text-[#1c4fa1]",
};

export function StatusTag({ status, lang }: { status: Status; lang: Locale }) {
  return (
    <span className={`rounded-[4px] px-2 py-1 text-[13px] font-bold ${STATUS_STYLES[status]}`}>
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
