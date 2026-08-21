import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NewPollForm } from "@/components/polls/new-poll-form";
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

/**
 * Writing a topic that asks a question with choices under it.
 *
 * Under /sujets rather than at a /sondages of its own, because that is what it
 * makes: the thing published here appears in the forum feed, takes replies and
 * supports, and can be edited and taken down exactly like any other topic.
 * Nothing about it is a second kind of post except the ballot in the middle.
 */
export default async function NewPollPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const { user, canParticipate } = await getSessionContext();
  // Guarded here as well as in the action, so an anonymous visitor never sees
  // the composer at all.
  if (!canParticipate) redirect(`/${lang}`);

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <Link
            href={`/${lang}/sujets/nouveau`}
            className="text-[14px] font-bold text-[#fa3250] hover:underline"
          >
            {t.poll.backToForum}
          </Link>
          <h1 className={`${PAGE_TITLE} mt-3`}>{t.poll.newTitle}</h1>
          <p className={`mt-2 max-w-[640px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.poll.newSubtitle}
          </p>
        </div>
      </div>

      <main className={PAGE_MAIN}>
        <NewPollForm lang={lang} isAdmin={user?.role === "official"} />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
