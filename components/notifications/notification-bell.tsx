import Link from "next/link";
import { BARE_CONTROL } from "@/components/ui/styles";
import type { Locale } from "@/utils/i18n";

/**
 * The way into the notification centre, in the masthead beside the account.
 *
 * A link, not a panel. A dropdown of the last five notices would be a second
 * place the same list is rendered and a second place it can go stale, and the
 * centre is one tap away either side of it. What this has to do well is the one
 * thing a panel does not help with: say, at a glance and from across a desk,
 * that there is something waiting.
 *
 * Rendered only for the borough office. `SiteHeader` decides that by passing
 * `null` for everybody else, the same way the moderation entry stays out of the
 * menu, so a resident's masthead is unchanged and costs nothing extra.
 */
export function NotificationBell({
  lang,
  count,
  label,
  unreadLabel,
}: {
  lang: Locale;
  count: number;
  label: string;
  unreadLabel: string;
}) {
  const unread = count > 0;

  return (
    <Link
      href={`/${lang}/notifications`}
      // The accessible name carries the number. A bare "Notifications" with a
      // red dot beside it tells a screen reader nothing about why the dot is
      // there, and the count is the entire message.
      aria-label={unread ? `${label}. ${unreadLabel}` : label}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center ${BARE_CONTROL} text-[#2a2a86] transition-colors hover:bg-[#faf1e8] hover:text-[#a3162c]`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v3.1l-1.3 2.6a.7.7 0 0 0 .63 1.05h12.34a.7.7 0 0 0 .63-1.05l-1.3-2.6V9A5.5 5.5 0 0 0 12 3.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M9.8 18.4a2.3 2.3 0 0 0 4.4 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>

      {unread && (
        // A count, not a dot: "there is something" and "there are fourteen
        // things" are different mornings. Past 9 it stops being a number worth
        // reading precisely and the badge stops growing into the wordmark.
        //
        // Ringed in the cream of the row behind it so the badge reads as
        // sitting on top of the bell rather than merging into its outline.
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#a3162c] px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[#fef7f0] tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
