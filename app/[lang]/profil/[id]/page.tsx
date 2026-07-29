import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/utils/supabase/auth";
import { getActivity, getCounts, getProfile } from "@/utils/supabase/profile";
import { getDictionary, isLocale, dateLocale } from "@/utils/i18n";
import { CARD, CONTAINER, MUTED } from "@/components/ui/styles";
import { Avatar } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { OfficialBadge } from "@/components/issues/issue-meta";

/**
 * Each activity kind gets its own mark and colour, so the timeline is
 * scannable without reading every line: a rosette-red arrow for backing, teal
 * for replying, ink for opening a topic.
 */
const KINDS = {
  issue: {
    path: "M12 5v14M5 12h14",
    tint: "bg-[#f2f6f4] text-[#16241f]",
  },
  comment: {
    path: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z",
    tint: "bg-[#e2f0ec] text-[#097d6c]",
  },
  vote: {
    path: "M12 4.5l7.2 7.6h-4.1V19H8.9v-6.9H4.8L12 4.5z",
    tint: "bg-[#fdeceb] text-[#c0392f]",
  },
} as const;

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
  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(iso),
    );

  const stats = [
    { n: counts.issues, label: t.profile.topics },
    { n: counts.comments, label: t.profile.replies },
    { n: counts.votes, label: t.profile.backings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={viewer} lang={lang} />

      <main className={`${CONTAINER} flex-1 py-6 md:py-10`}>
        {/* Identity card, overlapping a tinted banner — the shape people
            already read as "this is a person" rather than "this is a record". */}
        <section className={`${CARD} overflow-hidden`}>
          <div className="h-24 bg-gradient-to-r from-[#097d6c] to-[#0f9c85] md:h-32" />

          <div className="px-4 pb-5 sm:px-6">
            {/* Only the avatar breaks the banner line. Anything else placed
                there — the stats, in an earlier pass — lands as dark text on
                saturated green and stops being readable. */}
            <div className="-mt-10 md:-mt-12">
              <div className="inline-block rounded-full bg-white p-1 shadow-[0_2px_8px_rgba(22,36,31,0.10)]">
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
                  <Avatar person={profile} size="lg" />
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-[26px] font-bold leading-[32px] md:text-[30px] md:leading-[36px]">
                  {fullName || t.issue.anonymousAuthor}
                  {profile.isOfficial && <OfficialBadge lang={lang} />}
                </h1>
                <p className={`mt-1 text-[14px] ${MUTED}`}>
                  {t.profile.joined(fmtDay(profile.joinedAt))}
                </p>
              </div>

              <dl className="flex flex-wrap gap-x-7 gap-y-2">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dd className="text-[22px] font-bold leading-[26px] tabular-nums">{s.n}</dd>
                    <dt className={`text-[12px] uppercase tracking-[0.06em] ${MUTED}`}>{s.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <h2 className="mt-8 text-[20px] font-bold leading-[28px] md:text-[22px]">
          {isSelf ? t.profile.yourActivity : t.profile.activityOf(fullName)}
        </h2>

        {activity.length === 0 ? (
          <div className={`${CARD} mt-4 p-10 text-center`}>
            <p className="text-[18px] font-bold leading-[26px]">{t.profile.emptyTitle}</p>
            <p className={`mx-auto mt-2 max-w-[46ch] ${MUTED}`}>
              {isSelf ? t.profile.emptyBodySelf : t.profile.emptyBodyOther}
            </p>
          </div>
        ) : (
          // A single timeline rather than three tabs: the point is to see one
          // person's involvement at a glance, not to audit it by category. The
          // connecting rail is what turns a list of cards into a history.
          <ol className="relative mt-4 max-w-[760px] space-y-2 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-[#dde5e1]">
            {activity.map((item, i) => {
              const kind = KINDS[item.kind];
              return (
                <li key={`${item.kind}-${item.issueId}-${i}`} className="relative flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-[#f8faf9] ${kind.tint}`}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                      <path
                        d={kind.path}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <article className={`${CARD} min-w-0 flex-1 p-4`}>
                    <p className="text-[14px] leading-[20px]">
                      <span className={MUTED}>{t.profile.verbs[item.kind]}</span>{" "}
                      <Link
                        href={`/${lang}/sujets/${item.issueId}`}
                        className="font-bold hover:text-[#097d6c] hover:underline"
                      >
                        {item.issueTitle}
                      </Link>
                    </p>
                    {item.body && (
                      <p className={`mt-1.5 line-clamp-2 text-[15px] leading-[22px] ${MUTED}`}>
                        {item.body}
                      </p>
                    )}
                    <p className={`mt-1.5 text-[12px] ${MUTED}`}>{fmtDay(item.happenedAt)}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
