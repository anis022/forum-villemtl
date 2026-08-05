"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import {
  STATUS_MAP_COLORS,
  isLocated,
  isSettled,
  type Issue,
  type Status,
} from "@/utils/issues";
import { CARD, MUTED } from "@/components/ui/styles";
import {
  MAP_OPTIONS,
  TILE_OPTIONS,
  TILE_URL,
  addBoroughOutline,
  frameBorough,
} from "@/utils/map";

export type IssueMapLabels = {
  statuses: Record<Status, string>;
  showAll: string;
  onlyOpen: string;
  onlySettled: string;
  located: string;
  unlocated: string;
  empty: string;
  open: string;
};

type Filter = "all" | "open" | "settled";

/**
 * The forum as a map.
 *
 * A list answers "what is being discussed"; a map answers "what is broken near
 * me", which is the question a resident actually arrives with. Warm pins are
 * unresolved, teal ones are done, so the state of a street reads before any
 * label is looked at.
 *
 * Reports filed before locations were asked for have no pin. They are counted
 * out loud rather than quietly dropped, so the map never looks like the whole
 * picture when it is not.
 */
export function IssueMap({
  issues,
  lang,
  labels,
}: {
  issues: Issue[];
  lang: string;
  labels: IssueMapLabels;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  const located = useMemo(() => issues.filter(isLocated), [issues]);
  const unlocated = issues.length - located.length;

  const shown = useMemo(
    () =>
      located.filter((i) =>
        filter === "all" ? true : filter === "settled" ? isSettled(i.status) : !isSettled(i.status),
      ),
    [located, filter],
  );

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

      // The view has to come first: Leaflet refuses to accept a layer before
      // it knows where it is looking.
      frameBorough(L, map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      void addBoroughOutline(L, map);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      const layer = layerRef.current;
      if (cancelled || !layer) return;
      layer.clearLayers();

      for (const issue of shown) {
        const color = STATUS_MAP_COLORS[issue.status];
        const marker = L.marker([issue.lat!, issue.lon!], {
          title: issue.title,
          icon: pin(L, color, isSettled(issue.status), active === issue.id),
        });
        marker.bindPopup(
          `<strong style="font-size:14px">${escapeHtml(issue.title)}</strong>` +
            `<br><span style="color:#5d6b66">${escapeHtml(labels.statuses[issue.status])} · ${issue.voteCount}</span>` +
            `<br><a href="/${lang}/sujets/${issue.id}" style="color:#097d6c;font-weight:700">${escapeHtml(labels.open)}</a>`,
          // Leaflet's default popup is 300px wide, which is wider than the map
          // frame itself on a small phone — autoPan then has nowhere to put it
          // and it opens clipped. Measured off the frame instead.
          { maxWidth: Math.min(300, (containerRef.current?.clientWidth ?? 300) - 32) },
        );
        marker.on("mouseover", () => setActive(issue.id));
        marker.on("mouseout", () => setActive(null));
        marker.addTo(layer);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shown, active, lang, labels]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {labels.showAll}
        </Chip>
        <Chip active={filter === "open"} onClick={() => setFilter("open")} dot="#d94f45">
          {labels.onlyOpen}
        </Chip>
        <Chip active={filter === "settled"} onClick={() => setFilter("settled")} dot="#097d6c">
          {labels.onlySettled}
        </Chip>

        {/* The count and the thing being counted stay together: a line that
            breaks after the number reads as if it belonged to the sentence
            above. The trailing clause is left breakable on purpose — pinning it
            too would set the width of the whole row. */}
        <p className={`text-[14px] ${MUTED}`}>
          <span className="whitespace-nowrap">
            <span className="font-bold text-[#16241f] tabular-nums">{shown.length}</span>{" "}
            {labels.located}
          </span>
          {unlocated > 0 ? ` · ${unlocated} ${labels.unlocated}` : ""}
        </p>
      </div>

      {located.length === 0 ? (
        <div className={`${CARD} mt-4 p-6 text-center sm:p-10`}>
          <p className={MUTED}>{labels.empty}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            ref={containerRef}
            role="application"
            className="h-[320px] w-full overflow-hidden rounded-[16px] border border-[#dde5e1] sm:h-[420px] md:h-[600px]"
          />

          {/* The list is a scroller only when it sits beside the map and has to
              match its height. Stacked underneath on a phone, a nested scroller
              swallows the drag: you try to scroll the page, the list moves
              instead, and the page appears stuck. */}
          <ul className="space-y-2 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
            {shown.map((issue) => (
              <li key={issue.id}>
                <Link
                  href={`/${lang}/sujets/${issue.id}`}
                  onMouseEnter={() => setActive(issue.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(issue.id)}
                  onBlur={() => setActive(null)}
                  className={`flex gap-3 rounded-[14px] border p-3 transition-colors ${
                    active === issue.id
                      ? "border-[#097d6c] bg-[#f2f6f4]"
                      : "border-[#dde5e1] bg-white hover:border-[#097d6c]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 h-9 w-1.5 shrink-0 rounded-full"
                    style={{ background: STATUS_MAP_COLORS[issue.status] }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-[21px]">{issue.title}</span>
                    <span className={`mt-0.5 block text-[13px] leading-[19px] ${MUTED}`}>
                      {labels.statuses[issue.status]} · {issue.voteCount}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Settled reports get a check inside the pin. Colour alone would leave the
 * split invisible to anyone who cannot separate red from teal.
 */
function pin(L: typeof import("leaflet"), color: string, settled: boolean, raised: boolean) {
  const size = raised ? 36 : 30;
  const glyph = settled
    ? `<path d="M9.6 9.3l1.9 1.9 3.2-3.4" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<circle cx="12" cy="9.4" r="2.6" fill="#fff"/>`;

  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(22,36,31,.35))">
      <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.2 7.2 12.4 7.2 12.4s7.2-7.2 7.2-12.4c0-4-3.2-7.2-7.2-7.2z"
            fill="${color}" stroke="#fff" stroke-width="1.6"/>
      ${glyph}
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
}

function Chip({
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
      className={`inline-flex min-h-[40px] max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] font-bold leading-[20px] transition-colors ${
        active
          ? "border-[#097d6c] bg-[#097d6c] text-white"
          : "border-[#dde5e1] bg-white text-[#5d6b66] hover:border-[#097d6c] hover:text-[#16241f]"
      }`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
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
