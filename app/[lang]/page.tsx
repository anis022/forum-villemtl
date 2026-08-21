import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssueCard } from "@/components/issues/issue-card";
import { ForumSearch } from "@/components/forum-search";
import { FeedToolbar } from "@/components/issues/feed-toolbar";
import { IssueList } from "@/components/issues/issue-list";
import { IssueMap } from "@/components/issues/issue-map";
import { MapMobileHeader } from "@/components/issues/map-mobile-header";
import { ForumSidebar } from "@/components/forum-sidebar";
import { getSessionContext } from "@/utils/supabase/auth";
import { listActiveMembers } from "@/utils/supabase/community";
import { categoryCounts, FEED_PAGE, listIssues } from "@/utils/supabase/issues";
import { listTrendingContent } from "@/utils/supabase/trending";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import { getDictionary, isLocale } from "@/utils/i18n";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  HERO_BAND,
  MUTED,
  PAGE_HERO_INNER,
  PAGE_MAIN,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/components/ui/styles";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    tri?: string;
    q?: string;
    vue?: string;
    n?: string;
    cat?: string;
    recherche?: string;
  }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { tri, q, vue, n, cat, recherche } = await searchParams;
  const sort = tri === "recents" ? "new" : "top";
  const mapView = vue === "carte";
  const t = getDictionary(lang);
  const query = (q ?? "").trim();

  // Multiple categories share one compact URL parameter. Unknown values are
  // ignored rather than passed to the database.
  const selectedCategories = [...new Set((cat ?? "").split(","))].filter(
    (key): key is Category => (CATEGORY_KEYS as readonly string[]).includes(key),
  );
  const categoryParam = selectedCategories.join(",");

  /**
   * How much of the feed to render, carried in the URL so "show more" survives
   * a reload, a share and the back button — and so the whole page stays server
   * rendered. Clamped because it arrives from the address bar: without a
   * ceiling, `?n=100000` is a request to render the entire forum into one
   * response, which is a denial of service anyone could type.
   */
  const shown = Math.min(Math.max(Number(n) || FEED_PAGE, FEED_PAGE), FEED_PAGE * 12);

  const sidebarPromise = mapView
    ? Promise.resolve(null)
    : Promise.all([listActiveMembers(3), listTrendingContent(3)]);
  const [viewer, feed, counts, sidebar] = await Promise.all([
    getSessionContext(),
    listIssues(sort, {
      limit: shown,
      search: query,
      categories: mapView ? [] : selectedCategories,
    }),
    categoryCounts(),
    sidebarPromise,
  ]);
  const { user, canParticipate } = viewer;
  const { issues, hasMore } = feed;

  /**
   * A feed URL that keeps whatever the reader already set, overriding only what
   * is passed. Every control on this page — paging, the chips — is one of these,
   * so none of them silently drops another's state.
   */
  const feedHref = (
    override: { tri?: string | null; vue?: string | null; cat?: Category[] | null; n?: number } = {},
  ) => {
    // `"key" in override` rather than `??`: passing null is how a control
    // clears a parameter, and `??` would read that as "leave it alone".
    const nextTri = "tri" in override ? override.tri : tri;
    const nextVue = "vue" in override ? override.vue : vue;
    const nextCategories = "cat" in override ? (override.cat ?? []) : selectedCategories;

    const next = new URLSearchParams();
    if (nextTri) next.set("tri", nextTri);
    if (q) next.set("q", q);
    if (nextVue) next.set("vue", nextVue);
    if (nextCategories.length > 0) next.set("cat", nextCategories.join(","));
    // `n` never carries over on its own: changing sort, view or category starts
    // the feed at the top again rather than on page four of a list that no
    // longer exists.
    if (override.n) next.set("n", String(override.n));

    const search = next.toString();
    return search ? `/${lang}?${search}` : `/${lang}`;
  };

  const mapCategories = counts
    .filter(({ count }) => count > 0)
    .map(({ category: key, count }) => ({
      key,
      count,
      label: t.categories[key],
    }));

  if (mapView) {
    return (
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#fef7f0] text-[#1a1a1a]">
        <div className="hidden lg:block">
          <SiteHeader user={user} lang={lang} />
        </div>
        <MapMobileHeader user={user} lang={lang} />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <IssueMap
            issues={issues}
            lang={lang}
            toolbar={{
              listHref: feedHref({ vue: null }),
              activeCategories: selectedCategories,
              categories: mapCategories,
            }}
            labels={{
              mapLabel: t.home.mapTitle,
              categories: t.categories,
              statuses: t.statuses,
              viewList: t.home.viewList,
              viewMap: t.home.viewMap,
              filters: t.home.filters,
              filterCategories: t.home.filterCategories,
              filterStatuses: t.home.filterStatuses,
              searchPlaceholder: t.home.searchPlaceholder,
              clearSearch: t.home.clearSearch,
              showAll: t.home.mapAll,
              onlyOpen: t.home.mapOpen,
              onlySettled: t.home.mapSettled,
              located: t.home.mapLocated,
              unlocated: t.home.mapUnlocated,
              empty: t.home.mapEmpty,
              open: t.home.mapOpenIssue,
              replyOne: t.issue.replyOne,
              replyMany: t.issue.replyMany,
            }}
          />
        </main>
      </div>
    );
  }

  return (
    // The feed sits on a tint, not on white: cards need a ground to read as
    // cards, and a page of white boxes on white is what made this look flat.
    <div className={PAGE_SHELL}>
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={PAGE_HERO_INNER}>
          <p className="text-[16px] font-bold leading-[23px] text-[#2a2a86] md:text-[17px]">
            {t.home.welcome}
          </p>
          <h1 className={`${PAGE_TITLE} mt-2 max-w-[820px] !font-normal`}>
            {t.home.title}
          </h1>

          {/* The search field is folded away until the masthead's "Recherche"
              asks for it, and the row it used to hold now carries the
              categories people actually browse. Looking for one specific thing
              is the rarer errand; browsing is what most visits are. */}
          <ForumSearch
            lang={lang}
            defaultValue={q ?? ""}
            startOpen={Boolean(recherche)}
            keep={{ tri, vue, cat: categoryParam || undefined }}
            placeholder={t.home.searchPlaceholder}
            clearLabel={t.home.clearSearch}
            closeLabel={t.home.closeSearch}
          />

        </div>
      </div>

      <main className={PAGE_MAIN}>
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
        {/* The invitation to post sits above the feed rather than inside the
            hero: by the time someone has scrolled past the search field they
            have looked for their issue and not found it, which is exactly the
            moment to offer reporting it. The button lines up over the sort
            control, so the column of actions reads as one edge. */}
        <section
          className={`${CARD} mb-7 items-center ${
            canParticipate
              ? "grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 sm:gap-5 sm:p-5 md:p-6"
              : "flex flex-wrap justify-between gap-x-6 gap-y-4 p-5 md:p-6"
          }`}
        >
          <div className="min-w-0 max-w-[60ch]">
            <h2
              className={`font-semibold ${
                canParticipate
                  ? "text-[16px] leading-[22px] sm:text-[18px] sm:leading-[26px] md:text-[20px] md:leading-[28px]"
                  : "text-[18px] leading-[26px] md:text-[20px] md:leading-[28px]"
              }`}
            >
              {t.home.ctaTitle}
            </h2>
          </div>

          {canParticipate ? (
            <Link
              href={`/${lang}/sujets/nouveau`}
              className={`${BTN_PRIMARY} shrink-0 !px-3.5 !py-2 !text-[13px] sm:!px-5 sm:!py-[10px] sm:!text-[15px]`}
            >
              <svg className="hidden min-[360px]:block" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {t.home.report}
            </Link>
          ) : (
            /* Not `shrink-0`: this is a full sentence, and refusing to shrink
               made it run off the side of a phone. It takes the whole width
               below the heading and wraps like the prose it is. */
            <p className={`min-w-0 max-w-full text-[15px] font-bold ${MUTED}`}>
              {t.home.signInPrompt}
            </p>
          )}
        </section>

        <div className="flex items-center gap-3">
          <h2 className="shrink-0 text-[22px] font-semibold leading-[29px] tracking-[-0.01em] md:text-[24px] md:leading-[32px]">
            {t.home.topicsTitle}
          </h2>
          <FeedToolbar
            listHref={feedHref({ vue: null })}
            mapHref={feedHref({ vue: "carte" })}
            sort={sort}
            selectedCategories={selectedCategories}
            categories={mapCategories}
            labels={{
              viewList: t.home.viewList,
              viewMap: t.home.viewMap,
              filters: t.home.filters,
              sortLabel: t.home.sortLabel,
              sortTop: t.home.sortTop,
              sortNew: t.home.sortNew,
              filterCategories: t.home.filterCategories,
              allCategories: t.home.allCategories,
              resetFilters: t.home.resetFilters,
              applyFilters: t.home.applyFilters,
            }}
          />
        </div>

        {query && (
          <p className={`mt-4 text-[14px] ${MUTED}`} aria-live="polite">
            {issues.length} {issues.length === 1 ? t.home.resultOne : t.home.resultMany}
          </p>
        )}

        <IssueList query={`${sort}:${categoryParam}:${query}`}>
        <div className="mt-4 space-y-4">
          {issues.length === 0 ? (
            <div className={`${CARD} p-6 text-center sm:p-10`}>
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
                <IssueCard issue={issue} canVote={canParticipate} lang={lang} />
              </div>
            ))
          )}
        </div>

        {/* A link, not a button: paging belongs in the URL, so it works before
            the JavaScript arrives, survives a reload and can be shared.
            `scroll={false}` keeps the reader where they were rather than
            throwing them back to the masthead for having asked for more. */}
        {hasMore && (
          <Link
            href={feedHref({ n: shown + FEED_PAGE })}
            scroll={false}
            className={`${BTN_SECONDARY} mt-4 w-full`}
          >
            {t.home.showMore}
          </Link>
        )}
        </IssueList>
        </div>

        <ForumSidebar
          lang={lang}
          members={sidebar?.[0] ?? []}
          categories={mapCategories}
          trending={sidebar?.[1] ?? { items: [], hasTraffic: false }}
          labels={{
            activeMembers: t.home.activeMembers,
            popularCategories: t.home.popularCategories,
            trending: t.home.trending,
            discover: t.home.discover,
            event: t.home.contentEvent,
            project: t.home.contentProject,
            contributions: t.home.contributionCount,
            views: t.home.trafficCount,
          }}
        />
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
