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
};

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

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  const types = useMemo(
    () => [...new Set(events.map((e) => e.eventType).filter(Boolean))].sort() as string[],
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (!district || e.district === district) && (!type || e.eventType === type),
      ),
    [events, district, type],
  );

  const mappable = useMemo(() => filtered.filter(isMappable), [filtered]);

  // Create the map once. Leaflet reads `window` at import time, so it is
  // pulled in here rather than at module scope.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      map.fitBounds(BOROUGH_BOUNDS);
      // Keep the reader inside the borough — this map is not about the rest of
      // the island, and panning away from it only ever loses people.
      map.setMaxBounds(L.latLngBounds(BOROUGH_BOUNDS).pad(0.35));
      map.setMinZoom(12);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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

      for (const e of mappable) {
        const color = e.district ? DISTRICT_COLORS[e.district] : "#637381";
        const marker = L.marker([e.lat!, e.lon!], {
          title: e.title,
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        });

        const place = [e.venueName, e.address].filter(Boolean).join(" — ");
        marker.bindPopup(
          `<strong>${escapeHtml(e.title)}</strong><br>` +
            `${escapeHtml(formatDateRange(e.startsOn, e.endsOn, locale))}` +
            (place ? `<br>${escapeHtml(place)}` : "") +
            `<br><a href="${escapeHtml(e.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(labels.details)}</a>`,
        );
        marker.addTo(layer);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mappable, locale, labels.details]);

  const hidden = filtered.length - mappable.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-bold">{labels.district}</span>
          <select
            value={district}
            onChange={(ev) => setDistrict(ev.target.value as District | "")}
            className={SELECT}
          >
            <option value="">{labels.allDistricts}</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-bold">{labels.type}</span>
          <select value={type} onChange={(ev) => setType(ev.target.value)} className={SELECT}>
            <option value="">{labels.allTypes}</option>
            {types.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
        </label>

        <p className="pb-[9px] text-[15px] text-[#637381]">
          {filtered.length} {filtered.length === 1 ? labels.eventOne : labels.eventMany}
          {hidden > 0 ? ` · ${hidden} ${labels.unmapped}` : ""}
        </p>
      </div>

      <div
        ref={containerRef}
        role="application"
        aria-label={labels.district}
        className="h-[420px] w-full rounded-[4px] border-[0.8px] border-[#ced4da] md:h-[560px]"
      />

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
        {DISTRICTS.map((d) => (
          <li key={d} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: DISTRICT_COLORS[d] }}
            />
            {d}
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="mt-6 rounded-[4px] border-[0.8px] border-[#ced4da] p-10 text-center">
          <p className="text-[20px] font-bold leading-[28px]">{labels.noneTitle}</p>
          <p className="mt-2 text-[#637381]">{labels.noneBody}</p>
        </div>
      )}
    </div>
  );
}

const SELECT =
  "rounded-[4px] border-[0.8px] border-[#637381] bg-white px-3 py-[9px] text-[15px] leading-[20px] text-[#212529] focus:border-[#097d6c]";

/** Popup content is built as an HTML string, so titles must be escaped. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
