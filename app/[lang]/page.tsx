import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssueCard } from "@/components/issues/issue-card";
import { ForumSearch } from "@/components/forum-search";
import { IssueList } from "@/components/issues/issue-list";
import { getSessionUser } from "@/utils/supabase/auth";
import { listIssues } from "@/utils/supabase/issues";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  BTN_PRIMARY,
  CARD,
  CHIP,
  CHIP_ACTIVE,
  CONTAINER,
  HERO_BAND,
  MUTED,
} from "@/components/ui/styles";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ tri?: string; q?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { tri, q } = await searchParams;
  const sort = tri === "recents" ? "new" : "top";
  const t = getDictionary(lang);

  const [user, allIssues] = await Promise.all([getSessionUser(), listIssues(sort)]);

  const query = (q ?? "").trim().toLowerCase();
  const issues = query
    ? allIssues.filter(
        (issue) =>
          issue.title.toLowerCase().includes(query) ||
          issue.body.toLowerCase().includes(query),
      )
    : allIssues;

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <SiteHeader user={user} lang={lang} />

      {/* Grey heading band, as on montreal.ca */}
      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <p className="text-[18px] font-bold leading-[26px] md:text-[20px] md:leading-[28px]">
            {t.home.welcome}
          </p>
          <h1 className="mt-2 max-w-[860px] text-[28px] font-bold leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.home.title}
          </h1>
          <p className={`mt-4 max-w-[780px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.home.subtitle}
          </p>

          <div className="mt-8 max-w-[680px]">
            <ForumSearch
              lang={lang}
              defaultValue={q ?? ""}
              placeholder={t.home.searchPlaceholder}
              clearLabel={t.home.clearSearch}
            />
          </div>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-12`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-[0.8px] border-[#ced4da] pb-4">
          <h2 className="text-[24px] font-bold leading-[32px] md:text-[32px] md:leading-[40px]">
            {sort === "top" ? t.home.topTitle : t.home.newTitle}
          </h2>

          {/* montreal.ca's button pair: filled teal for the active choice,
              bordered white for the other. No underlines, no colour-only cue. */}
          <div className="flex items-center gap-2">
            <Link
              href={`/${lang}`}
              aria-current={sort === "top" ? "true" : undefined}
              className={sort === "top" ? CHIP_ACTIVE : CHIP}
            >
              {t.home.sortTop}
            </Link>
            <Link
              href={`/${lang}?tri=recents`}
              aria-current={sort === "new" ? "true" : undefined}
              className={sort === "new" ? CHIP_ACTIVE : CHIP}
            >
              {t.home.sortNew}
            </Link>
          </div>
        </div>

        {user && (
          <div className="mt-6">
            <Link href={`/${lang}/sujets/nouveau`} className={BTN_PRIMARY}>
              {t.home.report}
            </Link>
          </div>
        )}
        {!user && <p className={`mt-6 ${MUTED}`}>{t.home.signInPrompt}</p>}

        {query && (
          <p className={`mt-6 text-[14px] ${MUTED}`} aria-live="polite">
            {issues.length} {issues.length === 1 ? t.home.resultOne : t.home.resultMany}
          </p>
        )}

        <IssueList query={`${sort}:${query}`}>
        <div className="mt-4 space-y-4">
          {issues.length === 0 ? (
            <div className={`${CARD} p-10 text-center`}>
              <p className="text-[20px] font-bold leading-[28px]">
                {query ? t.home.noResultsTitle : t.home.emptyTitle}
              </p>
              <p className={`mt-2 ${MUTED}`}>
                {query ? t.home.noResultsBody : t.home.emptyBody}
              </p>
            </div>
          ) : (
            issues.map((issue, index) => (
              <div
                key={issue.id}
                className="result-item"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <IssueCard issue={issue} canVote={Boolean(user)} lang={lang} />
              </div>
            ))
          )}
        </div>
        </IssueList>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
