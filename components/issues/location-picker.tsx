"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import {
  addBasemap,
  BOROUGH_BOUNDS,
  MAP_OPTIONS,
  addBoroughOutline,
  frameBorough,
} from "@/utils/map";

export type PickerLabels = {
  hint: string;
  chosen: string;
  locate: string;
  locating: string;
  outside: string;
  denied: string;
  clear: string;
};

/**
 * Pick where the problem is, by clicking the map.
 *
 * The coordinates ride along in hidden inputs so the form still posts as a
 * plain form — no client-side submit handler, no state to keep in sync with
 * the server action.
 *
 * The map is fenced to the borough and a click outside it is rejected with a
 * message rather than silently ignored: a pin dropped on another borough would
 * be a report nobody here can act on.
 */
export function LocationPicker({
  labels,
  defaultLat,
  defaultLon,
  disabled,
}: {
  labels: PickerLabels;
  defaultLat?: number | null;
  defaultLon?: number | null;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(
    defaultLat != null && defaultLon != null ? { lat: defaultLat, lon: defaultLon } : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const inside = (lat: number, lon: number) =>
    lat >= BOROUGH_BOUNDS[0][0] &&
    lat <= BOROUGH_BOUNDS[1][0] &&
    lon >= BOROUGH_BOUNDS[0][1] &&
    lon <= BOROUGH_BOUNDS[1][1];

  // Leaflet reads `window` at import time, so it is loaded inside the effect.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, MAP_OPTIONS);
      // Stored before anything else async can run — see the note in issue-map.
      mapRef.current = map;

      frameBorough(L, map, 0.25);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      await addBasemap(L, map);
      // Shows the picker's own rule: inside the outline is where a pin is
      // accepted, so the fence is visible before anyone hits it.
      void addBoroughOutline(L, map);

      const drop = (lat: number, lon: number) => {
        if (!inside(lat, lon)) {
          setNotice(labels.outside);
          return;
        }
        setNotice(null);
        setPoint({ lat, lon });
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lon]);
        } else {
          markerRef.current = L.marker([lat, lon], { icon: pinIcon(L) }).addTo(map);
        }
      };

      map.on("click", (event: { latlng: { lat: number; lng: number } }) =>
        drop(event.latlng.lat, event.latlng.lng),
      );

      if (point) {
        markerRef.current = L.marker([point.lat, point.lon], { icon: pinIcon(L) }).addTo(map);
        map.setView([point.lat, point.lon], 15);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Built once: re-running would tear down a pin the user already placed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Offer the browser's own position, since most reports are filed on site. */
  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!inside(latitude, longitude)) {
          setNotice(labels.outside);
          return;
        }
        const L = await import("leaflet");
        setPoint({ lat: latitude, lon: longitude });
        if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
        else if (mapRef.current)
          markerRef.current = L.marker([latitude, longitude], { icon: pinIcon(L) }).addTo(
            mapRef.current,
          );
        mapRef.current?.setView([latitude, longitude], 16);
      },
      () => {
        setLocating(false);
        setNotice(labels.denied);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const clear = () => {
    setPoint(null);
    setNotice(null);
    markerRef.current?.remove();
    markerRef.current = null;
  };

  return (
    <div>
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lon" value={point?.lon ?? ""} />

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[280px] w-full overflow-hidden rounded-[12px] border border-[#e9e0d6] md:h-[340px]"
        />

        {/* Kept inside the map like its zoom control: the action belongs to
            choosing a point, and no longer pushes the map's status line down. */}
        <button
          type="button"
          onClick={useMyPosition}
          disabled={disabled || locating}
          className="absolute left-3 top-3 z-[1000] inline-flex min-h-[42px] items-center gap-2 rounded-[10px] border border-[#e9e0d6] bg-white/95 px-3.5 py-2 text-[13px] font-bold text-[#a3162c] shadow-[0_2px_10px_rgba(26,26,26,0.18)] backdrop-blur-sm transition-colors hover:border-[#a3162c] hover:bg-[#f6e7ea] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          {locating ? labels.locating : labels.locate}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {point ? (
          <>
            <span className="text-[13px] font-bold text-[#a3162c]">{labels.chosen}</span>
            <button
              type="button"
              onClick={clear}
              className="text-[13px] font-bold text-[#6e6a72] underline hover:text-[#8a1024]"
            >
              {labels.clear}
            </button>
          </>
        ) : labels.hint ? (
          <span className="text-[13px] text-[#6e6a72]">{labels.hint}</span>
        ) : null}
      </div>

      {notice && (
        <p role="alert" className="mt-2 text-[13px] font-bold text-[#a3162c]">
          {notice}
        </p>
      )}
    </div>
  );
}

/** A teardrop, matching the events map so pins read the same everywhere. */
function pinIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: `<svg width="32" height="32" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(26,26,26,.35))">
      <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.2 7.2 12.4 7.2 12.4s7.2-7.2 7.2-12.4c0-4-3.2-7.2-7.2-7.2z"
            fill="#d6337a" stroke="#fff" stroke-width="1.6"/>
      <circle cx="12" cy="9.4" r="2.6" fill="#fff"/>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}
