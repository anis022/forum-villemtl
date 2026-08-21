import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProjectEditor } from "@/components/projects/project-editor";
import { getSessionUser } from "@/utils/supabase/auth";
import {
  pendingRevisionForProject,
  projectForEditingBySlug,
} from "@/utils/supabase/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import { MUTED, PAGE_MAIN, PAGE_SHELL } from "@/components/ui/styles";

/**
 * Edit the public page in the same visual language residents see.
 *
 * If the cron (or another staff member) already opened a proposal, that version
 * is the source of truth for the next change. Redirecting to it prevents a
 * second editor from starting from stale public content and lets the database's
 * one-pending-revision rule read as a useful continuation instead of an error.
 */
export default async function EditPublishedProjectPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const isOfficial = user?.role === "official";
  const target = isOfficial ? await projectForEditingBySlug(slug) : null;

  if (isOfficial && !target) notFound();

  if (target) {
    const pending = await pendingRevisionForProject(target.id);
    if (pending) redirect(`/${lang}/projets/revisions/${pending.id}`);
  }

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <main className={PAGE_MAIN}>
        {!isOfficial || !target ? (
          <p className={`text-[16px] ${MUTED}`}>{t.projectAdmin.onlyOffice}</p>
        ) : (
          <ProjectEditor
            lang={lang}
            revisionId={null}
            projectId={target.id}
            initialSlug={target.project.slug}
            initialContent={target.project}
            sourceNote={null}
          />
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
