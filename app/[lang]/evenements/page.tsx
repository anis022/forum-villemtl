import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale, dateLocale } from "@/utils/i18n";
import { listEvents } from "@/utils/supabase/events";
import { CARD, CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";
import { EventMap } from "@/components/events/event-map";

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
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <h1 className="text-[28px] font-bold leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.pages.eventsTitle}
          </h1>
          <p className={`mt-3 max-w-[760px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.events.intro}
          </p>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        {events.length === 0 ? (
          // 40px of padding on each side of a 320px screen leaves the message a
          // column barely wider than one word.
          <div className={`${CARD} p-6 text-center sm:p-10`}>
            <p className="text-[20px] font-bold leading-[28px]">{t.events.emptyTitle}</p>
            <p className={`mt-2 ${MUTED}`}>{t.events.emptyBody}</p>
          </div>
        ) : (
          <EventMap
            events={events}
            locale={dateLocale(lang)}
            labels={{
              allDistricts: t.events.allDistricts,
              allTypes: t.events.allTypes,
              district: t.events.district,
              type: t.events.type,
              eventOne: t.events.eventOne,
              eventMany: t.events.eventMany,
              noneTitle: t.events.noneTitle,
              noneBody: t.events.noneBody,
              details: t.events.details,
              online: t.events.online,
              unmapped: t.events.unmapped,
              free: t.events.free,
              showAll: t.events.showAll,
              showMore: t.events.showMore,
            }}
          />
        )}

        <p className={`mt-8 max-w-[860px] text-[13px] leading-[20px] ${MUTED}`}>
          {t.events.source}
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
