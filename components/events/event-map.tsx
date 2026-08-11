"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
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
import { BTN_SECONDARY, CARD, FIELD, INK, MUTED } from "@/components/ui/styles";
import {
  MAP_OPTIONS,
  TILE_OPTIONS,
  TILE_URL,
  addBoroughOutline,
  frameBorough,
} from "@/utils/map";

export type MapLabels = {
  allTypes: string;
  type: string;
  mapLabel: string;
  searchPlaceholder: string;
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
  // A plain string, not a formatter: labels cross the server/client boundary
  // and a function cannot. The count is composed here instead.
  showMore: string;
  nearbyHint: string;
  nearbyLabel: string;
  nearbyClear: string;
  nearbyNoneTitle: string;
  nearbyNoneBody: string;
};

/**
 * How many events the list shows before asking. Enough that the list reads as a
 * list rather than a teaser, few enough that a phone is not handed three
 * hundred rows to scroll past on the way to the rest of the page.
 */
const PAGE = 8;

/**
 * Events on a map, and the same events as a list beside it.
 *
 * A bare map is a wall of identical pins: you cannot read it, you can only
 * poke at it. Pairing it with a scrollable list means the page answers "what
 * is on this week" without a single click, and hovering a card lights its pin,
 * so the two halves explain each other.
 *
 * The filters answer the questions people actually arrive with, in the order
 * they ask them: *when* first as chips, because a listing is read forwards from
 * today; then a search box, because someone looking for one thing knows its
 * name; then type and indoor/outdoor as selects, which are refinements rather
 * than entry points.
 *
 * Filtering by district is deliberately gone. Nobody looking for something to
 * do on Saturday thinks in electoral boundaries — they think about when they
 * are free and how far they will walk — and the map already shows where
 * everything is far better than five chips could.
 *
 * "How far they will walk" is the other half of that, and it is why the map
 * takes a click: pick a corner — home, the métro, the school — and the page
 * narrows to what is within walking distance of it. A radius drawn from a point
 * someone chose is the filter that district chips were only ever approximating,
 * and it needs no vocabulary to use.
 */
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
  const [active, setActive] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radius, setRadius] = useState<Radius>(DEFAULT_RADIUS);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const areaRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, { setIcon: (i: unknown) => void }>());

  const types = useMemo(
    () => [...new Set(events.map((e) => e.eventType).filter(Boolean))].sort() as string[],
    [events],
  );

  /**
   * Today, read once per filter pass rather than at module scope. This
   * component renders on the server too, and a date captured at import time
   * would be whichever day the server happened to start on.
   */
  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const until = windowEnd(when, today);

    return events.filter((e) => {
      if (type && e.eventType !== type) return false;
      if (setting && e.setting !== setting) return false;
      // A window asks "is any of this event inside it", not "does it start
      // inside it": a series running all summer is on this week too.
      if (until && e.startsOn > until) return false;
      // A point on the map excludes everything without one, online events
      // included. "Near here" is a question they have no answer to.
      if (origin && !isNearby(e, origin, radius)) return false;
      return matches(e, query);
    });
  }, [events, query, when, setting, type, origin, radius]);

  const mappable = useMemo(() => filtered.filter(isMappable), [filtered]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Leaflet reads `window` at import time, so it is pulled in here rather than
  // at module scope.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, MAP_OPTIONS);
      // Stored before anything else async can run. React invokes effects twice
      // in development; a map the cleanup cannot find leaks its container, and
      // the second run then fails on an already-initialised element.
      mapRef.current = map;

      // The view has to come first: Leaflet refuses to accept a layer before it
      // knows where it is looking. It opens on the whole borough — all five
      // districts at once — and is fenced there, because this map is not about
      // the rest of the island and panning away only ever loses people.
      frameBorough(L, map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      // Not awaited: the outline is decoration, and blocking on it would hold
      // up the pins behind a network round trip.
      void addBoroughOutline(L, map);

      // Anywhere on the map is a place you might be standing. Clicking a second
      // time moves the point rather than clearing it — the common case is
      // "not quite there, a bit more east", not "never mind".
      map.on("click", (ev: { latlng: { lat: number; lng: number } }) => {
        setOrigin({ lat: ev.latlng.lat, lon: ev.latlng.lng });
        setLimit(PAGE);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      areaRef.current = null;
    };
  }, []);

  /**
   * The circle, drawn as its own layer so redrawing the pins cannot wipe it.
   *
   * Nothing in it is interactive: a Leaflet circle swallows clicks by default,
   * and the one place you most want to click again is just inside the circle
   * you have already drawn.
   */
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
        // The point itself, in ink rather than the accent: it is the one mark on
        // the map that is not an event, and it should not read as another pin.
        L.circleMarker([origin.lat, origin.lon], {
          radius: 5,
          color: "#fff",
          weight: 2,
          fillColor: INK,
          fillOpacity: 1,
          interactive: false,
        }),
      ]).addTo(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, radius]);

  // Redraw pins whenever the filters change.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      const layer = layerRef.current;
      if (cancelled || !layer) return;
      layer.clearLayers();
      markersRef.current.clear();

      // Leaflet's popup defaults to 300px wide, which on a 320px phone is wider
      // than the map frame itself: autoPan has nowhere to move it to, so it
      // opens half outside the rounded frame and gets clipped. Sizing it to the
      // frame keeps the popup inside the map at every width, and the desktop
      // popup is unchanged because 300px is still the cap.
      const frame = containerRef.current?.clientWidth ?? 0;
      const popupMaxWidth = frame > 0 ? Math.min(300, frame - 32) : 300;

      for (const e of mappable) {
        const marker = L.marker([e.lat!, e.lon!], {
          title: e.title,
          icon: pin(L, ACCENT, false),
        });

        const place = [e.venueName, e.address].filter(Boolean).join(" · ");
        marker.bindPopup(
          `<strong style="font-size:14px">${escapeHtml(e.title)}</strong>` +
            `<br><span style="color:#6e6a72">${escapeHtml(formatDateRange(e.startsOn, e.endsOn, locale))}</span>` +
            (place ? `<br><span style="color:#6e6a72">${escapeHtml(place)}</span>` : "") +
            `<br><a href="${escapeHtml(e.sourceUrl)}" target="_blank" rel="noreferrer" style="color:#fa3250;font-weight:700">${escapeHtml(labels.details)}</a>`,
          { maxWidth: popupMaxWidth },
        );
        marker.on("mouseover", () => setActive(e.id));
        marker.on("mouseout", () => setActive(null));
        marker.addTo(layer);
        markersRef.current.set(e.id, marker as unknown as { setIcon: (i: unknown) => void });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mappable, locale, labels.details]);

  // Lift the pin that matches the hovered card, so the pairing is legible.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      for (const e of mappable) {
        const marker = markersRef.current.get(e.id);
        if (!marker) continue;
        marker.setIcon(pin(L, ACCENT, active === e.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, mappable]);

  const hidden = filtered.length - mappable.length;
  const hasFilter = Boolean(query || when !== "all" || setting || type || origin);

  // Changing a filter re-answers the question, so the list starts over. Done in
  // the handlers rather than an effect: an effect would run after a render that
  // had already painted the old list at its old length.
  const reset = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE);
  };
  const chooseWhen = reset(setWhen);
  const chooseType = reset(setType);
  const chooseSetting = reset(setSetting);
  const chooseQuery = reset(setQuery);
  const chooseRadius = reset(setRadius);

  const clearAll = () => {
    setQuery("");
    setWhen("all");
    setSetting("");
    setType("");
    setOrigin(null);
    setLimit(PAGE);
  };

  const clearOrigin = () => {
    setOrigin(null);
    setLimit(PAGE);
  };

  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;

  return (
    <div>
      {/* Searching comes first because it is the only control that answers
          "where is the thing I already know about". Full width: an event title
          is a sentence, not a keyword. */}
      <label className="block">
        <span className="sr-only">{labels.searchPlaceholder}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => chooseQuery(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className={`${FIELD} rounded-full`}
        />
      </label>

      {/* Then when. A listing is read forwards from today, so this is the cut
          most people want and it gets chips rather than a select — four
          options behind a click is three options hidden. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(Object.keys(labels.when) as When[]).map((key) => (
          <FilterChip key={key} active={when === key} onClick={() => chooseWhen(key)}>
            {labels.when[key]}
          </FilterChip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* A <select> is as wide as its longest option, and the activity names
            are long enough to push past a 320px screen. Clamped and allowed to
            shrink so it fills the space left over instead of setting it, and
            given the whole row on a phone: sharing a line with the count would
            leave it too narrow to read a single activity name in. */}
        <label className="flex w-full min-w-0 items-center gap-2 text-[14px] sm:w-auto">
          <span className={`shrink-0 font-bold ${MUTED}`}>{labels.type}</span>
          <select
            value={type}
            onChange={(e) => chooseType(e.target.value)}
            className="min-h-[40px] min-w-0 max-w-full flex-1 rounded-[10px] border border-[#e9e0d6] bg-white px-3.5 py-2 text-[14px] font-bold text-[#1a1a1a] transition-colors hover:border-[#fa3250] sm:flex-none"
          >
            <option value="">{labels.allTypes}</option>
            {types.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
        </label>

        {/* Indoors or out is the other thing that decides whether an event is
            worth crossing the borough for in February. */}
        <label className="flex w-full min-w-0 items-center gap-2 text-[14px] sm:w-auto">
          <span className="sr-only">{labels.allSettings}</span>
          <select
            value={setting}
            onChange={(e) => chooseSetting(e.target.value as Setting | "")}
            className="min-h-[40px] min-w-0 max-w-full flex-1 rounded-[10px] border border-[#e9e0d6] bg-white px-3.5 py-2 text-[14px] font-bold text-[#1a1a1a] transition-colors hover:border-[#fa3250] sm:flex-none"
          >
            <option value="">{labels.allSettings}</option>
            {(Object.keys(labels.settings) as Setting[]).map((key) => (
              <option key={key} value={key}>
                {labels.settings[key]}
              </option>
            ))}
          </select>
        </label>

        <p className={`text-[14px] ${MUTED}`}>
          {/* The count and its noun are held together; broken across lines the
              number reads as belonging to the sentence above it. Only this
              pair is kept unbreakable — "sans lieu sur la carte" is long
              enough that refusing to wrap it would set the width of the row. */}
          <span className="whitespace-nowrap">
            <span className="font-bold text-[#1a1a1a] tabular-nums">{filtered.length}</span>{" "}
            {filtered.length === 1 ? labels.eventOne : labels.eventMany}
          </span>
          {hidden > 0 ? ` · ${hidden} ${labels.unmapped}` : ""}
        </p>

        {hasFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex min-h-[40px] items-center text-[14px] font-bold text-[#fa3250] underline hover:text-[#d81f3c]"
          >
            {labels.showAll}
          </button>
        )}
      </div>

      {/* The point, and how far around it to look.

          Before one is placed this row is only an invitation — the map gives no
          sign that it can be clicked, and a feature nobody discovers is not a
          feature. Once placed it becomes the control: three walking distances,
          and a way out. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {origin ? (
          <>
            <span className={`text-[14px] font-bold ${MUTED}`}>{labels.nearbyLabel}</span>
            {RADII.map((r) => (
              <FilterChip key={r} active={radius === r} onClick={() => chooseRadius(r)}>
                {formatDistance(r, locale)}
              </FilterChip>
            ))}
            <button
              type="button"
              onClick={clearOrigin}
              className="inline-flex min-h-[40px] items-center text-[14px] font-bold text-[#fa3250] underline hover:text-[#d81f3c]"
            >
              {labels.nearbyClear}
            </button>
          </>
        ) : (
          <p className={`flex items-center gap-2 text-[14px] ${MUTED}`}>
            <Crosshair />
            {labels.nearbyHint}
          </p>
        )}
      </div>

      {/* The map is never taken away, even when nothing matches.

          It used to be: an empty result replaced the whole pane with a card.
          That is survivable for a search box, and impossible once the map is
          itself a filter — clicking a quiet corner would remove the very thing
          you needed in order to click somewhere else. So the message moved into
          the list column, where the map stays beside it to be clicked again. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Shorter on a phone. At full height the map fills the screen on its
            own, and nothing suggests there is a readable list under it. */}
        <div
          ref={containerRef}
          role="application"
          aria-label={labels.mapLabel}
          className="h-[320px] w-full cursor-crosshair overflow-hidden rounded-[16px] border border-[#e9e0d6] sm:h-[400px] md:h-[620px]"
        />

        {filtered.length === 0 ? (
          // 40px of padding on each side of a 320px screen leaves the message a
          // column barely wider than one word.
          <div className={`${CARD} p-6 text-center sm:p-10`}>
            <p className="text-[18px] font-bold leading-[26px]">
              {origin ? labels.nearbyNoneTitle : labels.noneTitle}
            </p>
            <p className={`mt-2 ${MUTED}`}>
              {origin ? labels.nearbyNoneBody : labels.noneBody}
            </p>
          </div>
        ) : (
          /* The same events, readable without touching the map.

             The list only becomes its own scroller once it sits beside the map
             and has to match its height. Stacked on a phone that inner scroller
             is a trap: a thumb dragged over the list scrolls the list instead
             of the page, and the rest of the page becomes unreachable. */
          <div className="min-w-0">
            <div className="relative">
              <ul className="space-y-2 lg:max-h-[620px] lg:overflow-y-auto lg:pr-1">
                {visible.map((e) => (
                  <li key={e.id}>
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onMouseEnter={() => setActive(e.id)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(e.id)}
                      onBlur={() => setActive(null)}
                      className={`flex gap-3 rounded-[14px] border p-3 transition-colors ${
                        active === e.id
                          ? "border-[#fa3250] bg-[#faf1e8]"
                          : "border-[#e9e0d6] bg-white hover:border-[#fa3250]"
                      }`}
                    >
                      {/* The bar used to carry the district's colour, which
                          only meant anything while the district chips were
                          there to read it against. It now marks the one
                          distinction a listing actually turns on: happening
                          today, or still to come. */}
                      <span
                        aria-hidden="true"
                        className="mt-1 h-9 w-1.5 shrink-0 rounded-full"
                        style={{ background: isOngoing(e, today) ? ACCENT_TODAY : ACCENT }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-[21px]">
                          {e.title}
                        </span>
                        <span className={`mt-0.5 block text-[13px] leading-[19px] ${MUTED}`}>
                          {formatDateRange(e.startsOn, e.endsOn, locale)}
                          {e.venueName ? ` · ${e.venueName}` : ""}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {/* How far, once there is a point to measure from.
                              A radius that only thins the list leaves you
                              trusting it; the distance on each row is the
                              circle saying what it did. Its own pill rather
                              than a third clause on the meta line, which at
                              320px would wrap the venue onto a line of its
                              own. */}
                          {origin && isMappable(e) && (
                            <span className="inline-block rounded-full bg-[#fde8eb] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#d81f3c]">
                              {formatDistance(distanceMeters(origin, e.lat!, e.lon!), locale)}
                            </span>
                          )}
                          {isOngoing(e, today) && (
                            <span className="inline-block rounded-full bg-[#fdeaf2] px-2 py-0.5 text-[11px] font-bold text-[#b3122c]">
                              {labels.todayPill}
                            </span>
                          )}
                          {e.setting === "online" && (
                            <span className="inline-block rounded-full bg-[#e4f2eb] px-2 py-0.5 text-[11px] font-bold text-[#0b6042]">
                              {labels.online}
                            </span>
                          )}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>

              {/* The list does not simply stop — the last rows soften into the
                page, which says "there is more of this" before the button has
                to. Two layers: a ramp of blur, and a fade to the page colour
                over it. Hit-testing passes straight through, so the last card
                stays clickable under its own fade. */}
              {remaining > 0 && (
                <>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 backdrop-blur-[3px] [mask-image:linear-gradient(to_top,#000_30%,transparent)]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fef7f0] via-[#fef7f0]/85 to-transparent"
                  />
                </>
              )}
            </div>

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className={`${BTN_SECONDARY} mt-3 w-full`}
              >
                {labels.showMore}
              <span className="tabular-nums">({remaining})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The mark beside the invitation to click. It is the cursor the map now shows,
 * drawn small next to the sentence that explains it — so the hint and the thing
 * under the pointer are recognisably the same gesture.
 */
function Crosshair() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </svg>
  );
}

/** A teardrop pin, so events read as places rather than as dots on paper. */
function pin(L: typeof import("leaflet"), color: string, raised: boolean) {
  const size = raised ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(26,26,26,.35))">
      <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.2 7.2 12.4 7.2 12.4s7.2-7.2 7.2-12.4c0-4-3.2-7.2-7.2-7.2z"
            fill="${color}" stroke="#fff" stroke-width="1.6"/>
      <circle cx="12" cy="9.4" r="2.6" fill="#fff"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // `max-w-full` so a wrapping flex row cannot let a chip hang off the edge on
  // a 320px screen; clamped, it wraps inside the chip instead. `min-h-[40px]`
  // keeps it a thumb-sized target — the type alone leaves it 36px.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[40px] max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] font-bold leading-[20px] transition-colors ${
        active
          ? "border-[#fa3250] bg-[#fa3250] text-white"
          : "border-[#e9e0d6] bg-white text-[#6e6a72] hover:border-[#fa3250] hover:text-[#1a1a1a]"
      }`}
    >
      {children}
    </button>
  );
}

/** Popup content is built as an HTML string, so titles must be escaped. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
