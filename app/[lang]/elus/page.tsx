import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { OFFICIALS } from "@/utils/officials";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  CARD_INTERACTIVE,
  HERO_BAND,
  LINK,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

export default async function OfficialsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>
            {t.officials.title}
          </h1>
          <p className={PAGE_INTRO}>{t.officials.intro}</p>
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {/* One column on a phone, two from `sm`. Three would fit at `lg`, and a
            council of four would then sit as a row of three and a widow. */}
        <ul className="grid gap-4 sm:grid-cols-2">
          {OFFICIALS.map((person) => (
            <li key={person.slug}>
              {/* Straight to their forum profile — the same page every
                  resident has, carrying their public function and whatever
                  they have posted. Not a page of their own, and not a bounce
                  out to montreal.ca mid-visit. */}
              <Link
                href={`/${lang}/profil/${person.slug}`}
                className={`${CARD_INTERACTIVE} flex h-full items-start gap-4 p-4 sm:p-5`}
              >
                <Image
                  src={`/elus/${person.slug}.jpg`}
                  alt=""
                  width={96}
                  height={96}
                  className="h-16 w-16 shrink-0 rounded-full border-[0.8px] border-[#e9e0d6] object-cover sm:h-20 sm:w-20"
                />

                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-bold leading-[24px] break-words">
                    {person.name}
                  </h2>

                  {/* The role in the accent, the district under it in plain
                      text: "conseiller de Snowdon" is two facts, and a resident
                      is scanning for the second one. */}
                  <p className="mt-1 text-[14px] font-bold leading-[20px] text-[#fa3250]">
                    {t.officials.roles[person.role]}
                  </p>
                  {/* Only when there is one. A borough mayor has no district,
                      and her title already says the scope. */}
                  {person.district && (
                    <p className={`mt-0.5 text-[14px] leading-[20px] ${MUTED}`}>
                      {t.officials.district(person.district)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Where the list came from, and when. A page of names with no date on
            it is indistinguishable from a page of names that went stale. */}
        <p className={`mt-6 text-[13px] leading-[19px] ${MUTED}`}>
          {t.officials.sourceNote}{" "}
          <a
            href="https://montreal.ca/personnes-elues?dc_coverage.boroughs.code=CDNNDG"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            montreal.ca
            <span className="sr-only"> {t.footer.newWindow}</span>
          </a>
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
