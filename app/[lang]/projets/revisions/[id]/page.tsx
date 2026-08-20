import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProjectEditor } from "@/components/projects/project-editor";
import { getSessionUser } from "@/utils/supabase/auth";
import { revisionById } from "@/utils/supabase/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

/** Finishing one proposal — usually a cron draft that needs a photo and a date. */
export default async function EditRevisionPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const isOfficial = user?.role === "official";
  const revision = isOfficial ? await revisionById(id) : null;

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>
            {revision?.content.title.fr || t.projectAdmin.queueTitle}
          </h1>
          {revision && (
            <p className={PAGE_INTRO}>
              {revision.origin === "cron"
                ? t.projectAdmin.fromCron
                : t.projectAdmin.fromStaff}
            </p>
          )}
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {!isOfficial ? (
          <p className={`text-[16px] ${MUTED}`}>{t.projectAdmin.onlyOffice}</p>
        ) : !revision ? (
          <p className={`text-[16px] ${MUTED}`}>{t.projectAdmin.empty}</p>
        ) : (
          <ProjectEditor
            lang={lang}
            revisionId={revision.id}
            projectId={revision.projectId}
            initialSlug={revision.slug}
            initialContent={revision.content}
            sourceNote={revision.sourceNote}
          />
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
