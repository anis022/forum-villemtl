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
    // The feed sits on a tint, not on white: cards need a ground to read as
    // cards, and a page of white boxes on white is what made this look flat.
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-[#16241f]">
      <SiteHeader user={user} lang={lang} />

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

          {/* The call to action belongs with the pitch that just argued for
              it, not stranded between the section heading and the first post. */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {user ? (
              <Link href={`/${lang}/sujets/nouveau`} className={BTN_PRIMARY}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {t.home.report}
              </Link>
            ) : (
              <p className={`text-[15px] ${MUTED}`}>{t.home.signInPrompt}</p>
            )}
          </div>

          <div className="mt-6 max-w-[680px]">
            <ForumSearch
              lang={lang}
              defaultValue={q ?? ""}
              placeholder={t.home.searchPlaceholder}
              clearLabel={t.home.clearSearch}
            />
          </div>
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-bold leading-[30px] md:text-[26px] md:leading-[34px]">
            {sort === "top" ? t.home.topTitle : t.home.newTitle}
          </h2>

          {/* A segmented control rather than two loose buttons: these are two
              views of one list, and they should read as one switch. */}
          <div className="inline-flex rounded-full border border-[#dde5e1] bg-white p-1">
            <Link
              href={`/${lang}`}
              aria-current={sort === "top" ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-[14px] font-bold transition-colors ${
                sort === "top" ? "bg-[#097d6c] text-white" : "text-[#5d6b66] hover:text-[#16241f]"
              }`}
            >
              {t.home.sortTop}
            </Link>
            <Link
              href={`/${lang}?tri=recents`}
              aria-current={sort === "new" ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-[14px] font-bold transition-colors ${
                sort === "new" ? "bg-[#097d6c] text-white" : "text-[#5d6b66] hover:text-[#16241f]"
              }`}
            >
              {t.home.sortNew}
            </Link>
          </div>
        </div>

        {query && (
          <p className={`mt-4 text-[14px] ${MUTED}`} aria-live="polite">
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
