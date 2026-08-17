import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CouncilChat } from "@/components/council/council-chat";
import { getSessionUser } from "@/utils/supabase/auth";
import { getDictionary, isLocale } from "@/utils/i18n";

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
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f7f3ee] text-[#1a1a1a]">
      <SiteHeader user={user} lang={lang} />

      <main className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
        <div className="council-workspace mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-hidden rounded-[18px] border border-[#ded7d0] bg-white shadow-[0_8px_26px_rgba(31,22,16,0.08)]">
          <h1 className="sr-only">{t.council.title}</h1>

          <CouncilChat lang={lang} />

          <p className="shrink-0 border-t border-[#e9e2dc] bg-[#fffdfb] px-4 py-2.5 text-[11px] leading-[17px] text-[#8a858c] sm:px-6 lg:px-7">
            {t.council.disclaimer}
          </p>
        </div>
      </main>
    </div>
  );
}
