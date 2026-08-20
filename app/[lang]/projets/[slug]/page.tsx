import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import { ContentViewTracker } from "@/components/analytics/content-view-tracker";
import { getSessionUser } from "@/utils/supabase/auth";
import { say } from "@/utils/projects";
import { projectBySlug } from "@/utils/supabase/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CARD, MUTED, PAGE_MAIN, PAGE_SHELL, READABLE } from "@/components/ui/styles";

/*
 * No `generateStaticParams` any more.
 *
 * It prerendered every project at build time, which was right while the list
 * was a constant in the repository: the set could not change between deploys.
 * It can now — the office publishes one through the waitlist and expects to see
 * it — and a build-time list would answer 404 for anything approved since the
 * last deploy. Rendered per request instead, which is also what the RLS on
 * `public.projects` needs to be able to tell a resident from an official.
 */

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const project = await projectBySlug(slug);
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
        <header className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 max-w-[820px]">
            <h1 className="text-[30px] font-semibold leading-[38px] tracking-[-0.025em] break-words md:text-[42px] md:leading-[50px]">
              {say(project.title, lang)}
            </h1>
            <p className={`mt-2 text-[14px] ${MUTED}`}>{project.address}</p>
            <p className="mt-4 max-w-[68ch] text-[17px] leading-[27px] text-[#4f4a50]">
              {say(project.summary, lang)}
            </p>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-[20px] font-semibold leading-[28px] tracking-[-0.01em] sm:text-[22px]">
            {t.projects.timeline}
          </h2>
          <div className="mt-3">
            <ProjectTimeline
              milestones={project.milestones}
              lang={lang}
              label={`${t.projects.timeline} : ${say(project.title, lang)}`}
            />
          </div>
        </section>

        <article className={`${CARD} mt-10 overflow-hidden`}>
          <IssuePhoto
            src={lead.src}
            alt={say(lead.caption, lang)}
            cap="max-h-[520px]"
            sizes="(min-width: 1024px) 1100px, 100vw"
          />

          <div className="p-5 md:p-7">
            {/* The lead photo's caption sits under the image rather than over
                it: laid on top it competes with the picture, and a caption that
                says "photographed in 1982" has to be readable or the picture is
                misleading. */}
            <p className={`text-[13px] leading-[19px] ${MUTED}`}>
              {say(lead.caption, lang)} <span className="opacity-70">· {lead.credit}</span>
            </p>

            <h2 className="mt-5 text-[20px] font-semibold leading-[28px] tracking-[-0.01em]">
              {t.projects.about}
            </h2>
            <div className={`${READABLE} mx-0 mt-3 space-y-4`}>
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
