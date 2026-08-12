import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { ProjectStatusTag, ProjectTimeline } from "@/components/projects/project-timeline";
import { ContentViewTracker } from "@/components/analytics/content-view-tracker";
import { getSessionUser } from "@/utils/supabase/auth";
import { ALL_PROJECTS, projectBySlug, say } from "@/utils/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CARD, MUTED, PAGE_MAIN, PAGE_SHELL, READABLE } from "@/components/ui/styles";

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
  const user = await getSessionUser();

  const [lead, ...rest] = project.photos;

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />
      <ContentViewTracker contentType="project" contentId={project.slug} />

      <main className={PAGE_MAIN}>
        <Link
          href={`/${lang}/projets`}
          className="text-[14px] font-bold text-[#fa3250] hover:underline"
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
            <h1 className="text-[26px] leading-[34px] break-words md:text-[34px] md:leading-[42px]">
              {say(project.title, lang)}
            </h1>
            <p className={`mt-1 text-[15px] ${MUTED}`}>{project.address}</p>
          </div>
          <ProjectStatusTag status={project.status} lang={lang} />
        </header>

        <section className="mt-5">
          <h2 className="text-[18px] font-bold leading-[26px]">{t.projects.timeline}</h2>
          <div className={`${CARD} mt-3 overflow-hidden px-4 sm:px-6 lg:px-8`}>
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
            <h2 className="text-[22px] leading-[30px] md:text-[26px]">
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

        <section className="mt-10">
          <h2 className="text-[22px] leading-[30px] md:text-[26px]">
            {t.projects.sources}
          </h2>
          <ul className={`${CARD} mt-4 divide-y divide-[#f2ece4]`}>
            {project.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-words px-4 py-3.5 text-[15px] font-bold text-[#fa3250] hover:bg-[#faf1e8] hover:text-[#d81f3c]"
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
