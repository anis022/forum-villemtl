"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import type { PollMapResponse } from "@/utils/polls";
import { dateLocale, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";
import {
  MAP_OPTIONS,
  TILE_OPTIONS,
  TILE_URL,
  addBoroughOutline,
  frameBorough,
} from "@/utils/map";

export function PollMap({
  responses,
  lang,
  labels,
  height = "h-[360px] md:h-[480px]",
  showDetails = true,
}: {
  responses: PollMapResponse[];
  lang: Locale;
  /** Tailwind height classes. The feed asks for a shorter map than the topic. */
  height?: string;
  /**
   * The cards under the map, one per pin.
   *
   * Off in the feed. A topic card is a summary somebody scrolls past, and
   * unrolling every contribution with its photograph and its date underneath
   * turns one entry in a list into a page.
   */
  showDetails?: boolean;
  labels: {
    mapLabel: string;
    contribution: string;
    noDetails: string;
  };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, MAP_OPTIONS);
      mapRef.current = map;
      frameBorough(L, map, 0.25);
      map.scrollWheelZoom.enable();
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      void addBoroughOutline(L, map);

      responses.forEach((response, index) => {
        const marker = L.marker([response.lat, response.lon], {
          icon: mapPinIcon(L),
          title: `${labels.contribution} ${index + 1}`,
        }).addTo(map);

        const popup = document.createElement("div");
        popup.className = "poll-map-popup";
        const heading = document.createElement("strong");
        heading.textContent = `${labels.contribution} ${index + 1}`;
        popup.appendChild(heading);

        if (response.imageUrl) {
          const image = document.createElement("img");
          image.src = response.imageUrl;
          image.alt = "";
          image.loading = "lazy";
          image.style.cssText = "display:block;width:100%;max-height:180px;object-fit:contain;margin-top:8px;border-radius:8px";
          popup.appendChild(image);
        }

        const text = document.createElement("p");
        text.textContent = response.description || labels.noDetails;
        text.style.cssText = "margin:8px 0 0;color:#6e6a72;white-space:pre-wrap";
        popup.appendChild(text);
        marker.bindPopup(popup, { maxWidth: 300 });
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [labels, responses]);

  return (
    <div>
      <div
        ref={containerRef}
        role="region"
        aria-label={labels.mapLabel}
        className={`${height} w-full overflow-hidden rounded-[14px] border border-[#e9e0d6]`}
      />

      {/* No "nothing here yet" line: the caller prints a count of the pins, and
          "no points have been added" directly above "0 citizen points" says the
          same thing twice in two registers. */}
      {showDetails && responses.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {responses.map((response, index) => (
            <article key={response.id} className="overflow-hidden rounded-[12px] border border-[#e9e0d6] bg-white">
              {response.imageUrl && (
                <div className="relative aspect-[16/9] bg-[#faf1e8]">
                  <Image
                    src={response.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 340px, 100vw"
                    className="object-contain"
                  />
                </div>
              )}
              <div className="p-3.5">
                <p className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#2a2a86]">
                  {labels.contribution} {index + 1}
                </p>
                <p className={`mt-1 whitespace-pre-wrap text-[14px] leading-[21px] ${MUTED}`}>
                  {response.description || labels.noDetails}
                </p>
                <p className={`mt-2 text-[12px] ${MUTED}`}>
                  {new Intl.DateTimeFormat(dateLocale(lang), { dateStyle: "medium" }).format(
                    new Date(response.createdAt),
                  )}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function mapPinIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: `<svg width="34" height="34" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(26,26,26,.35))">
      <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.2 7.2 12.4 7.2 12.4s7.2-7.2 7.2-12.4c0-4-3.2-7.2-7.2-7.2z"
            fill="#2a2a86" stroke="#fff" stroke-width="1.6"/>
      <circle cx="12" cy="9.4" r="2.6" fill="#fff"/>
    </svg>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}
