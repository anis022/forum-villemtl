import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RevisionQueue } from "@/components/projects/revision-queue";
import { getSessionUser } from "@/utils/supabase/auth";
import { listPendingRevisions } from "@/utils/supabase/projects";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  BTN_PRIMARY,
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

/**
 * The projects waitlist.
 *
 * Gated twice, like /moderation and for the same reason. The page turns away
 * anyone who is not on the borough staff, and the SELECT policy on
 * `project_revisions` would hand them an empty list even if it did not. The
 * second is the one that holds; the first exists so the answer is a sentence
 * rather than a blank page that looks like good news.
 *
 * Not linked from anywhere a resident sees.
 */
export default async function RevisionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const isOfficial = user?.role === "official";
  const revisions = isOfficial ? await listPendingRevisions() : [];

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>{t.projectAdmin.queueTitle}</h1>
          <p className={PAGE_INTRO}>{t.projectAdmin.queueIntro}</p>
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {!isOfficial ? (
          <p className={`text-[16px] ${MUTED}`}>{t.projectAdmin.onlyOffice}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <Link className={BTN_PRIMARY} href={`/${lang}/projets/nouveau`}>
                {t.projectAdmin.newProject}
              </Link>
            </div>
            <RevisionQueue lang={lang} revisions={revisions} />
          </div>
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
