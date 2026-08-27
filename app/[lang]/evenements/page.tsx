import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MapMobileHeader } from "@/components/issues/map-mobile-header";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale, dateLocale } from "@/utils/i18n";
import { listEvents } from "@/utils/supabase/events";
import { MUTED } from "@/components/ui/styles";
import { EventMap } from "@/components/events/event-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.nav.short.events, alternates: { canonical: `/${lang}/evenements` } };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const [user, events] = await Promise.all([getSessionUser(), listEvents()]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#fef7f0] text-[#1a1a1a]">
      <div className="hidden lg:block">
        <SiteHeader user={user} lang={lang} />
      </div>
      <MapMobileHeader user={user} lang={lang} href={`/${lang}/evenements`} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {events.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
            <div className="max-w-[440px] rounded-[16px] border border-[#e5dcd2] bg-white p-7 shadow-[0_4px_16px_rgba(26,26,26,0.06)]">
              <p className="text-[20px] font-semibold leading-[28px]">{t.events.emptyTitle}</p>
              <p className={`mt-2 ${MUTED}`}>{t.events.emptyBody}</p>
            </div>
          </div>
        ) : (
          <EventMap
            events={events}
            locale={dateLocale(lang)}
            labels={{
              allTypes: t.events.allTypes,
              type: t.events.type,
              mapLabel: t.events.mapLabel,
              searchPlaceholder: t.events.searchPlaceholder,
              clearSearch: t.home.clearSearch,
              filters: t.home.filters,
              filterWhen: t.events.filterWhen,
              filterSetting: t.events.filterSetting,
              when: t.events.when,
              settings: t.events.settings,
              allSettings: t.events.allSettings,
              todayPill: t.events.todayPill,
              eventOne: t.events.eventOne,
              eventMany: t.events.eventMany,
              noneTitle: t.events.noneTitle,
              noneBody: t.events.noneBody,
              details: t.events.details,
              online: t.events.online,
              unmapped: t.events.unmapped,
              showAll: t.events.showAll,
              showMore: t.events.showMore,
              nearbyHint: t.events.nearbyHint,
              nearbyLabel: t.events.nearbyLabel,
              nearbyClear: t.events.nearbyClear,
              nearbyNoneTitle: t.events.nearbyNoneTitle,
              nearbyNoneBody: t.events.nearbyNoneBody,
              source: t.events.source,
            }}
          />
        )}
      </main>
    </div>
  );
}
