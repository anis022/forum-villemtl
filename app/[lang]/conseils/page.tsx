import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale, dateLocale } from "@/utils/i18n";
import { searchCouncil, corpusStats } from "@/utils/supabase/council";
import { youtubeDeepLink, formatTimestamp } from "@/utils/council";
import {
  BARE_CONTROL,
  BTN_PRIMARY,
  CARD,
  CHIP,
  CONTAINER,
  FIELD,
  HERO_BAND,
  MUTED,
} from "@/components/ui/styles";

export default async function CouncilPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { q } = await searchParams;
  const t = getDictionary(lang);
  const query = (q ?? "").trim();

  const [user, stats] = await Promise.all([getSessionUser(), corpusStats()]);
  const { hits, semantic } = query
    ? await searchCouncil(query)
    : { hits: [], semantic: false };

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale(lang), {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso + "T00:00:00"));

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          {/* The title steps down to 26px below the `sm` breakpoint: at 28px the
              single word "d'arrondissement" already runs the full width of a
              320px screen, so the heading has nothing left to give. */}
          <h1 className="text-[26px] font-bold leading-[34px] break-words sm:text-[28px] sm:leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.council.title}
          </h1>
          <p className={`mt-3 max-w-[760px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.council.intro}
          </p>

          {/* Native GET form: the query lives in the URL, so every search is
              shareable and the back button behaves. No client JS. */}
          <form method="get" action={`/${lang}/conseils`} className="mt-6 max-w-[760px]">
            <label htmlFor="q" className="sr-only">
              {t.council.searchLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* `min-w-0` because a text input refuses to shrink below the
                  intrinsic width of its `size` attribute inside a flex row,
                  which would push the button off the side of the field. */}
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder={t.council.searchPlaceholder}
                className={`${FIELD} min-w-0`}
              />
              {/* Stacked and full width on a phone, where a pill sitting beside
                  the field would leave neither enough room to be legible;
                  `self-stretch` then matches the field's height once they sit
                  side by side. */}
              <button type="submit" className={`${BTN_PRIMARY} shrink-0 sm:self-stretch`}>
                {t.council.searchButton}
              </button>
            </div>
          </form>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        {stats.segments === 0 ? (
          <div className={`${CARD} p-6 text-center md:p-10`}>
            <p className="text-[20px] font-bold leading-[28px]">{t.council.emptyCorpusTitle}</p>
            <p className={`mt-2 ${MUTED}`}>{t.council.emptyCorpusBody}</p>
          </div>
        ) : !query ? (
          <div className="max-w-[760px]">
            <p className={`text-[15px] ${MUTED}`}>
              {t.council.corpusNote(stats.meetings, stats.segments)}
            </p>
            <p className="mt-6 text-[15px] font-bold">{t.council.examplesLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {t.council.examples.map((ex) => (
                <li key={ex}>
                  {/* The 40px thumb floor lives in CHIP itself now. */}
                  <a href={`/${lang}/conseils?q=${encodeURIComponent(ex)}`} className={CHIP}>
                    {ex}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : hits.length === 0 ? (
          <div className={`${CARD} p-6 text-center md:p-10`}>
            <p className="text-[20px] font-bold leading-[28px]">{t.council.noResultsTitle}</p>
            <p className={`mt-2 ${MUTED}`}>{t.council.noResultsBody}</p>
          </div>
        ) : (
          <>
            <div className="border-b border-[#dde5e1] pb-4">
              <p className="text-[20px] font-bold leading-[28px] md:text-[24px]">
                {hits.length} {hits.length === 1 ? t.council.passageOne : t.council.passageMany}
              </p>
              {!semantic && (
                <p className="mt-1 text-[14px] leading-[20px] text-[#a4231f]">
                  {t.council.lexicalOnly}
                </p>
              )}
            </div>

            <ul className="mt-6 max-w-[860px] space-y-3">
              {hits.map((h) => (
                <li key={h.id}>
                  <article className={`${CARD} p-4`}>
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
                      {/* Date and moment are one unit: allowed to wrap between
                          them, the separator ends up stranded at the edge of a
                          line. Together they stay well inside a 320px card. */}
                      <span className={`${MUTED} whitespace-nowrap`}>
                        {fmtDate(h.meetingDate)}
                        <span aria-hidden="true"> · </span>
                        {formatTimestamp(h.startS)}
                      </span>
                      {h.lexicalRank !== null && h.semanticRank !== null && (
                        <span className="rounded-full bg-[#e2f0ec] px-2.5 py-1 font-bold text-[#097d6c]">
                          {t.council.bothMatch}
                        </span>
                      )}
                    </div>

                    {/* Verbatim. Nothing between the recording and the reader. */}
                    <p className="text-[16px] leading-[26px] break-words">{h.text}</p>

                    {/* The link carries its own 44px box and pulls back by the
                        padding that creates it, so it stays flush with the
                        passage while still being a thumb-sized target. */}
                    <a
                      href={youtubeDeepLink(h.youtubeId, h.startS)}
                      target="_blank"
                      rel="noreferrer"
                      className={`${BARE_CONTROL} -mx-2 mt-1 inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[14px] font-bold text-[#097d6c] hover:underline`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                        className="shrink-0"
                      >
                        <path d="M10 8l6 4-6 4V8z" />
                        <path
                          d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                      {t.council.watch}
                    </a>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className={`mt-8 max-w-[860px] text-[13px] leading-[20px] ${MUTED}`}>
          {t.council.disclaimer}
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
