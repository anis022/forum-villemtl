import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NewIssueForm } from "@/components/issues/new-issue-form";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";

export default async function NewIssuePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  // Guarded here as well as in the action: an anonymous visitor should never
  // see the composer at all.
  if (!user) redirect(`/${lang}`);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-10`}>
          <Link href={`/${lang}`} className="text-[14px] font-bold text-[#097d6c] hover:underline">
            {t.issue.back}
          </Link>
          <h1 className="mt-3 text-[28px] font-bold leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.issue.newTitle}
          </h1>
          <p className={`mt-2 max-w-[640px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.issue.newSubtitle}
          </p>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        <NewIssueForm lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
