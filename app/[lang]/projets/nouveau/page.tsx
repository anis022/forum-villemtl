import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BLANK, ProjectEditor } from "@/components/projects/project-editor";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

/** Writing a project from nothing, which the office may do without the cron. */
export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const isOfficial = user?.role === "official";

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>{t.projectAdmin.newProject}</h1>
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {!isOfficial ? (
          <p className={`text-[16px] ${MUTED}`}>{t.projectAdmin.onlyOffice}</p>
        ) : (
          <ProjectEditor
            lang={lang}
            revisionId={null}
            projectId={null}
            initialSlug=""
            initialContent={BLANK}
            sourceNote={null}
          />
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
