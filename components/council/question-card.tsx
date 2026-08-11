import { getDictionary, dateLocale, type Locale } from "@/utils/i18n";
import {
  formatMeetingDate,
  formatTimestamp,
  youtubeDeepLink,
  type QuestionHit,
} from "@/utils/council";
import { BARE_CONTROL, CARD, MUTED } from "@/components/ui/styles";

/** Play glyph — the control opens the recording at this person's moment. */
function PlayIcon() {
  return (
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
  );
}

function DocIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/**
 * One resident's intervention.
 *
 * Leads with the person, the way a post does — this is somebody who came to a
 * microphone on a Monday evening, not a search result. The subject beneath
 * their name is the clerk's own wording from the minutes; the quote below it is
 * what they actually said. Keeping the two visibly apart matters: one is
 * official and exact, the other is a machine's best reading of the audio.
 */
export function QuestionCard({ hit, lang }: { hit: QuestionHit; lang: Locale }) {
  const t = getDictionary(lang);

  const date = formatMeetingDate(hit.meetingDate, lang, dateLocale(lang));

  return (
    <article className={`${CARD} p-4`}>
      {/* Name and badge share the top line, and the badge is allowed to drop
          below the name rather than squeezing it — at 320px "Marc-Étienne
          Lévesque" beside "Question écrite" leaves neither one legible. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-[17px] font-bold leading-[24px] break-words">{hit.name}</p>
        <span className="shrink-0 rounded-full bg-[#fde8eb] px-2.5 py-1 text-[12px] font-bold text-[#fa3250]">
          {hit.mode === "orale" ? t.council.badgeOrale : t.council.badgeEcrite}
        </span>
      </div>

      {/* Date and moment are one unit: allowed to wrap between them, the
          separator ends up stranded at the edge of a line. */}
      <p className={`mt-1 text-[13px] leading-[18px] ${MUTED}`}>
        <span className="whitespace-nowrap">
          {date}
          {hit.startS !== null && (
            <>
              <span aria-hidden="true"> · </span>
              {formatTimestamp(hit.startS)}
            </>
          )}
        </span>
      </p>

      <p className={`mt-3 text-[12px] font-bold uppercase tracking-wide ${MUTED}`}>
        {t.council.subjectLabel}
      </p>
      <p className="mt-1 text-[16px] leading-[24px] break-words">{hit.subject}</p>

      {hit.excerpt && (
        <>
          <p className={`mt-3 text-[12px] font-bold uppercase tracking-wide ${MUTED}`}>
            {t.council.verbatimLabel}
          </p>
          {/* Verbatim, set apart by a rule rather than quotation marks so the
              machine's reading is never mistaken for the official record. */}
          <blockquote className="mt-1 border-l-2 border-[#ddd2c5] pl-3 text-[15px] leading-[24px] break-words">
            {hit.excerpt}
          </blockquote>
        </>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        {hit.startS !== null ? (
          // The link carries its own 44px box and pulls back by the padding
          // that creates it, so it stays flush while still being a thumb target.
          <a
            href={youtubeDeepLink(hit.youtubeId, hit.startS)}
            target="_blank"
            rel="noreferrer"
            className={`${BARE_CONTROL} -mx-2 inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[14px] font-bold text-[#fa3250] hover:underline`}
          >
            <PlayIcon />
            {t.council.watch}
          </a>
        ) : (
          <span className={`inline-flex min-h-[44px] items-center text-[13px] ${MUTED}`}>
            {t.council.notAligned}
          </span>
        )}

        {hit.pvUrl && (
          <a
            href={hit.pvUrl}
            target="_blank"
            rel="noreferrer"
            className={`${BARE_CONTROL} -mx-2 inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[14px] font-bold text-[#fa3250] hover:underline`}
          >
            <DocIcon />
            {t.council.readPv}
          </a>
        )}
      </div>
    </article>
  );
}
