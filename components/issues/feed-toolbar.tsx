"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/utils/issues";

type CategoryOption = {
  key: Category;
  label: string;
  count: number;
};

export function FeedToolbar({
  listHref,
  mapHref,
  sort,
  selectedCategories,
  categories,
  labels,
}: {
  listHref: string;
  mapHref: string;
  sort: "top" | "new";
  selectedCategories: Category[];
  categories: CategoryOption[];
  labels: {
    viewList: string;
    viewMap: string;
    filters: string;
    sortLabel: string;
    sortTop: string;
    sortNew: string;
    filterCategories: string;
    allCategories: string;
    resetFilters: string;
    applyFilters: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState(360);
  const [pending, startTransition] = useTransition();
  const selected = new Set(selectedCategories);
  const [draftSort, setDraftSort] = useState(sort);
  const [draftCategories, setDraftCategories] = useState<Category[]>(selectedCategories);
  const draftSelected = new Set(draftCategories);
  const totalCount = categories.reduce((total, category) => total + category.count, 0);
  const activeCount = selected.size + Number(sort === "new");
  const hasChanges =
    draftSort !== sort ||
    draftCategories.length !== selectedCategories.length ||
    draftCategories.some((category) => !selected.has(category));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const fitPanelToViewport = () => {
      const top = popoverRef.current?.getBoundingClientRect().top;
      if (top !== undefined) {
        setPanelMaxHeight(Math.max(280, window.innerHeight - top - 16));
      }
    };
    const frame = window.requestAnimationFrame(fitPanelToViewport);
    window.addEventListener("resize", fitPanelToViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", fitPanelToViewport);
    };
  }, [open]);

  const update = (nextSort: "top" | "new", nextCategories: Category[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSort === "new") params.set("tri", "recents");
    else params.delete("tri");
    if (nextCategories.length > 0) params.set("cat", nextCategories.join(","));
    else params.delete("cat");
    params.delete("n");
    const query = params.toString();
    startTransition(() => router.replace(query ? pathname + "?" + query : pathname, { scroll: false }));
  };

  const togglePanel = () => {
    if (!open) {
      setDraftSort(sort);
      setDraftCategories(selectedCategories);
    }
    setOpen((value) => !value);
  };

  const toggleCategory = (category: Category) => {
    setDraftCategories((current) =>
      current.includes(category)
        ? current.filter((key) => key !== category)
        : [...current, category],
    );
  };

  const applyFilters = () => {
    if (hasChanges) update(draftSort, draftCategories);
    setOpen(false);
  };

  return (
    <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
      <nav
        aria-label={labels.viewList + " / " + labels.viewMap}
        className="inline-flex shrink-0 rounded-full border border-[#e9e0d6] bg-white p-0.5 sm:p-1"
      >
        <Link
          href={listHref}
          aria-current="page"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] px-2.5 py-1.5 text-[13px] font-semibold text-white sm:px-3.5 sm:text-[14px]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="hidden shrink-0 min-[360px]:block">
            <path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {labels.viewList}
        </Link>
        <Link
          href={mapHref}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-[#6e6a72] transition-colors hover:text-[#1a1a1a] sm:px-3.5 sm:text-[14px]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="hidden shrink-0 min-[360px]:block">
            <path d="m4 5 5-2 6 2 5-2v16l-5 2-6-2-5 2V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M9 3v16m6-14v16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {labels.viewMap}
        </Link>
      </nav>

      <div ref={panelRef} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="forum-filter-panel"
          aria-busy={pending}
          disabled={pending}
          onClick={togglePanel}
          className={
            "map-filter-trigger inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors " +
            (open
              ? "border-[#fa3250] bg-[#fa3250] text-white"
              : "border-[#e9e0d6] bg-white text-[#2a2a86] hover:border-[#fa3250] hover:text-[#fa3250]")
          }
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {labels.filters}
          {activeCount > 0 && (
            <span className={"grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] tabular-nums " + (open ? "bg-white text-[#fa3250]" : "bg-[#fa3250] text-white")}>
              {activeCount}
            </span>
          )}
        </button>

        {open && (
          <div
            ref={popoverRef}
            id="forum-filter-panel"
            style={{ maxHeight: panelMaxHeight }}
            className="absolute -right-[15px] top-[calc(100%+8px)] z-30 flex w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-[12px] border border-[#ded7d0] bg-[#fffdfb] shadow-[0_8px_24px_rgba(31,22,16,0.08)] sm:right-0"
          >
            <div className="shrink-0 px-4 py-4">
              <p className="mb-2 text-[13px] font-semibold text-[#373238]">{labels.sortLabel}</p>
              <div className="grid grid-cols-2 rounded-[12px] bg-[#f1ede8] p-1">
                <FilterOption active={draftSort === "top"} onClick={() => setDraftSort("top")}>
                  {labels.sortTop}
                </FilterOption>
                <FilterOption active={draftSort === "new"} onClick={() => setDraftSort("new")}>
                  {labels.sortNew}
                </FilterOption>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#e9e2dc] px-2 pb-2 pt-3">
              <p id="feed-filter-categories" className="mb-1 px-2 text-[13px] font-semibold text-[#373238]">
                {labels.filterCategories}
              </p>
              <div
                role="group"
                aria-labelledby="feed-filter-categories"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
              >
                  <button
                    type="button"
                    aria-pressed={draftSelected.size === 0}
                    onClick={() => setDraftCategories([])}
                    className={categoryClass(draftSelected.size === 0)}
                  >
                    <span>{labels.allCategories}</span>
                    <span className="ml-auto text-[12px] font-medium text-[#8a858c] tabular-nums">{totalCount}</span>
                    <Check active={draftSelected.size === 0} />
                  </button>
                  {categories.map((category) => {
                    const active = draftSelected.has(category.key);
                    return (
                      <button
                        key={category.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleCategory(category.key)}
                        className={categoryClass(active)}
                      >
                        <span className="min-w-0 truncate">{category.label}</span>
                        <span className="ml-auto text-[12px] font-medium text-[#8a858c] tabular-nums">{category.count}</span>
                        <Check active={active} />
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e9e2dc] bg-white px-4 py-3">
              <button
                type="button"
                disabled={draftSort === "top" && draftCategories.length === 0}
                onClick={() => {
                  setDraftSort("top");
                  setDraftCategories([]);
                }}
                className="map-filter-option min-h-9 px-1 text-[13px] font-semibold text-[#2a2a86] underline-offset-4 hover:text-[#fa3250] hover:underline disabled:cursor-default disabled:text-[#aaa4a8] disabled:no-underline"
              >
                {labels.resetFilters}
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="map-filter-option min-h-9 rounded-[10px] border border-[#fa3250] bg-[#fa3250] px-5 text-[13px] font-semibold text-white transition-colors hover:border-[#d81f3c] hover:bg-[#d81f3c]"
              >
                {labels.applyFilters}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "map-filter-option min-h-9 rounded-[9px] px-3 text-center text-[13px] font-semibold transition-colors " +
        (active
          ? "border border-[#fa3250] bg-white text-[#fa3250] shadow-[0_1px_2px_rgba(250,50,80,0.08)]"
          : "border border-transparent text-[#6e686e] hover:text-[#2a2a86]")
      }
    >
      {children}
    </button>
  );
}

function categoryClass(active: boolean) {
  return (
    "map-filter-option flex min-h-10 w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[#f5f1ed] " +
    (active ? "font-semibold text-[#2a2a86]" : "font-normal text-[#625d63]")
  );
}

function Check({ active }: { active: boolean }) {
  return (
    <span className={"grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[3px] border " + (active ? "border-[#fa3250] bg-[#fa3250] text-white" : "border-[#bdb5ae] bg-white")}>
      {active && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 6.2 2.1 2.1 4.8-4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
