// Client-safe types and helpers for the borough events map.
// No server-only imports (mirrors the utils/issues.ts and utils/council.ts split).

/** The five electoral districts of Côte-des-Neiges–Notre-Dame-de-Grâce. */
export const DISTRICTS = [
  "Côte-des-Neiges",
  "Darlington",
  "Snowdon",
  "Notre-Dame-de-Grâce",
  "Loyola",
] as const;
export type District = (typeof DISTRICTS)[number];

/** Stable slugs for URLs — the names carry accents and spaces. */
export const DISTRICT_SLUGS: Record<District, string> = {
  "Côte-des-Neiges": "cote-des-neiges",
  Darlington: "darlington",
  Snowdon: "snowdon",
  "Notre-Dame-de-Grâce": "notre-dame-de-grace",
  Loyola: "loyola",
};

export function districtFromSlug(slug: string | undefined): District | undefined {
  return DISTRICTS.find((d) => DISTRICT_SLUGS[d] === slug);
}

export type Setting = "outdoor" | "indoor" | "online";

export type BoroughEvent = {
  id: string;
  sourceUrl: string;
  title: string;
  startsOn: string; // ISO date
  endsOn: string | null;
  eventType: string | null;
  audience: string | null;
  setting: Setting | null;
  cost: string | null;
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  district: District | null;
};

/** Only events with a position belong on the map; online ones never do. */
export function isMappable(e: BoroughEvent): boolean {
  return e.lat !== null && e.lon !== null && e.setting !== "online";
}

// The borough geometry lives in utils/map.ts, shared with the reports map.

/** A colour per district, so the pins read as a set rather than a rainbow. */
export const DISTRICT_COLORS: Record<District, string> = {
  "Côte-des-Neiges": "#097d6c",
  Darlington: "#1c4fa1",
  Snowdon: "#a4231f",
  "Notre-Dame-de-Grâce": "#6b3fa0",
  Loyola: "#b8660a",
};

/** "du 6 au 21 juillet" style ranges collapse to a single date when equal. */
export function formatDateRange(
  startsOn: string,
  endsOn: string | null,
  locale: string,
): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(
      new Date(iso + "T00:00:00"),
    );
  if (!endsOn || endsOn === startsOn) return fmt(startsOn);
  return `${fmt(startsOn)} – ${fmt(endsOn)}`;
}

/** True while the event is running today, as opposed to starting later. */
export function isOngoing(e: BoroughEvent, today: string): boolean {
  return e.startsOn <= today && (e.endsOn ?? e.startsOn) >= today;
}
