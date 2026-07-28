import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { getActivity, getCounts, getProfile } from "@/utils/supabase/profile";
import { getDictionary, isLocale, dateLocale } from "@/utils/i18n";
import { CARD, CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";
import { Avatar } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { OfficialBadge } from "@/components/issues/issue-meta";

/** Icon per activity kind — opened, replied, backed. */
const ICONS: Record<string, string> = {
  issue: "M12 5v14M5 12h14",
  comment:
    "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z",
  vote: "M12 4l8 8h-5v8H9v-8H4z",
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDictionary(lang);
  const [viewer, profile] = await Promise.all([getSessionUser(), getProfile(id)]);
  if (!profile) notFound();

  const [activity, counts] = await Promise.all([getActivity(id), getCounts(id)]);
  const isSelf = viewer?.id === profile.id;
  const locale = dateLocale(lang);

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(iso),
    );

  const stats = [
    { n: counts.issues, label: t.profile.topics },
    { n: counts.comments, label: t.profile.replies },
    { n: counts.votes, label: t.profile.backings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <SiteHeader user={viewer} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-10`}>
          {isSelf ? (
            <AvatarUpload
              person={profile}
              labels={{
                change: t.profile.changePhoto,
                remove: t.profile.removePhoto,
                hint: t.profile.photoHint,
                saving: t.profile.saving,
                errors: t.errors,
              }}
            />
          ) : (
            <div className="flex items-center gap-4">
              <Avatar person={profile} size="lg" />
            </div>
          )}

          <h1 className="mt-4 flex flex-wrap items-center gap-2 text-[28px] font-bold leading-[36px] md:text-[36px] md:leading-[44px]">
            {fullName || t.issue.anonymousAuthor}
            {profile.isOfficial && <OfficialBadge lang={lang} />}
          </h1>
          <p className={`mt-1 text-[15px] ${MUTED}`}>{t.profile.joined(fmt(profile.joinedAt))}</p>

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className={`text-[13px] ${MUTED}`}>{s.label}</dt>
                <dd className="text-[22px] font-bold leading-[28px] tabular-nums">{s.n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        <h2 className="text-[20px] font-bold leading-[28px] md:text-[24px]">
          {isSelf ? t.profile.yourActivity : t.profile.activityOf(fullName)}
        </h2>

        {activity.length === 0 ? (
          <div className={`${CARD} mt-4 p-10 text-center`}>
            <p className="text-[18px] font-bold leading-[26px]">{t.profile.emptyTitle}</p>
            <p className={`mt-2 ${MUTED}`}>
              {isSelf ? t.profile.emptyBodySelf : t.profile.emptyBodyOther}
            </p>
          </div>
        ) : (
          // A single timeline rather than three tabs: the point is to see a
          // person's involvement at a glance, not to audit it by category.
          <ol className="mt-4 max-w-[760px] space-y-3">
            {activity.map((item, i) => (
              <li key={`${item.kind}-${item.issueId}-${i}`}>
                <article className={`${CARD} flex gap-3 p-4`}>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e6f4f1] text-[#097d6c]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d={ICONS[item.kind]}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] leading-[20px]">
                      <span className={MUTED}>{t.profile.verbs[item.kind]}</span>{" "}
                      <Link
                        href={`/${lang}/sujets/${item.issueId}`}
                        className="font-bold text-[#097d6c] hover:underline"
                      >
                        {item.issueTitle}
                      </Link>
                    </p>
                    {item.body && (
                      <p className={`mt-1 line-clamp-2 text-[15px] leading-[22px] ${MUTED}`}>
                        {item.body}
                      </p>
                    )}
                    <p className={`mt-1 text-[13px] ${MUTED}`}>{fmt(item.happenedAt)}</p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
