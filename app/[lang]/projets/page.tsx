import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";
import { CARD, CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <h1 className="text-[28px] font-bold leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.pages.projectsTitle}
          </h1>
          <p className={`mt-3 max-w-[640px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.pages.projectsIntro}
          </p>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-12`}>
        <div className={`${CARD} p-10 text-center`}>
          <p className={MUTED}>{t.pages.comingSoon}</p>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
