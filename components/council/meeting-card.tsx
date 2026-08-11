import Link from "next/link";
import { getDictionary, dateLocale, type Locale } from "@/utils/i18n";
import { formatMeetingDate, type MeetingSummary } from "@/utils/council";
import { CARD_INTERACTIVE, MUTED } from "@/components/ui/styles";

/**
 * One number and what it counts, side by side.
 *
 * `tabular-nums` because these sit in a row and a proportional 1 makes a column
 * of figures look bent.
 */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[22px] leading-[28px] tabular-nums">{value}</p>
      <p className={`text-[12px] leading-[16px] ${MUTED}`}>{label}</p>
    </div>
  );
}

/**
 * A sitting, at a glance.
 *
 * The whole card is a link, so the target is the card rather than a small
 * "read more" at the bottom of it. What it leads with is the count of people
 * rather than of resolutions: thirty-eight residents turning up is the fact
 * that tells you what kind of evening it was.
 */
export function MeetingCard({ m, lang }: { m: MeetingSummary; lang: Locale }) {
  const t = getDictionary(lang);

  const date = formatMeetingDate(m.meetingDate, lang, dateLocale(lang));

  return (
    <Link
      href={`/${lang}/conseils/${m.youtubeId}`}
      className={`${CARD_INTERACTIVE} block p-4 no-underline`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[19px] font-bold leading-[26px]">{date}</h3>
        {m.durationS ? (
          <span className={`text-[13px] tabular-nums ${MUTED}`}>
            {Math.round(m.durationS / 60)} min
          </span>
        ) : null}
      </div>

      {m.president && (
        <p className={`mt-0.5 text-[13px] leading-[18px] ${MUTED}`}>
          {t.council.presidedBy}{" "}
          <span className="font-bold">{m.president}</span>
          {m.presidentActing ? ` ${t.council.actingMayor}` : ""}
        </p>
      )}

      {/* The most recent sitting is always recorded before it is written up:
          the borough approves its minutes at the *next* meeting. Three zeroes
          would read as an empty evening rather than as paperwork pending, so
          the card says which it is. */}
      {m.pvUrl === null ? (
        <p className={`mt-3 text-[14px] leading-[20px] ${MUTED}`}>{t.council.pvPending}</p>
      ) : (
        /* Three figures, always in the same order so the eye can compare one
           sitting against another without reading the labels again. */
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value={m.people} label={t.council.statPeople} />
          <Stat value={m.resolutions} label={t.council.statResolutions} />
          <Stat value={m.remarks} label={t.council.statRemarks} />
        </div>
      )}

      {m.topSubjects.length > 0 && (
        <div className="mt-3">
          <p className={`text-[12px] font-bold uppercase tracking-wide ${MUTED}`}>
            {t.council.mostRaised}
          </p>
          <ul className="mt-1 space-y-0.5">
            {m.topSubjects.slice(0, 2).map((s) => (
              <li key={s} className="text-[14px] leading-[20px] break-words">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Only worth saying when it happened: on most sittings the council votes
          together, so a split is the exception and reads as one. */}
      {m.divided > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#fdeaf2] px-2.5 py-1 text-[12px] font-bold text-[#b3122c]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6337a]" aria-hidden="true" />
          {t.council.dividedCount(m.divided)}
        </p>
      )}
    </Link>
  );
}
