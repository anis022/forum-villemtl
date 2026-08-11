import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QuestionCard } from "@/components/council/question-card";
import { ResolutionCard } from "@/components/council/resolution-card";
import { RemarkCard } from "@/components/council/remark-card";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, dateLocale, isLocale } from "@/utils/i18n";
import { getMeeting } from "@/utils/supabase/council";
import { formatMeetingDate, youtubeDeepLink } from "@/utils/council";
import {
  BARE_CONTROL,
  BTN_SECONDARY,
  CARD,
  CONTAINER,
  HERO_BAND,
  MUTED,
} from "@/components/ui/styles";

/** A figure and its label, sized for the summary band. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[26px] leading-[32px] tabular-nums md:text-[30px] md:leading-[36px]">
        {value}
      </p>
      <p className={`text-[13px] leading-[18px] ${MUTED}`}>{label}</p>
    </div>
  );
}

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const [user, meeting] = await Promise.all([getSessionUser(), getMeeting(id)]);
  if (!meeting) notFound();

  const t = getDictionary(lang);
  const { summary: m, questions, resolutions, remarks } = meeting;

  const date = formatMeetingDate(m.meetingDate, lang, dateLocale(lang));

  const oral = questions.filter((q) => q.mode === "orale");
  const written = questions.filter((q) => q.mode === "ecrite");
  const comments = remarks.filter((r) => r.kind === "commentaire");
  const councilQuestions = remarks.filter((r) => r.kind === "question");

  return (
    <div className="flex min-h-screen flex-col bg-[#fef7f0] text-[#1a1a1a]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <Link
            href={`/${lang}/conseils`}
            className={`${BARE_CONTROL} -mx-2 inline-flex min-h-[44px] items-center px-2 text-[14px] font-bold text-[#fa3250] hover:underline`}
          >
            ← {t.council.backToCouncil}
          </Link>

          <h1 className="mt-1 text-[26px] leading-[34px] break-words sm:text-[30px] sm:leading-[38px] md:text-[40px] md:leading-[50px]">
            {date}
          </h1>
          <p className={`mt-2 text-[15px] leading-[22px] ${MUTED}`}>
            {m.kind ? `${t.council.sitting} ${m.kind}` : t.council.sitting}
            {m.president && (
              <>
                <span aria-hidden="true"> · </span>
                {t.council.presidedBy} <span className="font-bold">{m.president}</span>
                {m.presidentActing ? ` ${t.council.actingMayor}` : ""}
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={youtubeDeepLink(m.youtubeId, 0)}
              target="_blank"
              rel="noreferrer"
              className={BTN_SECONDARY}
            >
              {t.council.watchFull}
            </a>
            {m.pvUrl && (
              <a href={m.pvUrl} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                {t.council.readPv}
              </a>
            )}
            {m.odjUrl && (
              <a href={m.odjUrl} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                {t.council.readOdj}
              </a>
            )}
          </div>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        <div className="max-w-[860px] space-y-10">
          {/* Everything in this block is a count of rows from the minutes.
              Nothing is written prose, so it cannot say more than the record. */}
          <section className={`${CARD} p-5 md:p-6`}>
            <h2 className="text-[20px] font-bold leading-[28px]">{t.council.inBrief}</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure value={m.people} label={t.council.statPeople} />
              <Figure value={m.resolutions} label={t.council.statResolutions} />
              <Figure value={m.debates} label={t.council.statDebates} />
              <Figure value={m.remarks} label={t.council.statRemarks} />
            </div>

            <p className={`mt-4 text-[15px] leading-[24px] ${MUTED}`}>
              {t.council.briefLine(m.oral, m.written, m.unanimous, m.divided)}
            </p>

            {m.topSubjects.length > 0 && (
              <>
                <p className={`mt-4 text-[12px] font-bold uppercase tracking-wide ${MUTED}`}>
                  {t.council.mostRaised}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {m.topSubjects.map((s) => (
                    <li
                      key={s}
                      className="rounded-full bg-[#fde8eb] px-3 py-1.5 text-[14px] font-bold text-[#fa3250]"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {m.aligned > 0 && (
              <p className={`mt-4 text-[13px] leading-[20px] ${MUTED}`}>
                {t.council.alignedNote(m.aligned, m.oral)}
              </p>
            )}
          </section>

          {oral.length > 0 && (
            <section>
              <h2 className="text-[20px] leading-[28px] md:text-[24px]">
                {t.council.modeOrale} <span className={MUTED}>({oral.length})</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {oral.map((q) => (
                  <li key={q.id}>
                    <QuestionCard hit={q} lang={lang} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {written.length > 0 && (
            <section>
              <h2 className="text-[20px] leading-[28px] md:text-[24px]">
                {t.council.modeEcrite} <span className={MUTED}>({written.length})</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {written.map((q) => (
                  <li key={q.id}>
                    <QuestionCard hit={q} lang={lang} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {comments.length > 0 && (
            <section>
              <h2 className="text-[20px] leading-[28px] md:text-[24px]">
                {t.council.sectionElus} <span className={MUTED}>({comments.length})</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {comments.map((r) => (
                  <li key={r.id}>
                    <RemarkCard hit={r} lang={lang} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {councilQuestions.length > 0 && (
            <section>
              <h2 className="text-[20px] leading-[28px] md:text-[24px]">
                {t.council.councilQuestions}{" "}
                <span className={MUTED}>({councilQuestions.length})</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {councilQuestions.map((r) => (
                  <li key={r.id}>
                    <RemarkCard hit={r} lang={lang} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resolutions.length > 0 && (
            <section>
              <h2 className="text-[20px] leading-[28px] md:text-[24px]">
                {t.council.sectionResolutions}{" "}
                <span className={MUTED}>({resolutions.length})</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {resolutions.map((r) => (
                  <li key={r.id}>
                    <ResolutionCard hit={r} lang={lang} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <p className={`mt-10 max-w-[860px] text-[13px] leading-[20px] ${MUTED}`}>
          {t.council.disclaimer}
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
