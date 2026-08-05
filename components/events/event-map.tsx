"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import {
  DISTRICTS,
  DISTRICT_COLORS,
  formatDateRange,
  isMappable,
  type BoroughEvent,
  type District,
} from "@/utils/events";
import { BTN_SECONDARY, CARD, MUTED } from "@/components/ui/styles";
import {
  MAP_OPTIONS,
  TILE_OPTIONS,
  TILE_URL,
  addBoroughOutline,
  frameBorough,
} from "@/utils/map";

export type MapLabels = {
  allDistricts: string;
  allTypes: string;
  district: string;
  type: string;
  eventOne: string;
  eventMany: string;
  noneTitle: string;
  noneBody: string;
  details: string;
  online: string;
  unmapped: string;
  free: string;
  showAll: string;
  // A plain string, not a formatter: labels cross the server/client boundary
  // and a function cannot. The count is composed here instead.
  showMore: string;
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
 * Filters are chips rather than dropdowns. There are five districts and they
 * are the primary way anyone slices this — a select box hides all five behind
 * a click and gives no sense of how many there are.
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
  const [district, setDistrict] = useState<District | "">("");
  const [type, setType] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, { setIcon: (i: unknown) => void }>());

  const types = useMemo(
    () => [...new Set(events.map((e) => e.eventType).filter(Boolean))].sort() as string[],
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter(
        (e) => (!district || e.district === district) && (!type || e.eventType === type),
      ),
    [events, district, type],
  );
  const mappable = useMemo(() => filtered.filter(isMappable), [filtered]);

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
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

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
        const color = e.district ? DISTRICT_COLORS[e.district] : "#5d6b66";
        const marker = L.marker([e.lat!, e.lon!], {
          title: e.title,
          icon: pin(L, color, false),
        });

        const place = [e.venueName, e.address].filter(Boolean).join(" · ");
        marker.bindPopup(
          `<strong style="font-size:14px">${escapeHtml(e.title)}</strong>` +
            `<br><span style="color:#5d6b66">${escapeHtml(formatDateRange(e.startsOn, e.endsOn, locale))}</span>` +
            (place ? `<br><span style="color:#5d6b66">${escapeHtml(place)}</span>` : "") +
            `<br><a href="${escapeHtml(e.sourceUrl)}" target="_blank" rel="noreferrer" style="color:#097d6c;font-weight:700">${escapeHtml(labels.details)}</a>`,
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
        const color = e.district ? DISTRICT_COLORS[e.district] : "#5d6b66";
        marker.setIcon(pin(L, color, active === e.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, mappable]);

  const hidden = filtered.length - mappable.length;
  const hasFilter = Boolean(district || type);

  // Changing a filter re-answers the question, so the list starts over. Done in
  // the handlers rather than an effect: an effect would run after a render that
  // had already painted the old list at its old length.
  const chooseDistrict = (value: District | "") => {
    setDistrict(value);
    setLimit(PAGE);
  };
  const chooseType = (value: string) => {
    setType(value);
    setLimit(PAGE);
  };

  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={!district} onClick={() => chooseDistrict("")}>
          {labels.allDistricts}
        </FilterChip>
        {DISTRICTS.map((d) => (
          <FilterChip
            key={d}
            active={district === d}
            onClick={() => chooseDistrict(d)}
            dot={DISTRICT_COLORS[d]}
          >
            {d}
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
            className="min-h-[40px] min-w-0 max-w-full flex-1 rounded-full border border-[#dde5e1] bg-white px-3.5 py-2 text-[14px] font-bold text-[#16241f] transition-colors hover:border-[#097d6c] sm:flex-none"
          >
            <option value="">{labels.allTypes}</option>
            {types.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
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
            <span className="font-bold text-[#16241f] tabular-nums">{filtered.length}</span>{" "}
            {filtered.length === 1 ? labels.eventOne : labels.eventMany}
          </span>
          {hidden > 0 ? ` · ${hidden} ${labels.unmapped}` : ""}
        </p>

        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              chooseDistrict("");
              chooseType("");
            }}
            className="inline-flex min-h-[40px] items-center text-[14px] font-bold text-[#097d6c] underline hover:text-[#075f53]"
          >
            {labels.showAll}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        // 40px of padding on each side of a 320px screen leaves the message a
        // column barely wider than one word.
        <div className={`${CARD} mt-5 p-6 text-center sm:p-10`}>
          <p className="text-[18px] font-bold leading-[26px]">{labels.noneTitle}</p>
          <p className={`mt-2 ${MUTED}`}>{labels.noneBody}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Shorter on a phone. At full height the map fills the screen on its
              own, and nothing suggests there is a readable list under it. */}
          <div
            ref={containerRef}
            role="application"
            aria-label={labels.district}
            className="h-[320px] w-full overflow-hidden rounded-[16px] border border-[#dde5e1] sm:h-[400px] md:h-[620px]"
          />

          {/* The same events, readable without touching the map.

              The list only becomes its own scroller once it sits beside the map
              and has to match its height. Stacked on a phone that inner scroller
              is a trap: a thumb dragged over the list scrolls the list instead
              of the page, and the rest of the page becomes unreachable. */}
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
                          ? "border-[#097d6c] bg-[#f2f6f4]"
                          : "border-[#dde5e1] bg-white hover:border-[#097d6c]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 h-9 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: e.district ? DISTRICT_COLORS[e.district] : "#93a19c",
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-[21px]">
                          {e.title}
                        </span>
                        <span className={`mt-0.5 block text-[13px] leading-[19px] ${MUTED}`}>
                          {formatDateRange(e.startsOn, e.endsOn, locale)}
                          {e.venueName ? ` · ${e.venueName}` : ""}
                        </span>
                        {e.setting === "online" && (
                          <span className="mt-1 inline-block rounded-full bg-[#e8eef9] px-2 py-0.5 text-[11px] font-bold text-[#1c4fa1]">
                            {labels.online}
                          </span>
                        )}
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
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f8faf9] via-[#f8faf9]/85 to-transparent"
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
        </div>
      )}
    </div>
  );
}

/** A teardrop pin, so events read as places rather than as dots on paper. */
function pin(L: typeof import("leaflet"), color: string, raised: boolean) {
  const size = raised ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(22,36,31,.35))">
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
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  // `max-w-full` matters on the longest district names: a wrapping flex row will
  // happily let a chip wider than the row hang off the edge, and
  // "Notre-Dame-de-Grâce" is close to the width of a 320px screen once the dot
  // and the padding are counted. Clamped, it wraps inside the chip instead.
  // `min-h-[40px]` keeps it a thumb-sized target; the type alone leaves it 36px.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[40px] max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] font-bold leading-[20px] transition-colors ${
        active
          ? "border-[#097d6c] bg-[#097d6c] text-white"
          : "border-[#dde5e1] bg-white text-[#5d6b66] hover:border-[#097d6c] hover:text-[#16241f]"
      }`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
          style={{ background: active ? "#ffffff" : dot }}
        />
      )}
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
