import { getDictionary, dateLocale, type Locale } from "@/utils/i18n";
import { formatMeetingDate, type RemarkHit } from "@/utils/council";
import { BARE_CONTROL, CARD, MUTED } from "@/components/ui/styles";

/**
 * One thing an elected member raised.
 *
 * Deliberately plainer than the resident card. A resident's intervention is an
 * event — someone came to a microphone — and the card gives it room. A
 * councillor's item is a line in their own report, one of half a dozen that
 * evening, so it reads as an entry rather than as a story.
 */
export function RemarkCard({ hit, lang }: { hit: RemarkHit; lang: Locale }) {
  const t = getDictionary(lang);

  const date = formatMeetingDate(hit.meetingDate, lang, dateLocale(lang));

  return (
    <article className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-[16px] font-bold leading-[22px] break-words">{hit.name}</p>
        <span className="shrink-0 rounded-full bg-[#faf1e8] px-2.5 py-1 text-[12px] font-bold text-[#6e6a72]">
          {hit.kind === "commentaire" ? t.council.badgeComment : t.council.badgeElusQuestion}
        </span>
      </div>

      <p className={`mt-1 text-[13px] leading-[18px] whitespace-nowrap ${MUTED}`}>{date}</p>

      <p className="mt-2 text-[16px] leading-[24px] break-words">{hit.topic}</p>

      {hit.pvUrl && (
        <a
          href={hit.pvUrl}
          target="_blank"
          rel="noreferrer"
          className={`${BARE_CONTROL} -mx-2 mt-1 inline-flex min-h-[44px] items-center px-2 text-[14px] font-bold text-[#fa3250] hover:underline`}
        >
          {t.council.readPv}
        </a>
      )}
    </article>
  );
}
