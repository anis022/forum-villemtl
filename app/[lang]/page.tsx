import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssueCard } from "@/components/issues/issue-card";
import { ForumSearch } from "@/components/forum-search";
import { IssueList } from "@/components/issues/issue-list";
import { IssueMap } from "@/components/issues/issue-map";
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
  searchParams: Promise<{ tri?: string; q?: string; vue?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { tri, q, vue } = await searchParams;
  const sort = tri === "recents" ? "new" : "top";
  const mapView = vue === "carte";
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

          <div className="mt-7 max-w-[680px]">
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
        {/* The invitation to post sits above the feed rather than inside the
            hero: by the time someone has scrolled past the search field they
            have looked for their issue and not found it, which is exactly the
            moment to offer reporting it. The button lines up over the sort
            control, so the column of actions reads as one edge. */}
        <section className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[16px] border border-[#cfe4de] bg-[#e9f3f0] p-5 md:p-6">
          <div className="min-w-0 max-w-[60ch]">
            <h2 className="text-[18px] font-bold leading-[26px] md:text-[20px] md:leading-[28px]">
              {t.home.ctaTitle}
            </h2>
            <p className={`mt-1.5 text-[15px] leading-[22px] ${MUTED}`}>{t.home.ctaBody}</p>
          </div>

          {user ? (
            <Link href={`/${lang}/sujets/nouveau`} className={`${BTN_PRIMARY} shrink-0`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {t.home.report}
            </Link>
          ) : (
            <p className={`shrink-0 text-[15px] font-bold ${MUTED}`}>{t.home.signInPrompt}</p>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-bold leading-[30px] md:text-[26px] md:leading-[34px]">
            {mapView ? t.home.mapTitle : sort === "top" ? t.home.topTitle : t.home.newTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sorting only means something in a list. On a map every pin is
                on screen at once, so the control is hidden rather than left
                there doing nothing. */}
            {!mapView && (
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
            )}

            <div className="inline-flex rounded-full border border-[#dde5e1] bg-white p-1">
              <Link
                href={`/${lang}${sort === "new" ? "?tri=recents" : ""}`}
                aria-current={!mapView ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-colors ${
                  !mapView ? "bg-[#16241f] text-white" : "text-[#5d6b66] hover:text-[#16241f]"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 6.5h16M4 12h16M4 17.5h16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                {t.home.viewList}
              </Link>
              <Link
                href={`/${lang}?vue=carte`}
                aria-current={mapView ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-colors ${
                  mapView ? "bg-[#16241f] text-white" : "text-[#5d6b66] hover:text-[#16241f]"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 2.6c-3.3 0-6 2.7-6 6 0 4.4 6 12.3 6 12.3s6-7.9 6-12.3c0-3.3-2.7-6-6-6z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="8.6" r="2.1" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                {t.home.viewMap}
              </Link>
            </div>
          </div>
        </div>

        {query && (
          <p className={`mt-4 text-[14px] ${MUTED}`} aria-live="polite">
            {issues.length} {issues.length === 1 ? t.home.resultOne : t.home.resultMany}
          </p>
        )}

        {mapView ? (
          <div className="mt-4">
            <IssueMap
              issues={issues}
              lang={lang}
              labels={{
                statuses: t.statuses,
                showAll: t.home.mapAll,
                onlyOpen: t.home.mapOpen,
                onlySettled: t.home.mapSettled,
                located: t.home.mapLocated,
                unlocated: t.home.mapUnlocated,
                empty: t.home.mapEmpty,
                open: t.home.mapOpenIssue,
              }}
            />
          </div>
        ) : (
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
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
