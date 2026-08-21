import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NewIssueForm } from "@/components/issues/new-issue-form";
import { getSessionContext } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

export default async function NewIssuePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const { user, canParticipate } = await getSessionContext();
  // Guarded here as well as in the action: an anonymous visitor should never
  // see the composer at all.
  if (!canParticipate) redirect(`/${lang}`);

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <Link href={`/${lang}`} className="text-[14px] font-bold text-[#fa3250] hover:underline">
            {t.issue.back}
          </Link>
          <h1 className={`${PAGE_TITLE} mt-3`}>
            {t.issue.newTitle}
          </h1>
          <p className={`mt-2 max-w-[640px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.issue.newSubtitle}
          </p>
        </div>
      </div>

      <main className={PAGE_MAIN}>
        <NewIssueForm lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
