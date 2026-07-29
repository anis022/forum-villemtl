import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EditIssueForm } from "@/components/issues/edit-issue-form";
import { getSessionUser } from "@/utils/supabase/auth";
import { getIssue } from "@/utils/supabase/issues";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CONTAINER, MUTED, READABLE } from "@/components/ui/styles";

export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const [user, issue] = await Promise.all([getSessionUser(), getIssue(id)]);
  if (!issue) notFound();

  // Checked here so an unauthorised visitor lands back on the report rather
  // than on a form that would fail on submit. RLS is still the real backstop.
  const isAuthor = user?.id === issue.author.id;
  const isOfficial = user?.role === "official";
  if (!user || (!isAuthor && !isOfficial)) redirect(`/${lang}/sujets/${id}`);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        <div className={READABLE}>
          <Link
            href={`/${lang}/sujets/${id}`}
            className="text-[14px] font-bold text-[#097d6c] hover:underline"
          >
            {t.issue.backToIssue}
          </Link>

          <h1 className="mt-4 text-[26px] font-bold leading-[34px] md:text-[30px] md:leading-[38px]">
            {t.issue.editTitle}
          </h1>
          <p className={`mt-2 text-[16px] leading-[24px] ${MUTED}`}>{t.issue.editSubtitle}</p>

          <div className="mt-6">
            <EditIssueForm issue={issue} lang={lang} actingAsOfficial={!isAuthor && isOfficial} />
          </div>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
