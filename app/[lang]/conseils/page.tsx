import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CouncilChat } from "@/components/council/council-chat";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

/**
 * The council, asked a question instead of browsed.
 *
 * This section used to be a list of sittings, each opening on a page of counts,
 * resolutions grouped by agenda chapter, and a transcript in a disclosure. It
 * was a filing cabinet with a search box on the front, and it asked a resident
 * to already know which of eleven sittings held the thing they came for.
 *
 * Nobody arrives wanting a sitting. They arrive wanting to know whether anyone
 * raised the parking meters on their street, and what the council said back. So
 * the whole section is one question box now, and the answer carries the passage
 * that backs it and the second of the recording where it was said.
 *
 * Open to everyone. The recordings are public and the minutes are public, and
 * the reason to ask rather than search is precisely that it works for someone
 * who does not know the words the clerk used.
 */
export default async function CouncilPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>{t.council.title}</h1>
          <p className={PAGE_INTRO}>{t.council.intro}</p>
        </div>
      </div>

      {/* Full page measure rather than the reading column: the conversation
          keeps a reading measure of its own inside, and the sources need a
          column beside it rather than under it. */}
      <main className={PAGE_MAIN}>
        <CouncilChat lang={lang} />

        {/* Said once, at the bottom, where somebody who has read an answer will
            meet it. Repeating it under every reply would train people to stop
            seeing it. */}
        <p className={`mt-10 max-w-[720px] text-[13px] leading-[20px] ${MUTED}`}>
          {t.council.disclaimer}
        </p>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
