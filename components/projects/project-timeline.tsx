import { isPast, say, type Milestone, type ProjectStatus } from "@/utils/projects";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";

/**
 * Where a project stands, as a pill.
 *
 * Same shape as the status pill on a report, and the same rule: a dot as well
 * as a colour, because hue alone is not a signal for everyone. The vocabulary
 * is different on purpose — a report is answered, a project is decided.
 */
const STATUS_STYLE: Record<ProjectStatus, { pill: string; dot: string }> = {
  study: { pill: "bg-[#faf1e8] text-[#6e6a72]", dot: "bg-[#6e6a72]" },
  decided: { pill: "bg-[#fdf1e3] text-[#8a4d06]", dot: "bg-[#b8660a]" },
  underway: { pill: "bg-[#e4f2eb] text-[#0b6042]", dot: "bg-[#0b6042]" },
  done: { pill: "bg-[#e4f2eb] text-[#0b6042]", dot: "bg-[#0b6042]" },
};

export function ProjectStatusTag({ status, lang }: { status: ProjectStatus; lang: Locale }) {
  const t = getDictionary(lang);
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[12px] ${style.pill}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {t.projects.status[status]}
    </span>
  );
}

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
  }).format(new Date(m.on));
}

/** The full project history, in the page's natural reading direction. */
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
  const last = milestones.length - 1;

  return (
    <ol role="list" aria-label={label} className="overflow-hidden">
      {milestones.map((milestone, index) => {
        const done = isPast(milestone.on);
        return (
          <li
            key={`${milestone.on}-${say(milestone.title, lang)}`}
            className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-3 md:grid-cols-[132px_26px_minmax(0,1fr)] md:gap-x-4"
          >
            <p className={`hidden pt-5 text-right text-[12px] font-semibold leading-[18px] tracking-[0.02em] md:block ${MUTED}`}>
              {milestoneDate(milestone, lang)}
            </p>

            <div className="relative flex justify-center">
              {index > 0 && (
                <span aria-hidden="true" className="absolute inset-x-auto top-0 h-1/2 w-px bg-[#ddd5cd]" />
              )}
              {index < last && (
                <span aria-hidden="true" className="absolute inset-x-auto bottom-0 h-1/2 w-px bg-[#ddd5cd]" />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 mt-[22px] h-3 w-3 rounded-full ring-4 ring-white ${
                  done ? "bg-[#fa3250]" : "border-2 border-[#5d56b4] bg-white"
                }`}
              />
            </div>

            <div className={`min-w-0 py-4 ${index < last ? "border-b border-[#eee7df]" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
                <span className={`text-[12px] font-semibold leading-[18px] tracking-[0.02em] ${MUTED}`}>
                  {milestoneDate(milestone, lang)}
                </span>
                {!done && <UpcomingTag label={t.projects.upcoming} />}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <h3 className="text-[16px] font-semibold leading-[23px] tracking-[-0.005em] text-[#1a1a1a] md:text-[17px]">
                  {say(milestone.title, lang)}
                </h3>
                {!done && (
                  <span className="hidden md:inline-flex">
                    <UpcomingTag label={t.projects.upcoming} />
                  </span>
                )}
              </div>

              {milestone.body && (
                <p className={`mt-1.5 max-w-[70ch] text-[14px] leading-[21px] ${MUTED}`}>
                  {say(milestone.body, lang)}
                </p>
              )}

              {(milestone.resolution || milestone.source) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                  {milestone.resolution && (
                    <span className="rounded-full bg-[#f4eee8] px-2.5 py-1 font-semibold tabular-nums text-[#6e6a72]">
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
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function UpcomingTag({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#eeecfb] px-2 py-0.5 text-[10px] font-semibold text-[#5d56b4]">
      {label}
    </span>
  );
}
