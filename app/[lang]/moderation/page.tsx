import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FlagCard } from "@/components/issues/flag-card";
import { StaffAccessManager } from "@/components/moderation/staff-access-manager";
import { getSessionUser } from "@/utils/supabase/auth";
import { listOpenFlags, listStaffAccess } from "@/utils/supabase/moderation";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  CARD,
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
  SECTION_TITLE,
} from "@/components/ui/styles";

/**
 * The queue: everything the matcher wants a person to look at.
 *
 * Not linked from anywhere a resident can see, and gated twice — the page turns
 * anyone who is not an elected official away, and the SELECT policy on
 * `moderation_flags` returns them nothing regardless. The second check is the
 * one that matters; the first exists so the answer is a sentence rather than an
 * empty list that looks like good news.
 *
 * Deliberately not a count of how bad things are. A queue that grows is a queue
 * somebody has not read, and the only number worth showing here is how many are
 * waiting.
 */
export default async function ModerationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const isOfficial = user?.role === "official";

  const [flags, staffAccess] = isOfficial
    ? await Promise.all([listOpenFlags(), listStaffAccess()])
    : [[], []];

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>
            {t.moderation.title}
          </h1>
          {isOfficial && (
            <p className={PAGE_INTRO}>{t.moderation.intro}</p>
          )}
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {!isOfficial ? (
          <div className={`${CARD} p-6 text-center sm:p-10`}>
            <p className={MUTED}>{t.moderation.forbidden}</p>
          </div>
        ) : (
          <>
            <StaffAccessManager entries={staffAccess} lang={lang} />

            <section className="mt-12 border-t border-[#e9e0d6] pt-10" aria-labelledby="flags-title">
              <div className="max-w-[760px]">
                <h2 id="flags-title" className={SECTION_TITLE}>
                  {t.moderation.messagesTitle}
                </h2>
                <p className={`mt-2 text-[15px] leading-[23px] ${MUTED}`}>
                  {t.moderation.messagesIntro}
                </p>
              </div>

              {flags.length === 0 ? (
                <div className={`${CARD} mt-5 p-6 text-center sm:p-10`}>
                  <p className="text-[18px] font-bold leading-[26px]">
                    {t.moderation.empty}
                  </p>
                  <p className={`mt-2 ${MUTED}`}>{t.moderation.emptyBody}</p>
                </div>
              ) : (
                <>
                  <p className={`mt-5 text-[14px] font-bold ${MUTED}`}>
                    {t.moderation.waiting(flags.length)}
                  </p>

                  <div className="mt-4 max-w-[860px] space-y-3">
                    {flags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag={flag}
                        lang={lang}
                        labels={{
                          reportKind: t.moderation.reportKind,
                          replyKind: t.moderation.replyKind,
                          terms: t.moderation.terms,
                          open: t.moderation.open,
                          dismiss: t.moderation.dismiss,
                          dismissing: t.moderation.dismissing,
                        }}
                      />
                    ))}
                  </div>

                  <p
                    className={`mt-6 max-w-[640px] text-[13px] leading-[20px] ${MUTED}`}
                  >
                    {t.moderation.dismissHint}
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
