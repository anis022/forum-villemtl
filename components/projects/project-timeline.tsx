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

/**
 * The history of a project, oldest first, read left to right.
 *
 * Horizontal because that is the shape people already read a timeline in, and
 * because it lets the whole span of a project — 1927 to 2027, here — be taken
 * in at once instead of scrolled through. A vertical rail of eleven steps is a
 * page of its own; laid across, it is a band you can see the ends of.
 *
 * The cost is that it cannot fit a phone, so the band scrolls inside itself.
 * That is the one place this site allows sideways scrolling: the container has
 * `overflow-x-auto` and the page body still does not move. It is focusable and
 * labelled, so it can be scrolled with a keyboard rather than only by dragging.
 *
 * Filled dots are things that happened; hollow ones are scheduled, and carry
 * the word as well as the shape so the distinction survives being printed, or
 * read by someone who cannot see it.
 */
export function ProjectTimeline({
  milestones,
  lang,
  label,
}: {
  milestones: readonly Milestone[];
  lang: Locale;
  /** Names the scrollable region for assistive technology. */
  label: string;
}) {
  const t = getDictionary(lang);
  const last = milestones.length - 1;

  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto overscroll-x-contain pb-3"
    >
      {/* `min-w-max` keeps the steps at their natural width so the row
          overflows and scrolls, rather than squeezing eleven columns into
          320px and rendering each one two words wide. */}
      <ol className="flex min-w-max items-start">
        {milestones.map((m, i) => {
          const done = isPast(m.on);
          return (
            <li
              key={`${m.on}-${say(m.title, lang)}`}
              className="flex w-[196px] shrink-0 flex-col px-2 sm:w-[232px] sm:px-3"
            >
              {/* The rail: two half-segments per step, so the line stops at the
                  first and last dot instead of running off both ends. */}
              <div className="relative flex h-3 items-center">
                {i > 0 && (
                  <span aria-hidden="true" className="absolute left-0 right-1/2 h-px bg-[#e9e0d6]" />
                )}
                {i < last && (
                  <span aria-hidden="true" className="absolute left-1/2 right-0 h-px bg-[#e9e0d6]" />
                )}
                <span
                  aria-hidden="true"
                  className={`relative left-1/2 z-10 h-[11px] w-[11px] -translate-x-1/2 rounded-full ${
                    done ? "bg-[#fa3250]" : "border-2 border-[#a09a94] bg-white"
                  }`}
                />
              </div>

              <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`text-[12px] font-bold uppercase tracking-[0.04em] ${MUTED}`}>
                  {milestoneDate(m, lang)}
                </span>
                {!done && (
                  <span className="rounded-full bg-[#faf1e8] px-1.5 py-0.5 text-[10px] font-bold text-[#6e6a72]">
                    {t.projects.upcoming}
                  </span>
                )}
              </p>

              {/* Two lines, as a backstop. A step's label is meant to be short
                  — the prose lives in the description — and one five-line title
                  was setting the height of every column in the band. */}
              <h3 className="mt-1 line-clamp-2 text-[15px] font-bold leading-[21px] break-words">
                {say(m.title, lang)}
              </h3>

              {/* Clamped, and the columns are top-aligned rather than
                  stretched: one milestone here carries a paragraph, and letting
                  it set the height left every short column trailing a hundred
                  and fifty pixels of nothing under two lines of text. */}
              {m.body && (
                <p className={`mt-1.5 line-clamp-3 text-[13px] leading-[19px] ${MUTED}`}>
                  {say(m.body, lang)}
                </p>
              )}

              {/* The receipt. A milestone a reader cannot check is a claim. */}
              {(m.resolution || m.source) && (
                <p className="mt-2 flex flex-col items-start gap-1 text-[12px]">
                  {m.resolution && (
                    <span className="rounded-[6px] bg-[#faf1e8] px-1.5 py-0.5 font-bold tabular-nums text-[#6e6a72]">
                      {t.projects.resolutionLabel(m.resolution)}
                    </span>
                  )}
                  {m.source && (
                    <a
                      href={m.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#fa3250] underline hover:text-[#d81f3c]"
                    >
                      {say(m.source.label, lang)}
                    </a>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
