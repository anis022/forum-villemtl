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
 * Category and status sit side by side, but they answer different questions,
 * what this is about and where it stands, so they must not look alike. The
 * category is outlined and status is filled.
 *
 * Rounded the way everything else here is rounded, not capsules. A fully
 * rounded label reads as a badge stuck onto the card rather than as part of it,
 * and there are two of them in the corner of every post in the feed.
 *
 * 10px is the radius the buttons use and the one that appears most often in
 * `styles.ts`, so these sit in the same family as the surfaces around them.
 * Going up to the field's 12px or the card's 16px would not read as a larger
 * corner at this size, it would read as a capsule again: the label is about
 * 20px tall, so anything past half of that is a semicircle.
 */
export function CategoryTag({ category, lang }: { category: Category; lang: Locale }) {
  return (
    /* A shade tighter on phones. These two labels sit in the corner of a card
       whose other half is a person's name, and at full size they left that name
       too little room to be worth reading. */
    <span className="inline-flex max-w-[11ch] items-center truncate rounded-[10px] border border-[#e9e0d6] px-2 py-0.5 text-[11px] font-bold text-[#6e6a72] sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[12px]">
      {getDictionary(lang).categories[category]}
    </span>
  );
}

/** Status is always written out, so its colour is never the only signal. */
const STATUS_STYLES: Record<Status, string> = {
  open: "bg-[#faf1e8] text-[#6e6a72]",
  answered: "bg-[#e8e8f6] text-[#2a2a86]",
  resolved: "bg-[#e4f2eb] text-[#0b6042]",
};

export function StatusTag({ status, lang }: { status: Status; lang: Locale }) {
  return (
    <span
      className={`inline-flex items-center rounded-[10px] px-2 py-0.5 text-[11px] font-bold sm:px-2.5 sm:py-1 sm:text-[12px] ${STATUS_STYLES[status]}`}
    >
      {getDictionary(lang).statuses[status]}
    </span>
  );
}

/**
 * Verified checkmark shown beside the name of someone who speaks for the
 * borough office.
 *
 * Two of them, because nine people carry it and only four were elected. The
 * mark said "Élu·e de la Ville de Montréal" beside every one of them, which for
 * the five who work at the office was the site claiming they hold a seat they
 * do not — a small label, and a real thing to be wrong about on a forum whose
 * whole subject is who represents whom.
 *
 * The distinction is carried in colour and in the label, not in the shape: both
 * are a filled check, because both mean the same thing to a reader scanning a
 * thread — this reply comes from the office and not from a neighbour. Red is
 * the accent every action on the site already uses; indigo is the colour the
 * palette reserves for "an official spoke", which is exactly what the staff
 * mark says and all it says.
 */
export function OfficialBadge({ lang, elected }: { lang: Locale; elected: boolean }) {
  const t = getDictionary(lang).official;
  const label = elected ? t.badge : t.staffBadge;
  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0 align-middle">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill={elected ? "#a3162c" : "#2a2a86"} />
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
