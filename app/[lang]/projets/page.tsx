import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssuePhoto } from "@/components/issues/issue-photo";
import { ProjectStatusTag } from "@/components/projects/project-timeline";
import { getSessionUser } from "@/utils/supabase/auth";
import { ALL_PROJECTS, say } from "@/utils/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CARD, CARD_INTERACTIVE, CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";

export default async function ProjectsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-[#fef7f0] text-[#1a1a1a]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          {/* 26px is the floor of the page-title scale and is what the narrowest
              phone gets: a French heading such as "État d'avancement" carries
              long words that have nowhere to break inside 288px of content. */}
          <h1 className="text-[26px] leading-[34px] break-words sm:text-[28px] sm:leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.pages.projectsTitle}
          </h1>
          <p className={`mt-3 max-w-[640px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.pages.projectsIntro}
          </p>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-12`}>
        {ALL_PROJECTS.length === 0 ? (
          <div className={`${CARD} px-6 py-10 text-center md:px-10`}>
            <p className="text-[18px] font-bold leading-[26px]">{t.projects.emptyTitle}</p>
            <p className={`mx-auto mt-2 max-w-[52ch] ${MUTED}`}>{t.projects.emptyBody}</p>
          </div>
        ) : (
          // One column on a phone, two from `md`. A project card leads with a
          // photograph, and three across makes each one too small to read as
          // one — which is the whole reason the photo is there.
          <ul className="grid gap-5 md:grid-cols-2">
            {ALL_PROJECTS.map((project) => {
              const lead = project.photos[0];
              return (
                <li key={project.slug}>
                  <Link
                    href={`/${lang}/projets/${project.slug}`}
                    className={`${CARD_INTERACTIVE} flex h-full flex-col overflow-hidden`}
                  >
                    {/* Whole rather than cropped, the same treatment a report's
                        photo gets — see IssuePhoto. */}
                    <IssuePhoto
                      src={lead.src}
                      alt=""
                      cap="max-h-[260px]"
                      sizes="(min-width: 768px) 560px, 100vw"
                    />

                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[19px] font-bold leading-[27px] break-words">
                          {say(project.title, lang)}
                        </h2>
                        <ProjectStatusTag status={project.status} lang={lang} />
                      </div>

                      <p className={`mt-1 text-[13px] leading-[18px] ${MUTED}`}>
                        {project.address}
                      </p>

                      <p className={`mt-3 text-[15px] leading-[23px] ${MUTED}`}>
                        {say(project.summary, lang)}
                      </p>

                      {/* Pushed to the bottom so cards of different summary
                          lengths still line their footers up. */}
                      <p className={`mt-auto pt-4 text-[13px] font-bold ${MUTED}`}>
                        {t.projects.milestoneCount(project.milestones.length)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
