import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Avatar } from "@/components/ui/avatar";
import { CategoryTag, formatDateShort } from "@/components/issues/issue-meta";
import { markNotificationsRead } from "@/app/actions/notifications";
import { getSessionUser } from "@/utils/supabase/auth";
import { listNotifications } from "@/utils/supabase/notifications";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  BTN_SECONDARY,
  CARD,
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_INTRO,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const user = await getSessionUser();
  const isOffice = user?.role === "official";

  const notices = isOffice ? await listNotifications() : [];
  const unread = notices.filter((notice) => !notice.read).length;

  return (
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <h1 className={PAGE_TITLE}>{t.notifications.title}</h1>
          {isOffice && <p className={PAGE_INTRO}>{t.notifications.intro}</p>}
        </div>
      </div>

      <main className={PAGE_MAIN}>
        {!isOffice ? (
          <div className={`${CARD} p-6 text-center sm:p-10`}>
            <p className={MUTED}>{t.notifications.forbidden}</p>
          </div>
        ) : notices.length === 0 ? (
          <div className={`${CARD} p-6 text-center sm:p-10`}>
            <p className="text-[17px] font-bold leading-[24px]">{t.notifications.empty}</p>
            <p className={`mx-auto mt-2 max-w-[420px] text-[15px] leading-[23px] ${MUTED}`}>
              {t.notifications.emptyBody}
            </p>
          </div>
        ) : (
          <>
            {unread > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className={`text-[15px] leading-[22px] ${MUTED}`}>
                  {t.notifications.unread(unread)}
                </p>
                <form action={markNotificationsRead}>
                  <input type="hidden" name="locale" value={lang} />
                  <button type="submit" className={BTN_SECONDARY}>
                    {t.notifications.markAllRead}
                  </button>
                </form>
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {notices.map((notice) => {
                const name =
                  [notice.actor.firstName, notice.actor.lastName].filter(Boolean).join(" ") ||
                  t.notifications.someone;

                return (
                  <li key={notice.id}>
                    <Link
                      href={`/${lang}/sujets/${notice.issueId}`}
                      className={`${CARD} flex gap-3 p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(26,26,26,0.08)]`}
                    >
                      <Avatar
                        person={{
                          id: notice.actor.id ?? notice.id,
                          firstName: notice.actor.firstName,
                          lastName: notice.actor.lastName,
                          avatarUrl: notice.actor.avatarUrl,
                        }}
                        size="md"
                      />

                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] leading-[18px] ${MUTED}`}>
                          {t.notifications.newTopic(name)}
                        </p>
                        <p className="mt-1 break-words text-[17px] font-bold leading-[24px]">
                          {notice.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <CategoryTag category={notice.category} lang={lang} />
                          <span className={`text-[13px] leading-[18px] ${MUTED}`}>
                            {formatDateShort(notice.createdAt, lang)}
                          </span>
                          {!notice.read && (
                            <span className="text-[13px] font-bold leading-[18px] text-[#a3162c]">
                              {t.notifications.newBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
