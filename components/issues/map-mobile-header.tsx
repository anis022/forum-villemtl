import Image from "next/image";
import Link from "next/link";
import { AccountButton } from "@/components/auth/account-button";
import { MainMenu } from "@/components/main-menu";
import { getDictionary, type Locale } from "@/utils/i18n";
import type { SessionUser } from "@/utils/supabase/auth";
import { countOpenFlags } from "@/utils/supabase/moderation";

/** Compact masthead reserved for the mobile map workspace. */
export async function MapMobileHeader({
  user,
  lang,
  href,
}: {
  user: SessionUser | null;
  lang: Locale;
  href?: string;
}) {
  const t = getDictionary(lang);
  const moderationCount = user?.role === "official" ? await countOpenFlags() : null;

  return (
    <header className="relative z-50 flex h-[58px] shrink-0 items-center justify-between border-b border-[#e9e0d6] bg-[#fef7f0] px-2.5 lg:hidden">
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

      <Link
        href={href ?? `/${lang}?vue=carte`}
        aria-label="Ensemble Montréal"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[8px] px-2 py-1"
      >
        <Image
          src="/logo-ensemble-mtl.png"
          alt="Ensemble Montréal"
          width={469}
          height={166}
          priority
          className="h-8 w-auto object-contain"
        />
      </Link>

      <div className="ml-auto flex items-center">
        <AccountButton initialUser={user} lang={lang} />
      </div>
    </header>
  );
}
