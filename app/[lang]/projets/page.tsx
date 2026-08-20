import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { isPast, say } from "@/utils/projects";
import { listProjects } from "@/utils/supabase/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  CARD,
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
  LINK,
} from "@/components/ui/styles";

export default async function ProjectsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const projects = await listProjects();

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          {/* Long French words still break safely inside the shared page-title
              measure on the narrowest supported phone. */}
          <h1 className={PAGE_TITLE}>
            {t.pages.projectsTitle}
          </h1>
          <p className={PAGE_INTRO}>{t.pages.projectsIntro}</p>
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {/* The only way into the waitlist, and it appears for nobody else. A
            resident who somehow reaches that URL is told it is not for them,
            but the link itself would just be a dead end in their way. */}
        {user?.role === "official" && (
          <p className="mb-5">
            <Link className={LINK} href={`/${lang}/projets/revisions`}>
              {t.projectAdmin.queueTitle}
            </Link>
          </p>
        )}

        {projects.length === 0 ? (
          <div className={`${CARD} px-6 py-10 text-center md:px-10`}>
            <p className="text-[18px] font-bold leading-[26px]">{t.projects.emptyTitle}</p>
            <p className={`mx-auto mt-2 max-w-[52ch] ${MUTED}`}>{t.projects.emptyBody}</p>
          </div>
        ) : (
          // One column on a phone, two from `md`. A project card leads with a
          // photograph, and three across makes each one too small to read as
          // one — which is the whole reason the photo is there.
          <ul className="space-y-5">
            {projects.map((project) => {
              const lead = project.photos[0];
              const upcoming = project.milestones.filter((milestone) => !isPast(milestone.on)).length;
              return (
                <li key={project.slug}>
                  <Link
                    href={`/${lang}/projets/${project.slug}`}
                    className="group grid overflow-hidden rounded-[18px] border border-[#e5ded7] bg-white shadow-[0_2px_8px_rgba(31,22,16,0.05)] transition-shadow hover:shadow-[0_8px_24px_rgba(31,22,16,0.09)] md:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]"
                  >
                    {/* Whole rather than cropped, the same treatment a report's
                        photo gets — see IssuePhoto. */}
                    <div className="relative min-h-[230px] overflow-hidden bg-[#eee8e1] md:min-h-[360px]">
                      <Image
                        src={lead.src}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 560px, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>

                    <div className="flex min-w-0 flex-col p-5 sm:p-7 md:p-8 lg:p-9">
                      <div>
                        <h2 className="text-[24px] font-semibold leading-[31px] tracking-[-0.015em] break-words sm:text-[28px] sm:leading-[36px]">
                          {say(project.title, lang)}
                        </h2>
                      </div>

                      <p className={`mt-1 text-[13px] leading-[18px] ${MUTED}`}>
                        {project.address}
                      </p>

                      <p className={`mt-5 max-w-[58ch] text-[16px] leading-[25px] ${MUTED}`}>
                        {say(project.summary, lang)}
                      </p>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-7">
                        <span className="text-[13px] font-medium text-[#6e6a72]">
                          {upcoming > 0
                            ? `${upcoming} ${t.projects.nextSteps.toLocaleLowerCase(lang)}`
                            : t.projects.status.done}
                        </span>
                        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#fa3250]">
                          {t.projects.viewProject}
                          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
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
