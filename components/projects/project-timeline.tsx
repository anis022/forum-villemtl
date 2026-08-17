import { isPast, say, type Milestone } from "@/utils/projects";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";

/**
 * A milestone's date, printed at whatever precision it is actually known to.
 *
 * `onLabel` wins when it is there: "Été 2026" and "2009 – 2018" are the honest
 * renderings of dates that a formatter would otherwise have to invent a day
 * for. Everything else is derived, so a `YYYY` prints as a year rather than as
 * the 1st of January it would parse to.
 */
function milestoneDate(m: Milestone, lang: Locale): string {
  if (m.onLabel) return say(m.onLabel, lang);
  const locale = dateLocale(lang);
  if (m.on.length === 4) return m.on;
  if (m.on.length === 7) {
    const [y, mo] = m.on.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date(y, mo - 1, 1),
    );
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${m.on}T12:00:00`));
}

/**
 * Project progress as a briefing rather than a rail.
 *
 * The most recent fact answers "where are we?". Scheduled milestones answer
 * "what happens next?" in a row of cards. Older history is still complete, but
 * folded until somebody asks for it. No nested scroller and no timeline line.
 */
export function ProjectTimeline({
  milestones,
  lang,
  label,
}: {
  milestones: readonly Milestone[];
  lang: Locale;
  /** Names the chronology for assistive technology. */
  label: string;
}) {
  const t = getDictionary(lang);
  const completed = milestones.filter((milestone) => isPast(milestone.on));
  const upcoming = milestones.filter((milestone) => !isPast(milestone.on));
  const current = completed.at(-1) ?? milestones[0];
  const previous = completed.filter((milestone) => milestone !== current).reverse();

  return (
    <div aria-label={label} className="project-progress">
      <section className="overflow-hidden rounded-[16px] border border-[#e5ded7] bg-white">
        <div className="p-5 sm:p-6 lg:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5d56b4]">
            {t.projects.latestUpdate}
          </p>
          <p className="mt-2 text-[13px] font-semibold leading-[19px] text-[#6e6a72]">
            {milestoneDate(current, lang)}
          </p>
          <h3 className="mt-1 text-[20px] font-semibold leading-[28px] tracking-[-0.01em] text-[#1a1a1a] sm:text-[22px] sm:leading-[30px]">
            {say(current.title, lang)}
          </h3>
          {current.body && (
            <p className={`mt-2 max-w-[60ch] text-[15px] leading-[23px] ${MUTED}`}>
              {say(current.body, lang)}
            </p>
          )}
          <MilestoneReferences milestone={current} lang={lang} />
        </div>

        <div className="border-t border-[#e9e2dc] bg-[#f8f5f1] p-5 sm:p-6 lg:p-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-[#373238]">{t.projects.nextSteps}</h3>
            <span className="text-[12px] font-semibold text-[#8a858c] tabular-nums">{upcoming.length}</span>
          </div>
          {upcoming.length > 0 ? (
            <ol className="mt-3 grid gap-2.5 md:grid-cols-3">
              {upcoming.map((milestone, index) => (
                <li
                  key={`${milestone.on}-${say(milestone.title, lang)}`}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[12px] border border-[#e5ded7] bg-white p-3.5"
                >
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-[8px] bg-[#eeecfb] px-2 text-[12px] font-semibold text-[#5d56b4] tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-[18px] text-[#6e6a72]">
                      {milestoneDate(milestone, lang)}
                    </p>
                    <p className="mt-0.5 text-[14px] font-semibold leading-[20px] text-[#1a1a1a]">
                      {say(milestone.title, lang)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className={`mt-3 text-[14px] leading-[21px] ${MUTED}`}>
              {t.projects.status.done}
            </p>
          )}
        </div>
      </section>

      {previous.length > 0 && (
        <details className="group mt-3 overflow-hidden rounded-[14px] border border-[#e5ded7] bg-white">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[14px] font-semibold leading-[20px] text-[#373238]">
                {t.projects.previousSteps}
              </span>
              <span className={`block text-[12px] leading-[18px] ${MUTED}`}>
                {t.projects.historyCount(previous.length, milestoneDate(previous.at(-1)!, lang))}
              </span>
            </span>
            <svg className="h-4 w-4 shrink-0 text-[#5d56b4] transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m7 9 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <ol className="border-t border-[#e9e2dc] px-4 sm:px-5">
            {previous.map((milestone) => (
              <li
                key={`${milestone.on}-${say(milestone.title, lang)}`}
                className="grid gap-1 border-b border-[#eee7df] py-4 last:border-b-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-5"
              >
                <p className="text-[12px] font-semibold leading-[19px] text-[#6e6a72] tabular-nums">
                  {milestoneDate(milestone, lang)}
                </p>
                <div className="min-w-0">
                  <h4 className="text-[15px] font-semibold leading-[22px] text-[#1a1a1a]">
                    {say(milestone.title, lang)}
                  </h4>
                  {milestone.body && (
                    <p className={`mt-1 max-w-[68ch] text-[14px] leading-[21px] ${MUTED}`}>
                      {say(milestone.body, lang)}
                    </p>
                  )}
                  <MilestoneReferences milestone={milestone} lang={lang} />
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function MilestoneReferences({ milestone, lang }: { milestone: Milestone; lang: Locale }) {
  const t = getDictionary(lang);
  if (!milestone.resolution && !milestone.source) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
      {milestone.resolution && (
        <span className="rounded-[8px] bg-[#f4eee8] px-2.5 py-1 font-semibold tabular-nums text-[#6e6a72]">
          {t.projects.resolutionLabel(milestone.resolution)}
        </span>
      )}
      {milestone.source && (
        <a
          href={milestone.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#5d56b4] underline-offset-4 hover:text-[#fa3250] hover:underline"
        >
          {say(milestone.source.label, lang)}
        </a>
      )}
    </div>
  );
}
