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
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          {/* 26px is the floor of the page-title scale and is what the narrowest
              phone gets: a French heading such as "État d'avancement" carries
              long words that have nowhere to break inside 288px of content. */}
          <h1 className="text-[26px] font-bold leading-[34px] break-words sm:text-[28px] sm:leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.pages.projectsTitle}
          </h1>
          <p className={`mt-3 max-w-[640px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.pages.projectsIntro}
          </p>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-12`}>
        {/* Side padding is trimmed on a phone: 40px of it either way leaves the
            notice barely 200px to sit in, which reads as a mistake rather than
            as breathing room. The vertical padding keeps the card's proportion. */}
        <div className={`${CARD} px-6 py-10 text-center md:px-10`}>
          <p className={MUTED}>{t.pages.comingSoon}</p>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
