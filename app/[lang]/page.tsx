import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IssueCard } from "@/components/issues/issue-card";
import { ForumSearch } from "@/components/forum-search";
import { CategoryChips, TOP_CATEGORIES } from "@/components/issues/category-chips";
import { IssueList } from "@/components/issues/issue-list";
import { IssueMap } from "@/components/issues/issue-map";
import { getSessionUser } from "@/utils/supabase/auth";
import { categoryCounts, FEED_PAGE, listIssues } from "@/utils/supabase/issues";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import { getDictionary, isLocale } from "@/utils/i18n";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, CONTAINER, HERO_BAND, MUTED } from "@/components/ui/styles";

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

  // Checked against the known keys rather than trusted: it arrives from the
  // address bar, and anything else is simply not a filter.
  const category: Category | null =
    cat && (CATEGORY_KEYS as readonly string[]).includes(cat) ? (cat as Category) : null;

  /**
   * How much of the feed to render, carried in the URL so "show more" survives
   * a reload, a share and the back button — and so the whole page stays server
   * rendered. Clamped because it arrives from the address bar: without a
   * ceiling, `?n=100000` is a request to render the entire forum into one
   * response, which is a denial of service anyone could type.
   */
  const shown = Math.min(Math.max(Number(n) || FEED_PAGE, FEED_PAGE), FEED_PAGE * 12);

  const [user, feed, counts] = await Promise.all([
    getSessionUser(),
    listIssues(sort, { limit: shown, search: query, category }),
    categoryCounts(),
  ]);
  const { issues, hasMore } = feed;

  /**
   * A feed URL that keeps whatever the reader already set, overriding only what
   * is passed. Every control on this page — paging, the chips — is one of these,
   * so none of them silently drops another's state.
   */
  const feedHref = (
    override: { tri?: string | null; vue?: string | null; cat?: Category | null; n?: number } = {},
  ) => {
    // `"key" in override` rather than `??`: passing null is how a control
    // clears a parameter, and `??` would read that as "leave it alone".
    const nextTri = "tri" in override ? override.tri : tri;
    const nextVue = "vue" in override ? override.vue : vue;
    const nextCat = "cat" in override ? override.cat : category;

    const next = new URLSearchParams();
    if (nextTri) next.set("tri", nextTri);
    if (q) next.set("q", q);
    if (nextVue) next.set("vue", nextVue);
    if (nextCat) next.set("cat", nextCat);
    // `n` never carries over on its own: changing sort, view or category starts
    // the feed at the top again rather than on page four of a list that no
    // longer exists.
    if (override.n) next.set("n", String(override.n));

    const search = next.toString();
    return search ? `/${lang}?${search}` : `/${lang}`;
  };

  /**
   * The chips: busiest categories first, empty ones left out — a category
   * nobody has used is not a way in — and the active one kept on screen even
   * when it did not make the cut, so the filter is never invisible.
   */
  const chips = counts
    .filter(({ count }) => count > 0)
    .filter((entry, index) => index < TOP_CATEGORIES || entry.category === category)
    .map(({ category: key, count }) => ({
      key,
      count,
      label: t.categories[key],
      href: feedHref({ cat: key === category ? null : key }),
    }));

  return (
    // The feed sits on a tint, not on white: cards need a ground to read as
    // cards, and a page of white boxes on white is what made this look flat.
    <div className="flex min-h-screen flex-col bg-[#fef7f0] text-[#1a1a1a]">
      <SiteHeader user={user} lang={lang} />

      <div className={HERO_BAND}>
        <div className={`${CONTAINER} py-8 md:py-12`}>
          <p className="text-[18px] font-bold leading-[26px] md:text-[20px] md:leading-[28px]">
            {t.home.welcome}
          </p>
          <h1 className="mt-2 max-w-[860px] text-[28px] leading-[36px] md:text-[40px] md:leading-[56px]">
            {t.home.title}
          </h1>
          <p className={`mt-4 max-w-[780px] text-[16px] leading-[24px] ${MUTED}`}>
            {t.home.subtitle}
          </p>

          {/* The search field is folded away until the masthead's "Recherche"
              asks for it, and the row it used to hold now carries the
              categories people actually browse. Looking for one specific thing
              is the rarer errand; browsing is what most visits are. */}
          <ForumSearch
            lang={lang}
            defaultValue={q ?? ""}
            startOpen={Boolean(recherche)}
            keep={{ tri, vue, cat: category ?? undefined }}
            placeholder={t.home.searchPlaceholder}
            clearLabel={t.home.clearSearch}
            closeLabel={t.home.closeSearch}
          />

          <CategoryChips
            label={t.home.browseLabel}
            allLabel={t.home.allCategories}
            allHref={feedHref({ cat: null })}
            total={counts.reduce((sum, entry) => sum + entry.count, 0)}
            items={chips}
            active={category}
          />
        </div>
      </div>

      <main className={`${CONTAINER} flex-1 py-8 md:py-10`}>
        {/* The invitation to post sits above the feed rather than inside the
            hero: by the time someone has scrolled past the search field they
            have looked for their issue and not found it, which is exactly the
            moment to offer reporting it. The button lines up over the sort
            control, so the column of actions reads as one edge. */}
        <section className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[16px] border border-[#f8c4cd] bg-[#fde8eb] p-5 md:p-6">
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
            /* Not `shrink-0`: this is a full sentence, and refusing to shrink
               made it run off the side of a phone. It takes the whole width
               below the heading and wraps like the prose it is. */
            <p className={`min-w-0 max-w-full text-[15px] font-bold ${MUTED}`}>
              {t.home.signInPrompt}
            </p>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* The category is named here as well as on the chip: once the hero
              has scrolled away, this heading is the only thing left saying why
              the feed is short. */}
          <h2 className="text-[22px] leading-[30px] md:text-[26px] md:leading-[34px]">
            {mapView ? t.home.mapTitle : sort === "top" ? t.home.topTitle : t.home.newTitle}
            {category && <span className={MUTED}> · {t.categories[category]}</span>}
          </h2>

          {/* The two toggles stay side by side at every width. They are one
              decision — what you are looking at, and in what order — and
              stacking them on a phone read as two unrelated widgets and cost a
              whole row of the feed.

              On a phone they own the row under the title and push apart, so the
              view switch sits on the right edge where the eye already goes for
              it; beside the title on a wider screen they close back up. */}
          <div className="flex w-full flex-nowrap items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
            {/* Sorting only means something in a list. On a map every pin is
                on screen at once, so the control is hidden rather than left
                there doing nothing. */}
            {!mapView && (
              /* `mr-auto` rather than `justify-between` on the row: on the map
                 view this control is not rendered at all, and space-between
                 would drop the lone view switch back to the left edge. */
              <div className="mr-auto inline-flex shrink-0 rounded-full border border-[#e9e0d6] bg-white p-0.5 sm:mr-0 sm:p-1">
                <Link
                  href={feedHref({ tri: null })}
                  aria-current={sort === "top" ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1.5 text-[13px] font-bold transition-colors sm:px-4 sm:text-[14px] ${
                    sort === "top" ? "bg-[#fa3250] text-white" : "text-[#6e6a72] hover:text-[#1a1a1a]"
                  }`}
                >
                  {t.home.sortTop}
                </Link>
                <Link
                  href={feedHref({ tri: "recents" })}
                  aria-current={sort === "new" ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1.5 text-[13px] font-bold transition-colors sm:px-4 sm:text-[14px] ${
                    sort === "new" ? "bg-[#fa3250] text-white" : "text-[#6e6a72] hover:text-[#1a1a1a]"
                  }`}
                >
                  {t.home.sortNew}
                </Link>
              </div>
            )}

            <div className="inline-flex shrink-0 rounded-full border border-[#e9e0d6] bg-white p-0.5 sm:p-1">
              <Link
                href={feedHref({ vue: null })}
                aria-current={!mapView ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-bold transition-colors sm:px-3.5 sm:text-[14px] ${
                  !mapView ? "bg-[#1a1a1a] text-white" : "text-[#6e6a72] hover:text-[#1a1a1a]"
                }`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="hidden shrink-0 min-[360px]:block"
                >
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
                href={feedHref({ vue: "carte" })}
                aria-current={mapView ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-bold transition-colors sm:px-3.5 sm:text-[14px] ${
                  mapView ? "bg-[#1a1a1a] text-white" : "text-[#6e6a72] hover:text-[#1a1a1a]"
                }`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="hidden shrink-0 min-[360px]:block"
                >
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
        <IssueList query={`${sort}:${category ?? ""}:${query}`}>
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
                <IssueCard issue={issue} canVote={Boolean(user)} lang={lang} />
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
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
