"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { trackContentOpen } from "@/components/analytics/content-view-tracker";
import { MUTED } from "@/components/ui/styles";
import {
  ACCENT,
  ACCENT_TODAY,
  DEFAULT_RADIUS,
  RADII,
  distanceMeters,
  formatDateRange,
  formatDistance,
  isMappable,
  isNearby,
  isOngoing,
  matches,
  windowEnd,
  type BoroughEvent,
  type Origin,
  type Radius,
  type Setting,
  type When,
} from "@/utils/events";
import {
  addBasemap,
  BOROUGH_BOUNDS,
  BOROUGH_CENTER,
  MAP_OPTIONS,
} from "@/utils/map";

export type MapLabels = {
  allTypes: string;
  type: string;
  mapLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  filters: string;
  filterWhen: string;
  filterSetting: string;
  when: Record<When, string>;
  settings: Record<Setting, string>;
  allSettings: string;
  todayPill: string;
  eventOne: string;
  eventMany: string;
  noneTitle: string;
  noneBody: string;
  details: string;
  online: string;
  unmapped: string;
  showAll: string;
  showMore: string;
  nearbyHint: string;
  nearbyLabel: string;
  nearbyClear: string;
  nearbyNoneTitle: string;
  nearbyNoneBody: string;
  source: string;
};

const COLLAPSED_SHEET_HEIGHT = 52;
const RESULTS_PAGE = 30;

/** Full-screen event map, with a desktop results rail and a two-position mobile sheet. */
export function EventMap({
  events,
  locale,
  labels,
}: {
  events: BoroughEvent[];
  locale: string;
  labels: MapLabels;
}) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<When>("all");
  const [setting, setSetting] = useState<Setting | "">("");
  const [type, setType] = useState("");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radius, setRadius] = useState<Radius>(DEFAULT_RADIUS);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  const [listLimit, setListLimit] = useState(RESULTS_PAGE);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const areaRef = useRef<LayerGroup | null>(null);
  const [markers] = useState(() => new Map<string, Marker>());
  const dragRef = useRef<{
    startY: number;
    startOffset: number;
    distance: number;
    current: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const types = useMemo(
    () => [...new Set(events.map((event) => event.eventType).filter(Boolean))].sort() as string[],
    [events],
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const filtered = useMemo(() => {
    const until = windowEnd(when, today);
    return events.filter((event) => {
      if (type && event.eventType !== type) return false;
      if (setting && event.setting !== setting) return false;
      if (until && event.startsOn > until) return false;
      if (origin && !isNearby(event, origin, radius)) return false;
      return matches(event, query);
    });
  }, [events, origin, query, radius, setting, today, type, when]);
  const mappable = useMemo(() => filtered.filter(isMappable), [filtered]);
  const hidden = filtered.length - mappable.length;
  const active = hovered ?? (filtered.some((event) => event.id === selected) ? selected : null);
  const visible = filtered.slice(0, listLimit);
  const remaining = filtered.length - visible.length;
  const activeFilterCount =
    Number(when !== "all") + Number(Boolean(setting)) + Number(Boolean(type)) + Number(Boolean(origin));
  const hasFilter = Boolean(query || activeFilterCount);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const recordPopupOpen = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[data-track-event]");
      const eventId = link?.dataset.trackEvent;
      if (eventId) trackContentOpen("event", eventId);
    };
    container.addEventListener("click", recordPopupOpen);
    return () => container.removeEventListener("click", recordPopupOpen);
  }, []);

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

      map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        setOrigin({ lat: event.latlng.lat, lon: event.latlng.lng });
      });

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
      areaRef.current = null;
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

      const distantLimit = L.latLngBounds(BOROUGH_BOUNDS).pad(4);
      const onMoveEnd = () => {
        if (mappable.length === 0) return;
        const viewport = map.getBounds();
        const hasVisiblePin = mappable.some((event) => viewport.contains([event.lat!, event.lon!]));
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
  }, [mapReady, mappable]);

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
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;

      areaRef.current?.remove();
      areaRef.current = null;
      if (!origin) return;
      areaRef.current = L.layerGroup([
        L.circle([origin.lat, origin.lon], {
          radius,
          color: ACCENT,
          weight: 2,
          opacity: 0.7,
          dashArray: "5 5",
          fillColor: ACCENT,
          fillOpacity: 0.08,
          interactive: false,
        }),
        L.circleMarker([origin.lat, origin.lon], {
          radius: 5,
          color: "#fff",
          weight: 2,
          fillColor: "#1a1a1a",
          fillOpacity: 1,
          interactive: false,
        }),
      ]).addTo(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, radius]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapReady) return;
      const L = await import("leaflet");
      const layer = layerRef.current;
      if (cancelled || !layer) return;

      layer.clearLayers();
      markers.clear();
      const frame = containerRef.current?.clientWidth ?? 0;
      const popupMaxWidth = frame > 0 ? Math.min(300, frame - 32) : 300;

      for (const event of mappable) {
        const marker = L.marker([event.lat!, event.lon!], {
          title: event.title,
          icon: eventMarker(L, isOngoing(event, today), false),
        });
        const place = [event.venueName, event.address].filter(Boolean).join(" · ");
        marker.bindPopup(
          `<strong style="font-size:14px">${escapeHtml(event.title)}</strong>` +
            `<br><span style="color:#6e6a72">${escapeHtml(formatDateRange(event.startsOn, event.endsOn, locale))}</span>` +
            (place ? `<br><span style="color:#6e6a72">${escapeHtml(place)}</span>` : "") +
            `<br><a href="${escapeHtml(event.sourceUrl)}" data-track-event="${escapeHtml(event.id)}" target="_blank" rel="noreferrer" style="color:#a3162c;font-weight:700">${escapeHtml(labels.details)}</a>`,
          { maxWidth: popupMaxWidth },
        );
        marker.on("mouseover", () => setHovered(event.id));
        marker.on("mouseout", () => setHovered(null));
        marker.on("click", () => {
          setSelected(event.id);
          if (sheetCollapsed) return;
          const listIndex = filtered.findIndex((item) => item.id === event.id);
          if (listIndex >= 0) setListLimit((current) => Math.max(current, listIndex + 1));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              document.getElementById(`map-event-${event.id}`)?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            });
          });
        });
        marker.addTo(layer);
        markers.set(event.id, marker);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered, labels.details, locale, mapReady, markers, mappable, sheetCollapsed, today]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      for (const event of mappable) {
        markers
          .get(event.id)
          ?.setIcon(eventMarker(L, isOngoing(event, today), active === event.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, markers, mappable, today]);

  const clearAll = () => {
    setQuery("");
    setWhen("all");
    setSetting("");
    setType("");
    setOrigin(null);
  };

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
      drag.current = Math.min(Math.max(drag.startOffset + delta, 0), drag.distance);
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
    dragY === null
      ? sheetCollapsed
        ? `calc(100% - ${COLLAPSED_SHEET_HEIGHT}px)`
        : "0px"
      : `${dragY}px`;
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

  return (
    <section className="event-map-workspace relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={filtersRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2.5 lg:p-3 lg:pr-[max(33.333%,404px)]"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:gap-3">
          <label className="pointer-events-auto relative flex h-9 w-full max-w-[680px] items-center rounded-full border border-[#ded6cd] bg-white shadow-[0_2px_8px_rgba(26,26,26,0.12)] transition-colors focus-within:border-[#5d56b4] lg:h-12 lg:max-w-[760px]">
            <SearchIcon />
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
                <CloseIcon />
              </button>
            )}
          </label>

          <button
            type="button"
            aria-label={labels.filters}
            aria-expanded={filtersOpen}
            aria-controls="event-map-filter-panel"
            onClick={() => setFiltersOpen((value) => !value)}
            className={`map-filter-trigger pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold shadow-[0_2px_8px_rgba(26,26,26,0.12)] transition-colors sm:px-3.5 lg:h-12 lg:gap-2.5 lg:px-5 lg:text-[15px] ${
              filtersOpen
                ? "border-[#a3162c] bg-[#a3162c] text-white"
                : "border-[#ded6cd] bg-white text-[#2a2a86] hover:border-[#a3162c] hover:text-[#a3162c]"
            }`}
          >
            <FilterIcon />
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
            id="event-map-filter-panel"
            className="pointer-events-auto absolute inset-x-2.5 top-[52px] z-30 max-h-[calc(100dvh-124px)] overflow-y-auto rounded-[12px] border border-[#ded7d0] bg-[#fffdfb] shadow-[0_8px_24px_rgba(31,22,16,0.08)] lg:inset-x-auto lg:right-[max(33.333%,404px)] lg:top-[72px] lg:w-[400px]"
          >
            <fieldset aria-labelledby="event-filter-date-label" className="px-5 py-5">
              <p id="event-filter-date-label" className="text-[13px] font-semibold leading-[19px] text-[#373238]">
                {labels.filterWhen}
              </p>
              <div className="mt-3 grid grid-cols-2 rounded-[12px] bg-[#f1ede8] p-1">
                {(Object.keys(labels.when) as When[]).map((key) => (
                  <FilterOption
                    key={key}
                    active={when === key}
                    onClick={() => setWhen(key)}
                  >
                    {labels.when[key]}
                  </FilterOption>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-[#e9e2dc] px-5 py-5">
              <label className="block text-[13px] font-semibold text-[#373238]">
                {labels.type}
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="mt-2 min-h-10 w-full rounded-[10px] border border-[#ddd4cb] bg-white px-3 text-[13px] font-medium text-[#1a1a1a] outline-none transition-colors focus:border-[#5d56b4]"
                >
                  <option value="">{labels.allTypes}</option>
                  {types.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset aria-labelledby="event-filter-setting-label" className="border-t border-[#e9e2dc] px-5 py-5">
              <p id="event-filter-setting-label" className="text-[13px] font-semibold leading-[19px] text-[#373238]">
                {labels.filterSetting}
              </p>
              <div className="mt-3 grid grid-cols-2 rounded-[12px] bg-[#f1ede8] p-1">
                <FilterOption active={!setting} onClick={() => setSetting("")}>
                  {labels.allSettings}
                </FilterOption>
                {(Object.keys(labels.settings) as Setting[]).map((key) => (
                  <FilterOption
                    key={key}
                    active={setting === key}
                    onClick={() => setSetting(key)}
                  >
                    {labels.settings[key]}
                  </FilterOption>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-[#e9e2dc] px-5 py-5">
              {origin ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-[#373238]">{labels.nearbyLabel}</p>
                    <button
                      type="button"
                      onClick={() => setOrigin(null)}
                      className="text-[12px] font-semibold text-[#5d56b4] underline-offset-4 hover:text-[#a3162c] hover:underline"
                    >
                      {labels.nearbyClear}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {RADII.map((distance) => (
                      <button
                        key={distance}
                        type="button"
                        aria-pressed={radius === distance}
                        onClick={() => setRadius(distance)}
                        className={`min-h-9 rounded-full border px-2 text-[12px] font-semibold transition-colors ${
                          radius === distance
                            ? "border-[#5d56b4] bg-[#eeecfb] text-[#2a2a86]"
                            : "border-[#ddd4cb] text-[#6e6a72] hover:border-[#5d56b4]"
                        }`}
                      >
                        {formatDistance(distance, locale)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className={`flex items-start gap-2 text-[13px] leading-[19px] ${MUTED}`}>
                  <Crosshair />
                  {labels.nearbyHint}
                </p>
              )}
            </div>

            {hasFilter && (
              <div className="border-t border-[#e9e2dc] bg-white px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={clearAll}
                  className="min-h-9 rounded-[10px] border border-[#a3162c] bg-[#a3162c] px-5 text-[13px] font-semibold text-white transition-colors hover:border-[#c01f38] hover:bg-[#c01f38]"
                >
                  {labels.showAll}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={containerRef}
          role="region"
          aria-label={labels.mapLabel}
          className="absolute inset-0 z-0 min-h-0 cursor-crosshair bg-[#dfe6dc]"
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
            aria-controls="event-map-results"
            onClick={toggleSheet}
            onPointerDown={startDrag}
            className="map-sheet-toggle relative flex h-[52px] shrink-0 touch-none items-center justify-center border-b border-[#eee6dd] bg-white lg:hidden"
          >
            <span className="map-sheet-grip absolute top-2.5 h-1 w-10 rounded-full bg-[#c7c0b8]" aria-hidden="true" />
            <span className="mt-2 text-[13px] font-semibold text-[#6e6a72]">
              {filtered.length} {filtered.length === 1 ? labels.eventOne : labels.eventMany}
            </span>
            <ChevronIcon collapsed={sheetCollapsed} />
          </button>

          <div className="hidden min-h-[50px] shrink-0 items-center border-b border-[#e9e0d6] bg-white px-5 lg:flex">
            <ResultCount count={filtered.length} hidden={hidden} labels={labels} />
          </div>

          <ul
            id="event-map-results"
            inert={sheetCollapsed}
            aria-hidden={sheetCollapsed}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:none] sm:p-4 lg:bg-transparent lg:p-3 lg:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:block"
          >
            {visible.map((event) => (
              <li key={event.id} id={`map-event-${event.id}`}>
                <EventCard
                  event={event}
                  locale={locale}
                  labels={labels}
                  today={today}
                  origin={origin}
                  active={active === event.id}
                  onActive={() => setHovered(event.id)}
                  onInactive={() => setHovered(null)}
                  onSelect={() => setSelected(event.id)}
                />
              </li>
            ))}

            {filtered.length === 0 && (
              <li className="rounded-[15px] border border-[#e9e0d6] bg-white p-6 text-center">
                <p className="text-[16px] font-semibold text-[#1a1a1a]">
                  {origin ? labels.nearbyNoneTitle : labels.noneTitle}
                </p>
                <p className={`mt-1.5 text-[13px] leading-[19px] ${MUTED}`}>
                  {origin ? labels.nearbyNoneBody : labels.noneBody}
                </p>
              </li>
            )}

            {remaining > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setListLimit((current) => current + RESULTS_PAGE)}
                  className="min-h-10 w-full rounded-full border border-[#5d56b4] bg-white px-4 text-[13px] font-semibold text-[#2a2a86] transition-colors hover:bg-[#eeecfb]"
                >
                  {labels.showMore} <span className="tabular-nums">({remaining})</span>
                </button>
              </li>
            )}

            <li className={`px-2 pb-1 pt-2 text-[11px] leading-[17px] ${MUTED}`}>{labels.source}</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

function EventCard({
  event,
  locale,
  labels,
  today,
  origin,
  active,
  onActive,
  onInactive,
  onSelect,
}: {
  event: BoroughEvent;
  locale: string;
  labels: MapLabels;
  today: string;
  origin: Origin | null;
  active: boolean;
  onActive: () => void;
  onInactive: () => void;
  onSelect: () => void;
}) {
  const place = event.setting === "online" ? labels.online : event.venueName ?? event.address;
  const ongoing = isOngoing(event, today);

  return (
    <a
      href={event.sourceUrl}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        onSelect();
        trackContentOpen("event", event.id);
      }}
      onMouseEnter={onActive}
      onMouseLeave={onInactive}
      onFocus={onActive}
      onBlur={onInactive}
      className={`group block rounded-[15px] border bg-white px-4 py-3.5 transition-[border-color,box-shadow] sm:px-5 sm:py-4 lg:px-4 lg:py-3.5 ${
        active
          ? "border-[#2a2a86] shadow-[0_3px_12px_rgba(26,26,26,0.08)]"
          : "border-[#e5dcd2] hover:border-[#bdb1a5] hover:shadow-[0_3px_12px_rgba(26,26,26,0.06)]"
      }`}
    >
      <span className="flex items-center justify-between gap-3 text-[12px] leading-[18px]">
        <span className="min-w-0 truncate font-medium text-[#5d56b4]">
          {event.eventType ?? labels.eventOne}
        </span>
        {ongoing && (
          <span className="shrink-0 rounded-full bg-[#f9e7ee] px-2 py-0.5 font-semibold text-[#a92351]">
            {labels.todayPill}
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-[17px] font-semibold leading-[23px] tracking-[-0.01em] text-[#1a1a1a] group-hover:text-[#2a2a86]">
        {event.title}
      </span>
      <span className={`mt-2 flex items-start gap-2 text-[13px] leading-[19px] ${MUTED}`}>
        <CalendarIcon />
        {formatDateRange(event.startsOn, event.endsOn, locale)}
      </span>
      {place && (
        <span className={`mt-1 flex items-start gap-2 text-[13px] leading-[19px] ${MUTED}`}>
          <PlaceIcon online={event.setting === "online"} />
          <span className="min-w-0">{place}</span>
        </span>
      )}
      {origin && isMappable(event) && (
        <span className="mt-2 inline-block rounded-full bg-[#eeecfb] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#2a2a86]">
          {formatDistance(distanceMeters(origin, event.lat!, event.lon!), locale)}
        </span>
      )}
    </a>
  );
}

function ResultCount({
  count,
  hidden,
  labels,
}: {
  count: number;
  hidden: number;
  labels: MapLabels;
}) {
  return (
    <p className={`shrink-0 text-[13px] ${MUTED}`} aria-live="polite">
      <strong className="font-semibold text-[#1a1a1a] tabular-nums">{count}</strong>{" "}
      {count === 1 ? labels.eventOne : labels.eventMany}
      {hidden > 0 ? ` · ${hidden} ${labels.unmapped}` : ""}
    </p>
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
      onClick={onClick}
      aria-pressed={active}
      className={`map-filter-option min-h-9 rounded-[9px] border px-3 text-center text-[13px] font-semibold transition-colors ${
        active
          ? "border-[#a3162c] bg-white text-[#a3162c] shadow-[0_1px_2px_rgba(250,50,80,0.08)]"
          : "border-transparent text-[#6e686e] hover:text-[#2a2a86]"
      }`}
    >
      {children}
    </button>
  );
}

function eventMarker(L: typeof import("leaflet"), ongoing: boolean, raised: boolean) {
  const size = raised ? 40 : 32;
  const color = ongoing ? ACCENT_TODAY : ACCENT;
  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 32 40" style="filter:drop-shadow(0 2px 3px rgba(26,26,26,.28))">
      <path d="M16 1.5C8.4 1.5 2.5 7.4 2.5 15c0 9.6 13.5 23.5 13.5 23.5S29.5 24.6 29.5 15C29.5 7.4 23.6 1.5 16 1.5Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="16" cy="15" r="4.25" fill="#fff"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 5],
  });
}

function SearchIcon() {
  return (
    <svg className="ml-3 shrink-0 text-[#6e6a72] lg:ml-4 lg:h-[18px] lg:w-[18px]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 15.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="lg:h-4 lg:w-4" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="lg:h-[18px] lg:w-[18px]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`absolute right-4 mt-2 transition-transform ${collapsed ? "rotate-180" : ""}`}
    >
      <path d="m7 9 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Crosshair() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v4M16 3.5v4M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlaceIcon({ online }: { online: boolean }) {
  return online ? (
    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 9h15M4.5 15h15M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8c-2-2.2-3-4.9-3-8s1-5.8 3-8Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s6-5.8 6-11a6 6 0 1 0-12 0c0 5.2 6 11 6 11Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
