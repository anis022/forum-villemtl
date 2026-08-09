import { getDictionary, dateLocale, type Locale } from "@/utils/i18n";
import { formatTimestamp, youtubeDeepLink, type ResolutionHit } from "@/utils/council";
import { BARE_CONTROL, CARD, MUTED } from "@/components/ui/styles";

/**
 * Adopted or rejected, said with a dot as well as a colour.
 *
 * Hue alone is not a signal for everyone, and this is the one piece of
 * information on the card that a reader is scanning for.
 */
function OutcomeTag({ outcome }: { outcome: string }) {
  const rejected = /rejet|retir/i.test(outcome);
  const tone = rejected
    ? "bg-[#fdeceb] text-[#a4231f]"
    : "bg-[#e2f0ec] text-[#097d6c]";
  const dot = rejected ? "bg-[#d94f45]" : "bg-[#097d6c]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${tone}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {outcome}
    </span>
  );
}

/**
 * One decision of the council.
 *
 * The resolution number leads, because that is how the borough itself refers to
 * a decision and how a resident will find it again in the minutes. The agenda
 * code beside it is what the item was called on the ordre du jour.
 */
export function ResolutionCard({ hit, lang }: { hit: ResolutionHit; lang: Locale }) {
  const t = getDictionary(lang);

  const date = new Intl.DateTimeFormat(dateLocale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(hit.meetingDate + "T00:00:00"));

  return (
    <article className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
        <span className="font-bold tabular-nums text-[#097d6c]">{hit.number}</span>
        {hit.agendaCode && (
          <span className={`tabular-nums ${MUTED}`}>{hit.agendaCode}</span>
        )}
        <span className={`whitespace-nowrap ${MUTED}`}>{date}</span>
        {hit.outcome && <OutcomeTag outcome={hit.outcome} />}
      </div>

      <h3 className="mt-2 text-[17px] font-bold leading-[24px] break-words">{hit.title}</h3>

      {hit.body && (
        <p className="mt-2 text-[15px] leading-[24px] break-words">{hit.body}</p>
      )}

      {hit.movedBy && (
        <p className={`mt-2 text-[13px] leading-[20px] ${MUTED}`}>
          {t.council.movedBy} <span className="font-bold">{hit.movedBy}</span>
          {hit.secondedBy && (
            <>
              , {t.council.secondedBy} <span className="font-bold">{hit.secondedBy}</span>
            </>
          )}
          {hit.debate && (
            <>
              <span aria-hidden="true"> · </span>
              {t.council.debate}
            </>
          )}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        {hit.startS !== null && (
          <a
            href={youtubeDeepLink(hit.youtubeId, hit.startS)}
            target="_blank"
            rel="noreferrer"
            className={`${BARE_CONTROL} -mx-2 inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[14px] font-bold text-[#097d6c] hover:underline`}
          >
            {t.council.watch}
            <span className={MUTED}>{formatTimestamp(hit.startS)}</span>
          </a>
        )}
        {hit.pvUrl && (
          <a
            href={hit.pvUrl}
            target="_blank"
            rel="noreferrer"
            className={`${BARE_CONTROL} -mx-2 inline-flex min-h-[44px] items-center px-2 text-[14px] font-bold text-[#097d6c] hover:underline`}
          >
            {t.council.readPv}
          </a>
        )}
        {hit.odjUrl && (
          <a
            href={hit.odjUrl}
            target="_blank"
            rel="noreferrer"
            className={`${BARE_CONTROL} -mx-2 inline-flex min-h-[44px] items-center px-2 text-[14px] font-bold text-[#097d6c] hover:underline`}
          >
            {t.council.readOdj}
          </a>
        )}
      </div>
    </article>
  );
}
