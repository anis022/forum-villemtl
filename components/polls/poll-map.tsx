"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import type { PollMapResponse } from "@/utils/polls";
import { dateLocale, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";
import {
  addBasemap,
  MAP_OPTIONS,
  addBoroughOutline,
  frameBorough,
  BOROUGH_BOUNDS,
} from "@/utils/map";

export function PollMap({
  responses,
  lang,
  labels,
  height = "h-[360px] md:h-[480px]",
  showDetails = true,
  propose,
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
  /**
   * Makes the map itself the way in to leaving a point.
   *
   * Absent for a reader who may not answer, or who has used their allowance:
   * clicking would then propose something that is going to be refused.
   */
  propose?: {
    /** The question on the pin. */
    ask: string;
    /** The button that says yes. */
    confirm: string;
    cancel: string;
    onConfirm: (lat: number, lon: number) => void;
  };
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
      await addBasemap(L, map);
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

      if (!propose) return;

      /*
       * Click the place, then say yes.
       *
       * A click alone would post a point every time somebody dragged the map a
       * pixel too slowly, and a point is a public contribution under a real
       * name. So the click only *proposes*: a pin appears where the finger
       * landed, in the accent rather than in the colour real answers use, and
       * asks. Saying no takes it away and nothing was written.
       *
       * The confirmation is a popup on the pin rather than a bar under the map
       * because it is about that spot, and a reader who has just clicked is
       * looking at that spot.
       */
      let pending: import("leaflet").Marker | null = null;
      const clear = () => {
        if (pending) map.removeLayer(pending);
        pending = null;
      };

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = event.latlng;
        if (!L.latLngBounds(BOROUGH_BOUNDS).contains([lat, lng])) return;

        clear();
        pending = L.marker([lat, lng], { icon: proposedPinIcon(L), zIndexOffset: 500 }).addTo(map);

        const box = document.createElement("div");
        box.className = "poll-map-propose";
        const ask = document.createElement("p");
        ask.textContent = propose.ask;
        ask.style.cssText = "margin:0 0 8px;font-weight:700";
        box.appendChild(ask);

        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px";
        const yes = document.createElement("button");
        yes.type = "button";
        yes.textContent = propose.confirm;
        yes.style.cssText =
          "border:0;border-radius:9px;background:#a3162c;color:#fff;font-weight:700;padding:8px 12px;cursor:pointer";
        yes.onclick = () => {
          map.closePopup();
          propose.onConfirm(lat, lng);
        };
        const no = document.createElement("button");
        no.type = "button";
        no.textContent = propose.cancel;
        no.style.cssText =
          "border:1px solid #e9e0d6;border-radius:9px;background:#fff;color:#6e6a72;font-weight:700;padding:8px 12px;cursor:pointer";
        no.onclick = () => {
          map.closePopup();
          clear();
        };
        row.append(yes, no);
        box.appendChild(row);

        pending.bindPopup(box, { closeButton: false }).openPopup();
        // Dismissing the popup any other way must not leave a pin standing
        // where nothing was submitted.
        pending.on("popupclose", clear);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [labels, responses, propose]);

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

/**
 * The pin that is only being offered.
 *
 * Hollow and in the forum's accent, where a real answer is solid indigo: a
 * reader glancing at the map has to be able to tell what has been contributed
 * from what they are in the middle of contributing.
 */
function proposedPinIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: `<svg width="38" height="38" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 3px rgba(26,26,26,.4))">
      <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.2 7.2 12.4 7.2 12.4s7.2-7.2 7.2-12.4c0-4-3.2-7.2-7.2-7.2z"
            fill="#fff" stroke="#a3162c" stroke-width="2"/>
      <circle cx="12" cy="9.4" r="2.6" fill="#a3162c"/>
    </svg>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
}
