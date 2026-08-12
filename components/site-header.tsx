import Image from "next/image";
import Link from "next/link";
import { AccountButton } from "@/components/auth/account-button";
import { MainMenu } from "@/components/main-menu";
import { LanguageToggle } from "@/components/language-toggle";
import { HeaderSearchButton } from "@/components/header-search-button";
import type { SessionUser } from "@/utils/supabase/auth";
import { countOpenFlags } from "@/utils/supabase/moderation";
import { getDictionary, type Locale } from "@/utils/i18n";

/**
 * The masthead used to be montreal.ca's, measured off the live site down to the
 * 32px near-black utility bar and the 0.8px #ced4da rule. It is ensemblemtl.org's
 * now, measured off theirs:
 *
 *   - an aubergine (#32004a) utility strip carrying search and language, the
 *     small things that are not navigation
 *   - a cream (#fef7f0) nav row: wordmark left, sections spelt out in indigo,
 *     and the resident's account on the right
 *
 * Two tiers, like the old one — but that shape was never the problem. The
 * problem was that it was the city's near-black over the city's white with the
 * city's blue focus ring, which is a different object entirely.
 *
 * The sections only fit on one line from `lg`; below that MainMenu collapses
 * them into the hamburger and its panel. Reporting an issue stays in the
 * forum's own hero, where its purpose and context are clear, rather than being
 * repeated as a global action on every page.
 *
 * Sticky rather than fixed: same result without the body-padding maths, and it
 * survives the page-blur filter the auth modal applies.
 */
export async function SiteHeader({
  user,
  lang,
}: {
  user: SessionUser | null;
  lang: Locale;
}) {
  const t = getDictionary(lang);

  // Counted only for the people the menu will show it to, so an ordinary
  // visitor's masthead costs exactly what it did before.
  const moderationCount = user?.role === "official" ? await countOpenFlags() : null;

  return (
    <div className="sticky top-0 z-50">
      <div className="bg-[#32004a]">
        <div className="flex h-10 items-center justify-end gap-1 px-2 md:px-6">
          <HeaderSearchButton lang={lang} label={t.header.search} />
          <LanguageToggle lang={lang} label={t.header.otherLanguage} />
        </div>
      </div>

      {/* relative: the mega-menu panel drops out of this element full-bleed. */}
      <header className="relative border-b border-[#e9e0d6] bg-[#fef7f0]">
        <div className="flex items-center gap-2 px-4 py-3 md:gap-4 md:px-8">
          <Link href={`/${lang}`} className="flex min-w-0 shrink items-center">
            {/* The one element allowed to shrink: on a 320px screen everything
                in this row is a target, and a slightly smaller wordmark costs
                less than a masthead that overflows.
                These heights set --masthead-h in globals.css — re-measure if
                they change. */}
            <Image
              src="/logo-ensemble-mtl.png"
              alt="Ensemble Montréal"
              width={469}
              height={166}
              priority
              className="h-9 w-auto max-w-full object-contain object-left sm:h-10 md:h-12"
            />
          </Link>

          <MainMenu
            lang={lang}
            labels={{
              ...t.nav,
              menu: t.header.menu,
              sections: t.nav.sections,
              moderation: t.moderation.navLabel,
              moderationDesc: t.moderation.intro,
            }}
            moderationCount={moderationCount}
          />

          <div className="ml-auto flex shrink-0 items-center">
            <AccountButton initialUser={user} lang={lang} />
          </div>
        </div>
      </header>
    </div>
  );
}
