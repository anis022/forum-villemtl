import Link from "next/link";
import type { Author, Category, Status } from "@/utils/issues";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";

export function authorName(author: Author, fallback: string) {
  return [author.firstName, author.lastName].filter(Boolean).join(" ") || fallback;
}

/**
 * An author's name or avatar, linked to their profile only when there is one to
 * link to.
 *
 * Closing an account detaches the posts from the person rather than deleting
 * them (migration 0021), so `author.id` comes back empty and `/fr/profil/` is a
 * link to nowhere. Rendering the children bare in that case is what keeps a
 * withdrawn neighbour's report readable instead of studded with dead links.
 */
export function ProfileLink({
  author,
  lang,
  className,
  children,
}: {
  author: Author;
  lang: Locale;
  className?: string;
  children: React.ReactNode;
}) {
  if (!author.id) return <span className={className}>{children}</span>;
  return (
    <Link href={`/${lang}/profil/${author.id}`} className={className}>
      {children}
    </Link>
  );
}

export function formatDate(iso: string, lang: Locale) {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Feed form: "29 juil. 2026". In a card the date shares one line with a name,
 * a badge and two pills, and the written-out month is what tipped that row over
 * the edge of a small phone. The page for a single report has room for the long
 * form and uses it.
 */
export function formatDateShort(iso: string, lang: Locale) {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: "numeric",
    month: "short",
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
    /* A shade tighter on phones. These two pills sit in the corner of a card
       whose other half is a person's name, and at full size they left that name
       too little room to be worth reading. */
    <span className="inline-flex max-w-[11ch] items-center truncate rounded-full border border-[#dde5e1] px-2 py-0.5 text-[11px] font-bold text-[#5d6b66] sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[12px]">
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[12px] ${style.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
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
