"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { MUTED } from "@/components/ui/styles";
import {
  STATUS_MAP_COLORS,
  isLocated,
  isSettled,
  type Category,
  type Issue,
  type Status,
} from "@/utils/issues";
import { type Locale } from "@/utils/i18n";
import {
  addBasemap,
  BOROUGH_BOUNDS,
  BOROUGH_CENTER,
  MAP_OPTIONS,
} from "@/utils/map";

export type IssueMapLabels = {
  mapLabel: string;
  categories: Record<Category, string>;
  statuses: Record<Status, string>;
  viewList: string;
  viewMap: string;
  filters: string;
  filterCategories: string;
  filterStatuses: string;
  searchPlaceholder: string;
  clearSearch: string;
  showAll: string;
  onlyOpen: string;
  onlySettled: string;
  located: string;
  unlocated: string;
  empty: string;
  open: string;
  replyOne: string;
  replyMany: string;
};

export type IssueMapToolbar = {
  listHref: string;
  activeCategories: Category[];
  categories: Array<{
    key: Category;
    label: string;
    count: number;
  }>;
};

type Filter = "all" | "open" | "settled";

const COLLAPSED_SHEET_HEIGHT = 52;

/** Desktop split view and mobile two-position map sheet. */
export function IssueMap({
  issues,
  lang,
  labels,
  toolbar,
}: {
  issues: Issue[];
  lang: Locale;
  labels: IssueMapLabels;
  toolbar: IssueMapToolbar;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(
    () => new Set(toolbar.activeCategories),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const [markers] = useState(() => new Map<string, Marker>());
  const dragRef = useRef<{
    startY: number;
    startOffset: number;
    distance: number;
    current: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const located = useMemo(() => issues.filter(isLocated), [issues]);
  const unlocated = issues.length - located.length;
  const normalizedQuery = query.trim().toLocaleLowerCase(lang);
  const shown = useMemo(
    () =>
      located.filter((issue) => {
        const matchesCategory =
          selectedCategories.size === 0 || selectedCategories.has(issue.category);
        const matchesStatus =
          filter === "all"
            ? true
            : filter === "settled"
              ? isSettled(issue.status)
              : !isSettled(issue.status);
        const matchesQuery =
          normalizedQuery.length === 0 ||
          `${issue.title} ${issue.body}`.toLocaleLowerCase(lang).includes(normalizedQuery);
        return matchesCategory && matchesStatus && matchesQuery;
      }),
    [filter, lang, located, normalizedQuery, selectedCategories],
  );
  const visibleSelected = shown.some((issue) => issue.id === selected) ? selected : null;
  const active = hovered ?? visibleSelected;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, MAP_OPTIONS);
      mapRef.current = map;
      map.scrollWheelZoom.enable();
      map.setView(BOROUGH_CENTER, 12, { animate: false });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      await addBasemap(L, map);
      layerRef.current = L.layerGroup().addTo(map);

      observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      observer.observe(containerRef.current);
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
      setMapReady(false);
    };
  }, [markers]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!mapReady) return;
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;

      map.setMinZoom(0);
      map.invalidateSize({ animate: false });

      const mobile = !window.matchMedia("(min-width: 1024px)").matches;
      const coveredHeight = mobile
        ? sheetCollapsed
          ? COLLAPSED_SHEET_HEIGHT
          : (sheetRef.current?.offsetHeight ?? 0)
        : 0;

      if (mobile && !sheetCollapsed) {
        // The map still fills the workspace behind the sheet. Centre the
        // borough in the small exposed strip, not in the hidden full canvas.
        map.setView(BOROUGH_CENTER, 12, { animate: false });
        map.panBy([0, coveredHeight / 2], { animate: false });
        map.setMinZoom(11);
      } else {
        map.fitBounds(L.latLngBounds(BOROUGH_BOUNDS), {
          animate: false,
          padding: [14, 14],
        });
        map.setMinZoom(map.getZoom());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, sheetCollapsed]);

  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;

    (async () => {
      if (!mapReady) return;
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;

      // Normal exploration is unrestricted. We intervene only after the user
      // has left every visible pin behind and moved far beyond the borough.
      const distantLimit = L.latLngBounds(BOROUGH_BOUNDS).pad(4);
      const onMoveEnd = () => {
        if (shown.length === 0) return;

        const viewport = map.getBounds();
        const hasVisiblePin = shown.some((issue) => viewport.contains([issue.lat!, issue.lon!]));
        if (hasVisiblePin || distantLimit.contains(map.getCenter())) return;

        map.panTo(BOROUGH_CENTER, { animate: true, duration: 0.45 });
      };

      map.on("moveend", onMoveEnd);
      detach = () => map.off("moveend", onMoveEnd);
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [mapReady, shown]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setSheetCollapsed(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!mapReady) return;
      const L = await import("leaflet");
      const layer = layerRef.current;
      if (cancelled || !layer) return;

      layer.clearLayers();
      markers.clear();

      for (const issue of shown) {
        const marker = L.marker([issue.lat!, issue.lon!], {
          title: issue.title,
          icon: issueMarker(L, issue.status, false),
        });
        marker.bindPopup(
          `<strong style="font-size:14px">${escapeHtml(issue.title)}</strong>` +
            `<br><span style="color:#6e6a72">${escapeHtml(labels.statuses[issue.status])} &middot; ${issue.voteCount}</span>` +
            `<br><a href="/${lang}/sujets/${issue.id}" style="color:#a3162c;font-weight:700">${escapeHtml(labels.open)}</a>`,
          { maxWidth: Math.min(300, (containerRef.current?.clientWidth ?? 300) - 32) },
        );
        marker.on("mouseover", () => setHovered(issue.id));
        marker.on("mouseout", () => setHovered(null));
        marker.on("click", () => {
          setSelected(issue.id);
          if (sheetCollapsed) return;
          requestAnimationFrame(() => {
            document.getElementById(`map-issue-${issue.id}`)?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          });
        });
        marker.addTo(layer);
        markers.set(issue.id, marker);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, labels, mapReady, markers, sheetCollapsed, shown]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      for (const issue of shown) {
        markers.get(issue.id)?.setIcon(issueMarker(L, issue.status, active === issue.id));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, markers, shown]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const distance = Math.max((sheetRef.current?.offsetHeight ?? 0) - COLLAPSED_SHEET_HEIGHT, 0);
    const start = sheetCollapsed ? distance : 0;
    dragRef.current = {
      startY: event.clientY,
      startOffset: start,
      distance,
      current: start,
      moved: false,
    };
    setDragDistance(distance);
    setDragY(start);

    const pointerId = event.pointerId;
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onCancel);
    };
    const onMove = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== pointerId) return;
      const delta = pointerEvent.clientY - drag.startY;
      drag.current = Math.min(
        Math.max(drag.startOffset + delta, 0),
        drag.distance,
      );
      if (Math.abs(delta) > 5) drag.moved = true;
      setDragY(drag.current);
      pointerEvent.preventDefault();
    };
    const onEnd = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== pointerId) return;
      const finalPosition = Math.min(
        Math.max(drag.startOffset + pointerEvent.clientY - drag.startY, 0),
        drag.distance,
      );
      const moved = drag.moved || Math.abs(pointerEvent.clientY - drag.startY) > 5;
      suppressClickRef.current = moved;
      setSheetCollapsed(finalPosition > drag.distance / 2);
      setDragY(null);
      dragRef.current = null;
      cleanup();
    };
    const onCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      setDragY(null);
      dragRef.current = null;
      cleanup();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onCancel);
  };

  const toggleSheet = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setSheetCollapsed((value) => !value);
  };

  const sheetOffset =
    dragY === null ? (sheetCollapsed ? `calc(100% - ${COLLAPSED_SHEET_HEIGHT}px)` : "0px") : `${dragY}px`;
  const dimOpacity =
    dragY === null
      ? sheetCollapsed
        ? 0
        : 0.16
      : dragDistance > 0
        ? 0.16 * (1 - dragY / dragDistance)
        : 0.16;
  const sheetStyle = {
    "--map-sheet-y": sheetOffset,
    "--map-sheet-height": "calc(100% - clamp(205px, 27dvh, 240px))",
  } as CSSProperties;
  const activeFilterCount = selectedCategories.size + Number(filter !== "all");
  const toggleCategory = (category: Category) => {
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={filtersRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2.5 lg:p-3 lg:pr-[max(33.333%,404px)]"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:gap-3">
          <nav
            aria-label={`${labels.viewList} / ${labels.viewMap}`}
            className="pointer-events-auto inline-flex shrink-0 rounded-full border border-[#ded6cd] bg-[#f7f3ee] p-0.5 shadow-[0_2px_8px_rgba(26,26,26,0.12)] lg:p-1"
          >
            <Link
              href={toolbar.listHref}
              aria-label={labels.viewList}
              title={labels.viewList}
              className="grid h-8 w-8 place-items-center rounded-full text-[#6e6a72] transition-colors hover:text-[#1a1a1a] lg:h-10 lg:w-10"
            >
              <svg className="lg:h-[18px] lg:w-[18px]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 6.5h14M5 12h14M5 17.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </Link>
            <span
              aria-current="page"
              aria-label={labels.viewMap}
              title={labels.viewMap}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#1a1a1a] text-white lg:h-10 lg:w-10"
            >
              <svg className="lg:h-[18px] lg:w-[18px]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m4 5 5-2 6 2 5-2v16l-5 2-6-2-5 2V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M9 3v16m6-14v16" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </nav>

          <label className="pointer-events-auto relative mx-auto flex h-9 w-full max-w-[420px] items-center rounded-full border border-[#ded6cd] bg-white shadow-[0_2px_8px_rgba(26,26,26,0.12)] lg:h-12 lg:max-w-[560px]">
            <svg className="ml-3 shrink-0 text-[#6e6a72] lg:ml-4 lg:h-[18px] lg:w-[18px]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15.5 15.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFiltersOpen(false)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13px] font-medium text-[#1a1a1a] outline-none placeholder:text-[#8a858c] lg:px-3 lg:text-[15px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                aria-label={labels.clearSearch}
                onClick={() => setQuery("")}
                className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#6e6a72] hover:bg-[#f4eee8] hover:text-[#1a1a1a] lg:mr-1.5 lg:h-9 lg:w-9"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </label>

          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="map-filter-panel"
            onClick={() => setFiltersOpen((value) => !value)}
            className={`map-filter-trigger pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-bold shadow-[0_2px_8px_rgba(26,26,26,0.12)] transition-colors sm:px-3.5 lg:h-12 lg:gap-2.5 lg:px-5 lg:text-[15px] ${
              filtersOpen
                ? "border-[#a3162c] bg-[#a3162c] text-white"
                : "border-[#ded6cd] bg-white text-[#2a2a86] hover:border-[#a3162c] hover:text-[#a3162c]"
            }`}
          >
            <svg className="lg:h-[18px] lg:w-[18px]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden min-[360px]:inline">{labels.filters}</span>
            {activeFilterCount > 0 && (
              <span
                className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] tabular-nums lg:h-6 lg:min-w-6 lg:text-[12px] ${
                  filtersOpen ? "bg-white text-[#a3162c]" : "bg-[#a3162c] text-white"
                }`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div
            id="map-filter-panel"
            className="pointer-events-auto absolute inset-x-3.5 top-[54px] z-30 max-h-[calc(100dvh-128px)] overflow-y-auto rounded-[14px] border border-[#ded7d0] bg-[#fffdfb] shadow-[0_8px_24px_rgba(31,22,16,0.08)] lg:inset-x-auto lg:right-[max(33.333%,404px)] lg:top-[72px] lg:w-[400px] lg:rounded-[12px]"
          >
            <div className="px-5 pb-5 pt-5">
              <p className="text-[14px] font-semibold text-[#373238]">
                {labels.filterCategories}
              </p>
              <div className="mt-3 space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategories(new Set())}
                  aria-pressed={selectedCategories.size === 0}
                  className={filterLinkClass(selectedCategories.size === 0)}
                >
                  <span className="min-w-0 flex-1">{labels.showAll}</span>
                  <span className="text-[12px] font-medium text-[#8a858c] tabular-nums">
                    {toolbar.categories.reduce((sum, category) => sum + category.count, 0)}
                  </span>
                  <FilterCheck active={selectedCategories.size === 0} square />
                </button>
                {toolbar.categories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => toggleCategory(category.key)}
                    aria-pressed={selectedCategories.has(category.key)}
                    className={filterLinkClass(selectedCategories.has(category.key))}
                  >
                    <span className="min-w-0 flex-1 truncate">{category.label}</span>
                    <span className="text-[12px] font-medium text-[#8a858c] tabular-nums">
                      {category.count}
                    </span>
                    <FilterCheck active={selectedCategories.has(category.key)} square />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#e9e2dc] px-5 pb-5 pt-4">
              <div>
                <p className="text-[14px] font-semibold text-[#373238]">
                  {labels.filterStatuses}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-1 rounded-[12px] bg-[#f1ede8] p-1.5">
                  <StatusSegment active={filter === "all"} onClick={() => setFilter("all")}>
                    {labels.showAll}
                  </StatusSegment>
                  <StatusSegment active={filter === "open"} onClick={() => setFilter("open")}>
                    {labels.onlyOpen}
                  </StatusSegment>
                  <StatusSegment active={filter === "settled"} onClick={() => setFilter("settled")}>
                    {labels.onlySettled}
                  </StatusSegment>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {located.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center bg-[#fef7f0] p-6 text-center">
          <p className={MUTED}>{labels.empty}</p>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={containerRef}
            role="region"
            aria-label={labels.mapLabel}
            className="absolute inset-0 z-0 min-h-0 bg-[#dfe6dc]"
          />

          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-[1] bg-[#17121a] lg:hidden ${
              dragY === null ? "transition-opacity duration-300" : ""
            }`}
            style={{ opacity: dimOpacity }}
          />

          <aside
            ref={sheetRef}
            aria-label={labels.mapLabel}
            style={sheetStyle}
            className={`absolute inset-x-0 bottom-0 z-[2] flex h-[var(--map-sheet-height)] min-h-0 translate-y-[var(--map-sheet-y)] flex-col overflow-hidden rounded-t-[18px] border-t border-[#e9e0d6] bg-[#fef7f0] shadow-[0_-3px_14px_rgba(26,26,26,0.08)] lg:inset-y-3 lg:left-auto lg:right-3 lg:h-auto lg:w-[calc(33.333%-24px)] lg:min-w-[380px] lg:translate-y-0 lg:rounded-[18px] lg:border lg:border-[#ded5cc] lg:bg-white lg:shadow-[0_8px_24px_rgba(26,26,26,0.14)] ${
              dragY === null ? "transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)]" : ""
            }`}
          >
            <button
              type="button"
              aria-expanded={!sheetCollapsed}
              aria-controls="map-results"
              onClick={toggleSheet}
              onPointerDown={startDrag}
              className="map-sheet-toggle relative flex h-[52px] shrink-0 touch-none items-center justify-center border-b border-[#eee6dd] bg-white lg:hidden"
            >
              <span className="map-sheet-grip absolute top-2.5 h-1 w-10 rounded-full bg-[#c7c0b8]" aria-hidden="true" />
              <span className="mt-2 text-[13px] font-bold text-[#6e6a72]">
                {shown.length} {labels.located}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className={`absolute right-4 mt-2 transition-transform ${sheetCollapsed ? "rotate-180" : ""}`}
              >
                <path d="m7 9 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="hidden min-h-[50px] shrink-0 items-center border-b border-[#e9e0d6] bg-white px-5 lg:flex">
              <ResultCount shown={shown.length} unlocated={unlocated} labels={labels} />
            </div>

            <ul
              id="map-results"
              inert={sheetCollapsed}
              aria-hidden={sheetCollapsed}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:none] sm:p-4 lg:bg-transparent lg:p-3 lg:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:block"
            >
              {shown.map((issue) => {
                const isActive = active === issue.id;
                return (
                  <li key={issue.id} id={`map-issue-${issue.id}`}>
                    <Link
                      href={`/${lang}/sujets/${issue.id}`}
                      onMouseEnter={() => setHovered(issue.id)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(issue.id)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setSelected(issue.id)}
                      className={`group block rounded-[15px] border bg-white px-4 py-3.5 transition-[border-color,background-color,box-shadow] sm:px-5 sm:py-4 lg:px-4 lg:py-3.5 ${
                        isActive
                          ? "border-[#2a2a86] shadow-[0_3px_12px_rgba(26,26,26,0.08)]"
                          : "border-[#e5dcd2] hover:border-[#bdb1a5] hover:shadow-[0_3px_12px_rgba(26,26,26,0.06)]"
                      }`}
                    >
                      <span className="block text-[12px] font-bold leading-[18px] text-[#5d56b4]">
                        {labels.categories[issue.category]}
                      </span>
                      <span className="mt-0.5 block max-h-[48px] overflow-hidden text-[17px] font-bold leading-[23px] tracking-[-0.01em] group-hover:text-[#2a2a86]">
                        {issue.title}
                      </span>
                      <span className={`mt-1.5 block max-h-[42px] overflow-hidden text-[14px] leading-[21px] ${MUTED}`}>
                        {issue.body}
                      </span>

                      <span className="mt-3 flex items-center gap-3 border-t border-[#f2ece4] pt-2.5 text-[12px] leading-[18px] text-[#6e6a72]">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-[#5d56b4] tabular-nums">
                          <UpvoteIcon />
                          {issue.voteCount}
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                          <ReplyIcon />
                          {issue.commentCount}
                        </span>
                        <span
                          className="ml-auto inline-flex items-center whitespace-nowrap font-bold"
                          style={{ color: STATUS_MAP_COLORS[issue.status] }}
                        >
                          {labels.statuses[issue.status]}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}

              {shown.length === 0 && (
                <li className="rounded-[15px] border border-[#e9e0d6] bg-white p-6 text-center">
                  <p className={MUTED}>{labels.empty}</p>
                </li>
              )}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}

function ResultCount({
  shown,
  unlocated,
  labels,
}: {
  shown: number;
  unlocated: number;
  labels: IssueMapLabels;
}) {
  return (
    <p className={`shrink-0 whitespace-nowrap text-[13px] ${MUTED}`} aria-live="polite">
      <strong className="font-bold text-[#1a1a1a] tabular-nums">{shown}</strong> {labels.located}
      {unlocated > 0 ? ` · ${unlocated} ${labels.unlocated}` : ""}
    </p>
  );
}

/** Circular symbols mirror the map's three states without relying on colour. */
function issueMarker(L: typeof import("leaflet"), status: Status, raised: boolean) {
  const size = raised ? 44 : 36;
  const color = STATUS_MAP_COLORS[status];
  const glyph =
    status === "resolved"
      ? `<path d="M13 19.5l4.2 4.2 8-8.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : status === "answered"
        ? `<rect x="14" y="14" width="12" height="12" rx="2" fill="#fff"/>`
        : `<path d="M20 12.5v10M20 27h.01" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`;

  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 40 44" style="filter:drop-shadow(0 2px 3px rgba(26,26,26,.3))">
      <path d="M16.5 34h7L20 41l-3.5-7Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="20" cy="20" r="16" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      ${glyph}
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 5],
  });
}

function filterLinkClass(active: boolean) {
  return `map-filter-option flex min-h-[42px] min-w-0 items-center justify-between gap-3 rounded-[9px] px-3 py-2 text-left text-[13px] leading-[18px] transition-colors ${
    active
      ? "bg-[#f8f3ee] font-semibold text-[#1a1a1a]"
      : "font-medium text-[#6e6a72] hover:bg-[#f8f3ee] hover:text-[#1a1a1a]"
  }`;
}

function FilterCheck({ active, square = false }: { active: boolean; square?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-[17px] w-[17px] shrink-0 place-items-center border ${square ? "rounded-[3px]" : "rounded-full"} ${
        active ? "border-[#a3162c] bg-[#a3162c] text-white" : "border-[#cfc6bd]"
      }`}
    >
      {active && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="m2.5 6.2 2.1 2.1 4.8-4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function StatusSegment({
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
      onClick={onClick}
      aria-pressed={active}
      className={`map-filter-option inline-flex min-h-10 min-w-0 items-center justify-center rounded-[9px] border px-2.5 text-[12px] font-semibold leading-[18px] transition-colors ${
        active
          ? "border-[#a3162c] bg-white text-[#a3162c] shadow-[0_1px_2px_rgba(250,50,80,0.08)]"
          : "border-transparent text-[#6e686e] hover:text-[#2a2a86]"
      }`}
    >
      {children}
    </button>
  );
}

function UpvoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 11.5a8 8 0 0 1-8.5 8 8.8 8.8 0 0 1-3.1-.6L3 20.5l1.7-4.8A7.8 7.8 0 0 1 4 11.5a8 8 0 0 1 16 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Popup content is built as an HTML string, so titles must be escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
