import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale, dateLocale } from "@/utils/i18n";
import {
  listTopics,
  queryInterventions,
  distinctMeetings,
} from "@/utils/supabase/council";
import {
  INTERVENTION_TYPES,
  rangeFrom,
  youtubeDeepLink,
  formatTimestamp,
  type InterventionType,
} from "@/utils/council";
import { CARD, CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";

const TYPE_BADGE: Record<InterventionType, string> = {
  complaint: "bg-[#fdeceb] text-[#a4231f]",
  question: "bg-[#e8eef9] text-[#1c4fa1]",
  support: "bg-[#e6f4f1] text-[#097d6c]",
  info: "bg-[#eef1f4] text-[#3d4a56]",
  response: "bg-[#f3ecfb] text-[#6b3fa0]",
};

const SELECT =
  "rounded-[4px] border-[0.8px] border-[#637381] bg-white px-3 py-[9px] text-[15px] leading-[20px] text-[#212529] focus:border-[#097d6c]";

export default async function CouncilPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ sujet?: string; type?: string; mois?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { sujet, type, mois } = await searchParams;
  const t = getDictionary(lang);

  const [user, topics] = await Promise.all([getSessionUser(), listTopics()]);

  const topic = topics.find((x) => x.slug === sujet);
  const typeFilter = INTERVENTION_TYPES.includes(type as InterventionType)
    ? (type as InterventionType)
    : undefined;
  const months = [3, 6, 12, 0].includes(Number(mois)) ? Number(mois) : 3;

  const results = await queryInterventions({
    topicId: topic?.id,
    type: typeFilter,
    from: rangeFrom(months),
  });

  const meetingsCount = distinctMeetings(results);

  // Group for the "by meeting" mini bar chart.
  const byMeeting = new Map<string, { title: string; date: string; count: number }>();
  for (const r of results) {
    const e = byMeeting.get(r.youtubeId) ?? { title: r.meetingTitle, date: r.meetingDate, count: 0 };
    e.count += 1;
    byMeeting.set(r.youtubeId, e);
  }
  const meetings = [...byMeeting.values()].sort((a, b) => b.date.localeCompare(a.date));
  const maxCount = Math.max(1, ...meetings.map((m) => m.count));

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(iso + "T00:00:00"),
    );

  const rangeLabel = { 3: t.council.ranges.m3, 6: t.council.ranges.m6, 12: t.council.ranges.m12, 0: t.council.ranges.all };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <h1 className="text-[28px] font-bold leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.council.title}
          </h1>
          <p className={`mt-3 max-w-[760px] text-[16px] leading-[24px] ${MUTED}`}>{t.council.intro}</p>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        {/* Native GET form — server-rendered, no client JS. */}
        <form method="get" action={`/${lang}/conseils`} className={`${CARD} flex flex-wrap items-end gap-4 p-4 md:p-5`}>
          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-bold">{t.council.topic}</span>
            <select name="sujet" defaultValue={topic?.slug ?? ""} className={SELECT}>
              <option value="">{t.council.allTopics}</option>
              {topics.map((x) => (
                <option key={x.id} value={x.slug}>
                  {lang === "fr" ? x.labelFr : x.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-bold">{t.council.type}</span>
            <select name="type" defaultValue={typeFilter ?? ""} className={SELECT}>
              <option value="">{t.council.allTypes}</option>
              {INTERVENTION_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t.council.types[ty]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-bold">{t.council.range}</span>
            <select name="mois" defaultValue={String(months)} className={SELECT}>
              <option value="3">{t.council.ranges.m3}</option>
              <option value="6">{t.council.ranges.m6}</option>
              <option value="12">{t.council.ranges.m12}</option>
              <option value="0">{t.council.ranges.all}</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-[4px] border-[0.8px] border-[#097d6c] bg-[#097d6c] px-4 py-[9px] text-[16px] font-bold leading-[20px] text-white hover:bg-[#075f53]"
          >
            {t.council.apply}
          </button>
        </form>

        {/* Headline count */}
        <div className="mt-8 border-b-[0.8px] border-[#ced4da] pb-4">
          <p className="text-[24px] font-bold leading-[32px] md:text-[28px]">
            {results.length}{" "}
            {results.length === 1 ? t.council.resultOne : t.council.resultMany}
            {topic ? ` — ${lang === "fr" ? topic.labelFr : topic.labelEn}` : ""}
          </p>
          <p className={`mt-1 text-[15px] ${MUTED}`}>
            {t.council.across} {meetingsCount}{" "}
            {meetingsCount === 1 ? t.council.meetingOne : t.council.meetingMany}
            {" · "}
            {rangeLabel[months as 3 | 6 | 12 | 0].toLowerCase()}
          </p>
        </div>

        {results.length === 0 ? (
          <div className={`${CARD} mt-6 p-10 text-center`}>
            <p className="text-[20px] font-bold leading-[28px]">{t.council.emptyTitle}</p>
            <p className={`mt-2 ${MUTED}`}>{t.council.emptyBody}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            {/* Intervention list */}
            <div className="space-y-3">
              {results.map((r) => (
                <article key={r.id} className={`${CARD} p-4`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
                    {r.type && (
                      <span className={`rounded-[4px] px-2 py-1 font-bold ${TYPE_BADGE[r.type]}`}>
                        {t.council.types[r.type]}
                      </span>
                    )}
                    <span className={`font-bold ${MUTED}`}>{t.council.roles[r.speakerRole]}</span>
                    <span aria-hidden="true" className={MUTED}>·</span>
                    <span className={MUTED}>{fmtDate(r.meetingDate)}</span>
                  </div>
                  <p className="text-[16px] leading-[24px]">{r.summary}</p>
                  <a
                    href={youtubeDeepLink(r.youtubeId, r.startS)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#097d6c] hover:underline"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M10 8l6 4-6 4V8z" />
                      <path
                        d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                    {t.council.watch} ({formatTimestamp(r.startS)})
                  </a>
                </article>
              ))}
            </div>

            {/* By-meeting mini bar chart */}
            <aside className={`${CARD} h-fit p-4`}>
              <p className="mb-3 text-[15px] font-bold">{t.council.byMeeting}</p>
              <ul className="space-y-3">
                {meetings.map((m) => (
                  <li key={m.title}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                      <span className={MUTED}>{fmtDate(m.date)}</span>
                      <span className="font-bold tabular-nums">{m.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef1f4]">
                      <div
                        className="h-full rounded-full bg-[#097d6c]"
                        style={{ width: `${(m.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}

        <p className={`mt-8 text-[13px] ${MUTED}`}>{t.council.disclaimer}</p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
