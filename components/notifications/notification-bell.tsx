import Link from "next/link";
import { BARE_CONTROL } from "@/components/ui/styles";
import type { Locale } from "@/utils/i18n";

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
