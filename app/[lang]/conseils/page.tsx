import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QuestionCard } from "@/components/council/question-card";
import { ResolutionCard } from "@/components/council/resolution-card";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";
import { answerAboutQuestions, searchResolutions, corpusStats } from "@/utils/supabase/council";
import { isSection, type Section } from "@/utils/council";
import {
  BTN_PRIMARY,
  CARD,
  CHIP,
  CHIP_ACTIVE,
  CONTAINER,
  FIELD,
  HERO_BAND,
  MUTED,
} from "@/components/ui/styles";

type Search = { q?: string; section?: string; mode?: string };

/**
 * A filter that reads as a filter: chips, not a dropdown.
 *
 * Three choices behind a select box hide all three behind a click and give no
 * sense of how many exist. Rendered as links so the whole page stays a plain
 * GET — every search and filter combination is a shareable URL and the back
 * button behaves.
 */
function FilterChips({
  options,
  current,
  hrefFor,
}: {
  options: { value: string; label: string }[];
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {options.map((o) => (
        <li key={o.value}>
          <a href={hrefFor(o.value)} className={o.value === current ? CHIP_ACTIVE : CHIP}>
            {o.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function CouncilPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Search>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const sp = await searchParams;
  const t = getDictionary(lang);
  const query = (sp.q ?? "").trim();

  const section: Section | "all" = sp.section && isSection(sp.section) ? sp.section : "all";
  const mode = sp.mode === "orale" || sp.mode === "ecrite" ? sp.mode : undefined;

  const wantsQuestions = section === "all" || section === "questions";
  const wantsResolutions = section === "all" || section === "resolutions";

  const [user, stats, answer, resolutions] = await Promise.all([
    getSessionUser(),
    corpusStats(),
    query && wantsQuestions
      ? answerAboutQuestions(query, mode)
      : Promise.resolve(null),
    query && wantsResolutions ? searchResolutions(query) : Promise.resolve(null),
  ]);

  /** Preserve the rest of the query string when one control changes. */
  const url = (patch: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { q: query, section, mode, ...patch };
    if (merged.q) next.set("q", merged.q);
    if (merged.section && merged.section !== "all") next.set("section", merged.section);
    if (merged.mode) next.set("mode", merged.mode);
    const qs = next.toString();
    return `/${lang}/conseils${qs ? `?${qs}` : ""}`;
  };

  /*
   * Whether to say, plainly, that nobody raised this.
   *
   * Judged on counted rows alone. The semantic half always returns its nearest
   * neighbours — that is what nearest means — so a page that waited for those
   * to be empty before admitting defeat would never admit it: searching
   * "zzzzintrouvable" came back with a friendly list of related subjects and no
   * indication that the answer was zero.
   */
  const nothingCounted =
    !!query &&
    (answer?.counted.length ?? 0) === 0 &&
    (resolutions?.counted.length ?? 0) === 0;

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

          {/* Native GET form: no client JS, and the query lives in the URL. */}
          <form method="get" action={`/${lang}/conseils`} className="mt-6 max-w-[760px]">
            {section !== "all" && <input type="hidden" name="section" value={section} />}
            {mode && <input type="hidden" name="mode" value={mode} />}
            <label htmlFor="q" className="sr-only">
              {t.council.searchLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* `min-w-0` because a text input refuses to shrink below the
                  intrinsic width of its `size` attribute inside a flex row. */}
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder={t.council.searchPlaceholder}
                className={`${FIELD} min-w-0`}
              />
              {/* Stacked and full width on a phone, where a pill beside the
                  field would leave neither enough room to be legible. */}
              <button type="submit" className={`${BTN_PRIMARY} shrink-0 sm:self-stretch`}>
                {t.council.searchButton}
              </button>
            </div>
          </form>

          <div className="mt-4 max-w-[760px] space-y-2">
            <FilterChips
              current={section}
              hrefFor={(v) => url({ section: v as Section | "all", mode: undefined })}
              options={[
                { value: "all", label: t.council.sectionAll },
                { value: "questions", label: t.council.sectionQuestions },
                { value: "resolutions", label: t.council.sectionResolutions },
              ]}
            />
            {/* Spoken versus written only means anything once the public
                questions are what is being looked at. */}
            {section === "questions" && (
              <FilterChips
                current={mode ?? "all"}
                hrefFor={(v) => url({ mode: v === "all" ? undefined : (v as "orale" | "ecrite") })}
                options={[
                  { value: "all", label: t.council.modeAll },
                  { value: "orale", label: t.council.modeOrale },
                  { value: "ecrite", label: t.council.modeEcrite },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        {stats.questions === 0 && stats.segments === 0 ? (
          <div className={`${CARD} p-6 text-center md:p-10`}>
            <p className="text-[20px] font-bold leading-[28px]">{t.council.emptyCorpusTitle}</p>
            <p className={`mt-2 ${MUTED}`}>{t.council.emptyCorpusBody}</p>
          </div>
        ) : !query ? (
          <div className="max-w-[760px]">
            <p className={`text-[15px] ${MUTED}`}>
              {t.council.corpusNote(stats.meetings, stats.questions, stats.resolutions)}
            </p>
            <p className="mt-6 text-[15px] font-bold">{t.council.examplesLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {t.council.examples.map((ex) => (
                <li key={ex}>
                  <a href={url({ q: ex })} className={CHIP}>
                    {ex}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="max-w-[860px] space-y-10">
            {/* Said first and said plainly, before any consolation prizes. */}
            {nothingCounted && (
              <div className={`${CARD} p-6 text-center md:p-10`}>
                <p className="text-[20px] font-bold leading-[28px]">
                  {t.council.noResultsTitle}
                </p>
                <p className={`mt-2 ${MUTED}`}>{t.council.noResultsBody}</p>
              </div>
            )}

            {answer && answer.counted.length > 0 && (
              <section>
                {/* The number, said plainly. This is the whole point of the
                    page: not "here are some passages", but "three people". */}
                <p className="text-[24px] font-bold leading-[32px] tabular-nums md:text-[28px] md:leading-[36px]">
                  {t.council.peopleCount(answer.people)}
                </p>
                <p className={`mt-1 text-[15px] ${MUTED}`}>
                  {t.council.acrossMeetings(answer.meetings)}
                  <span aria-hidden="true"> · </span>
                  {t.council.interventionsCount(answer.counted.length)}
                </p>
                <p className={`mt-3 text-[14px] leading-[20px] ${MUTED}`}>
                  {t.council.countedNote}
                </p>
                {answer.expanded !== answer.query && (
                  <p className={`mt-1 text-[13px] leading-[20px] ${MUTED}`}>
                    {t.council.expandedNote(answer.expanded)}
                  </p>
                )}

                <ul className="mt-5 space-y-3">
                  {answer.counted.map((hit) => (
                    <li key={hit.id}>
                      <QuestionCard hit={hit} lang={lang} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {resolutions && resolutions.counted.length > 0 && (
              <section>
                <h2 className="text-[20px] font-bold leading-[28px] md:text-[24px]">
                  {t.council.resolutionsCount(resolutions.counted.length)}
                </h2>
                <ul className="mt-5 space-y-3">
                  {resolutions.counted.map((hit) => (
                    <li key={hit.id}>
                      <ResolutionCard hit={hit} lang={lang} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Kept below, and kept apart. These are worth reading and are not
                part of any number stated above. */}
            {answer && answer.related.length > 0 && (
              <section className="border-t border-[#dde5e1] pt-8">
                <h2 className="text-[20px] font-bold leading-[28px]">{t.council.relatedLabel}</h2>
                <p className={`mt-1 text-[14px] leading-[20px] ${MUTED}`}>
                  {t.council.relatedNote}
                </p>
                <ul className="mt-5 space-y-3">
                  {answer.related.map((hit) => (
                    <li key={hit.id}>
                      <QuestionCard hit={hit} lang={lang} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <p className={`mt-10 max-w-[860px] text-[13px] leading-[20px] ${MUTED}`}>
          {t.council.disclaimer}
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
