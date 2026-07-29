"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import {
  BOROUGH_BOUNDS,
  DISTRICTS,
  DISTRICT_COLORS,
  formatDateRange,
  isMappable,
  type BoroughEvent,
  type District,
} from "@/utils/events";
import { CARD, MUTED } from "@/components/ui/styles";

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
};

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

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: false,
      });
      map.fitBounds(BOROUGH_BOUNDS, { padding: [16, 16] });
      // Keep the reader inside the borough — this map is not about the rest of
      // the island, and panning away from it only ever loses people.
      map.setMaxBounds(L.latLngBounds(BOROUGH_BOUNDS).pad(0.3));
      map.setMinZoom(12);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // The lighter Carto basemap: the default OSM tiles are saturated enough
      // that coloured pins disappear into the street colours.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={!district} onClick={() => setDistrict("")}>
          {labels.allDistricts}
        </FilterChip>
        {DISTRICTS.map((d) => (
          <FilterChip key={d} active={district === d} onClick={() => setDistrict(d)} dot={DISTRICT_COLORS[d]}>
            {d}
          </FilterChip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-[14px]">
          <span className={`font-bold ${MUTED}`}>{labels.type}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-full border border-[#dde5e1] bg-white px-3.5 py-2 text-[14px] font-bold text-[#16241f] transition-colors hover:border-[#097d6c]"
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
          <span className="font-bold text-[#16241f] tabular-nums">{filtered.length}</span>{" "}
          {filtered.length === 1 ? labels.eventOne : labels.eventMany}
          {hidden > 0 ? ` · ${hidden} ${labels.unmapped}` : ""}
        </p>

        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setDistrict("");
              setType("");
            }}
            className="text-[14px] font-bold text-[#097d6c] underline hover:text-[#075f53]"
          >
            {labels.showAll}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={`${CARD} mt-5 p-10 text-center`}>
          <p className="text-[18px] font-bold leading-[26px]">{labels.noneTitle}</p>
          <p className={`mt-2 ${MUTED}`}>{labels.noneBody}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div
            ref={containerRef}
            role="application"
            aria-label={labels.district}
            className="h-[380px] w-full overflow-hidden rounded-[16px] border border-[#dde5e1] md:h-[620px]"
          />

          {/* The same events, readable without touching the map. */}
          <ul className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((e) => (
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
                    style={{ background: e.district ? DISTRICT_COLORS[e.district] : "#93a19c" }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-[21px]">{e.title}</span>
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] font-bold leading-[20px] transition-colors ${
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
