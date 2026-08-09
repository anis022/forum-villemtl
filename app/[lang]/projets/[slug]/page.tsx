import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { ProjectStatusTag, ProjectTimeline } from "@/components/projects/project-timeline";
import { getSessionUser } from "@/utils/supabase/auth";
import { councilMentions } from "@/utils/supabase/council";
import { ALL_PROJECTS, projectBySlug, say } from "@/utils/projects";
import { formatTimestamp, youtubeDeepLink } from "@/utils/council";
import { dateLocale, getDictionary, isLocale } from "@/utils/i18n";
import { CARD, CONTAINER, MUTED, READABLE } from "@/components/ui/styles";

/** The list is a handful of hand-written entries; prerender all of them. */
export function generateStaticParams() {
  return ALL_PROJECTS.flatMap((p) => [
    { lang: "fr", slug: p.slug },
    { lang: "en", slug: p.slug },
  ]);
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const project = projectBySlug(slug);
  if (!project) notFound();

  const t = getDictionary(lang);
  const locale = dateLocale(lang);

  const [user, mentions] = await Promise.all([
    getSessionUser(),
    // Empty when the project names no term, and harmless when the council
    // tables have not been ingested — the section simply does not render.
    project.councilTerm
      ? councilMentions(project.councilTerm)
      : Promise.resolve({ questions: [], resolutions: [] }),
  ]);

  const [lead, ...rest] = project.photos;

  /* Counted over people and sittings, not over rows: the same resident asking
     twice at one sitting is one person, and the sentence has to survive that. */
  const people = new Set(mentions.questions.map((q) => q.personId ?? q.name)).size;
  const sittings = new Set(mentions.questions.map((q) => q.meetingDate)).size;

  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(`${iso}T12:00:00`),
    );

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

      <main className={`${CONTAINER} flex-1 py-6 md:py-10`}>
        <Link
          href={`/${lang}/projets`}
          className="text-[14px] font-bold text-[#097d6c] hover:underline"
        >
          {t.projects.back}
        </Link>

        {/* Name, then history, then everything else. The heading has to come
            first — a band of dates under a back link is not a page about
            anything — but the timeline comes before the photograph and the
            prose: what a resident opens this page to find out is where the
            thing stands and what happens next. */}
        <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-[34px] break-words md:text-[34px] md:leading-[42px]">
              {say(project.title, lang)}
            </h1>
            <p className={`mt-1 text-[15px] ${MUTED}`}>{project.address}</p>
          </div>
          <ProjectStatusTag status={project.status} lang={lang} />
        </header>

        <section className="mt-5">
          <h2 className="text-[18px] font-bold leading-[26px]">{t.projects.timeline}</h2>
          <div className={`${CARD} mt-3 px-3 py-5 sm:px-5`}>
            <ProjectTimeline
              milestones={project.milestones}
              lang={lang}
              label={`${t.projects.timeline} — ${say(project.title, lang)}`}
            />
          </div>
        </section>

        <article className={`${CARD} mt-8 overflow-hidden`}>
          <IssuePhoto
            src={lead.src}
            alt={say(lead.caption, lang)}
            cap="max-h-[520px]"
            sizes="(min-width: 1024px) 1100px, 100vw"
          />

          <div className="p-4 md:p-6">
            {/* The lead photo's caption sits under the image rather than over
                it: laid on top it competes with the picture, and a caption that
                says "photographed in 1982" has to be readable or the picture is
                misleading. */}
            <p className={`text-[13px] leading-[19px] ${MUTED}`}>
              {say(lead.caption, lang)} <span className="opacity-70">— {lead.credit}</span>
            </p>

            <div className={`${READABLE} mx-0 mt-5 space-y-4`}>
              {project.description.map((paragraph, i) => (
                <p key={i} className="max-w-[68ch] text-[17px] leading-[27px]">
                  {say(paragraph, lang)}
                </p>
              ))}
            </div>
          </div>
        </article>

        {rest.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[22px] font-bold leading-[30px] md:text-[26px]">
              {t.projects.photos}
            </h2>
            <ul className="mt-4 grid gap-5 sm:grid-cols-2">
              {rest.map((photo) => (
                <li key={photo.src} className={`${CARD} overflow-hidden`}>
                  <IssuePhoto
                    src={photo.src}
                    alt={say(photo.caption, lang)}
                    cap="max-h-[320px]"
                    sizes="(min-width: 640px) 560px, 100vw"
                  />
                  <div className="p-4">
                    <p className="text-[14px] leading-[21px]">{say(photo.caption, lang)}</p>
                    <p className={`mt-1.5 text-[12px] ${MUTED}`}>{photo.credit}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* What the borough's own record says, rather than what this page says
            about it. Only rendered when there is something in it. */}
        {project.councilTerm && mentions.questions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[22px] font-bold leading-[30px] md:text-[26px]">
              {t.projects.atCouncil}
            </h2>
            <p className={`mt-2 max-w-[68ch] text-[15px] leading-[23px] ${MUTED}`}>
              {t.projects.raisedIntro(people, sittings)}
            </p>

            <ul className="mt-4 space-y-3">
              {mentions.questions.map((q) => (
                <li key={q.id} className={`${CARD} p-4`}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
                    <span className={`font-bold ${MUTED}`}>{fmtDay(q.meetingDate)}</span>
                    <span aria-hidden="true" className={MUTED}>
                      ·
                    </span>
                    <span className="rounded-full bg-[#f2f6f4] px-2 py-0.5 text-[11px] font-bold text-[#5d6b66]">
                      {q.mode === "orale" ? t.projects.questionOrale : t.projects.questionEcrite}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[16px] font-bold leading-[23px] break-words">
                    {q.subject}
                  </p>
                  <p className={`mt-0.5 text-[14px] ${MUTED}`}>{q.name}</p>

                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    {/* Only when the alignment pass has placed this question in
                        the recording. Without a timestamp the link would open
                        a two-hour video at zero, which is not a citation. */}
                    {q.startS !== null && (
                      <a
                        href={youtubeDeepLink(q.youtubeId, q.startS)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#097d6c] underline hover:text-[#075f53]"
                      >
                        {formatTimestamp(q.startS)}
                      </a>
                    )}
                    {q.pvUrl && (
                      <a
                        href={q.pvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#097d6c] underline hover:text-[#075f53]"
                      >
                        {t.projects.readMinutes}
                      </a>
                    )}
                  </p>
                </li>
              ))}
            </ul>

            {mentions.resolutions.length === 0 && (
              <p className={`mt-4 max-w-[68ch] text-[15px] leading-[23px] ${MUTED}`}>
                {t.projects.noResolutions}
              </p>
            )}
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-[22px] font-bold leading-[30px] md:text-[26px]">
            {t.projects.sources}
          </h2>
          <ul className={`${CARD} mt-4 divide-y divide-[#eef2f0]`}>
            {project.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-words px-4 py-3.5 text-[15px] font-bold text-[#097d6c] hover:bg-[#f2f6f4] hover:text-[#075f53]"
                >
                  {say(source.label, lang)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
