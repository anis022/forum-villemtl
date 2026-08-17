import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { TrackedEventLink } from "@/components/analytics/tracked-event-link";
import type { ActiveMember } from "@/utils/supabase/community";
import type { TrendingResult } from "@/utils/supabase/trending";
import type { Category } from "@/utils/issues";
import type { Locale } from "@/utils/i18n";
import { dateLocale } from "@/utils/i18n";
import { formatDateRange } from "@/utils/events";
import { say } from "@/utils/projects";

type CategorySummary = { key: Category; label: string; count: number };

const PANEL = "rounded-[14px] border border-[#e4dcd3] bg-white p-4";
const TITLE = "border-b border-[#eee7df] pb-2.5 text-[16px] font-semibold leading-[22px]";

export function ForumSidebar({
  lang,
  members,
  categories,
  trending,
  labels,
}: {
  lang: Locale;
  members: ActiveMember[];
  categories: CategorySummary[];
  trending: TrendingResult;
  labels: {
    activeMembers: string;
    popularCategories: string;
    trending: string;
    discover: string;
    event: string;
    project: string;
    contributions: (count: number) => string;
    views: (count: number) => string;
  };
}) {
  const locale = dateLocale(lang);

  return (
    <aside
      aria-label={trending.hasTraffic ? labels.trending : labels.discover}
      className="space-y-5 lg:sticky lg:top-5"
    >
      {members.length > 0 && (
        <section className={PANEL}>
          <h2 className={TITLE}>{labels.activeMembers}</h2>
          <ul className="mt-2">
            {members.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/${lang}/profil/${member.id}`}
                  className="flex min-h-12 items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 hover:bg-[#faf1e8]"
                >
                  <Avatar person={member} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                    {member.firstName} {member.lastName.trim().slice(0, 1)}.
                  </span>
                  <span className="shrink-0 text-[12px] text-[#777178] tabular-nums">
                    {labels.contributions(member.contributions)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {categories.length > 0 && (
        <section className={PANEL}>
          <h2 className={TITLE}>{labels.popularCategories}</h2>
          <ul className="mt-1 divide-y divide-[#f0e9e2]">
            {categories.slice(0, 4).map((category) => (
              <li key={category.key}>
                <Link
                  href={`/${lang}?cat=${category.key}`}
                  className="flex min-h-10 items-center gap-3 px-0.5 py-2 text-[14px] text-[#2a2a86] hover:text-[#fa3250]"
                >
                  <span className="min-w-0 flex-1">{category.label}</span>
                  <span className="shrink-0 text-[12px] text-[#777178] tabular-nums">
                    {category.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trending.items.length > 0 && (
        <section className={PANEL}>
          <h2 className={TITLE}>{trending.hasTraffic ? labels.trending : labels.discover}</h2>
          <ol className="mt-1 divide-y divide-[#f0e9e2]">
            {trending.items.map((item) => {
              const title = item.kind === "event"
                ? item.event.title
                : say(item.project.title, lang);
              const meta = item.kind === "event"
                ? `${labels.event} — ${formatDateRange(item.event.startsOn, item.event.endsOn, locale)}`
                : labels.project;
              const content = (
                <>
                  <span className="block text-[12px] font-medium text-[#777178]">{meta}</span>
                  <span className="mt-0.5 block text-[14px] font-medium leading-[20px] text-[#1a1a1a]">
                    {title}
                  </span>
                  {trending.hasTraffic && (
                    <span className="mt-1 block text-[12px] text-[#777178] tabular-nums">
                      {labels.views(item.views)}
                    </span>
                  )}
                </>
              );
              const className = "block rounded-[10px] px-1.5 py-2.5 hover:bg-[#faf1e8]";

              return (
                <li key={`${item.kind}:${item.id}`}>
                  {item.kind === "event" ? (
                    <TrackedEventLink eventId={item.id} href={item.event.sourceUrl} className={className}>
                      {content}
                    </TrackedEventLink>
                  ) : (
                    <Link href={`/${lang}/projets/${item.id}`} className={className}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </aside>
  );
}
