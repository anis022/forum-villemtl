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

/**
 * One colour for every pin.
 *
 * They used to be coloured per district, which worked only while a row of
 * district chips sat above the map acting as the legend. Without it five hues
 * on a map are a rainbow nobody can read — colour that encodes something the
 * page never explains is worse than no colour at all. What the map has to say
 * now is "an event is here", and one accent says it.
 */
export const ACCENT = "#a3162c";

/** The warm accent, for something happening today rather than later. */
export const ACCENT_TODAY = "#d6337a";

/** The time windows the filter offers. */
export const WHENS = ["all", "today", "week", "month"] as const;
export type When = (typeof WHENS)[number];

/**
 * The radii offered once someone picks a point on the map, in metres.
 *
 * Walking distances, not driving ones: the question behind "what is near here"
 * in a borough five kilometres across is whether you would go on foot. 1 km is
 * the default because it is roughly a twelve-minute walk — near enough to be
 * worth it, wide enough that a click never comes back empty by a hundred
 * metres. 500 m is one's own street corner, 2 km most of a district.
 */
export const RADII = [500, 1000, 2000] as const;
export type Radius = (typeof RADII)[number];
export const DEFAULT_RADIUS: Radius = 1000;

/** A point picked on the map, to measure everything else against. */
export type Origin = { lat: number; lon: number };

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Metres between two positions, by the haversine formula.
 *
 * A sphere is wrong by about half a percent, which over the two kilometres this
 * is ever asked about is a few metres — far below the precision of a fingertip
 * on a phone-sized map. Anything more elaborate would be arithmetic nobody can
 * see the result of.
 */
export function distanceMeters(a: Origin, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - a.lat) * rad;
  const dLon = (bLon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** True when the event has a position and it falls inside the circle. */
export function isNearby(e: BoroughEvent, origin: Origin, radius: number): boolean {
  if (!isMappable(e)) return false;
  return distanceMeters(origin, e.lat!, e.lon!) <= radius;
}

/**
 * A distance as a person would say it. Rounded to ten metres below a kilometre:
 * the origin is wherever a fingertip landed, so "437 m" claims a precision the
 * number does not have.
 */
export function formatDistance(metres: number, locale: string): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    metres / 1000,
  );
  return `${km} km`;
}

/** ISO day, `days` from `from`. Dates are compared as strings throughout. */
const addDays = (from: string, days: number): string => {
  const d = new Date(from + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The last day a window covers, or null when it covers everything. "This week"
 * is the next seven days rather than the calendar week: on a Sunday the
 * calendar answer is "today", which is not what anyone means by it.
 */
export function windowEnd(when: When, today: string): string | null {
  if (when === "today") return today;
  if (when === "week") return addDays(today, 7);
  if (when === "month") return addDays(today, 30);
  return null;
}

/**
 * Accent- and case-insensitive. A resident typing "cote des neiges" or
 * "Côte-des-Neiges" is asking the same question, and a search that only honours
 * one of them is a search that fails on the borough's own name.
 */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Free-text match over the fields a person would search by. */
export function matches(e: BoroughEvent, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const haystack = fold(
    [e.title, e.venueName, e.address, e.eventType, e.audience].filter(Boolean).join(" "),
  );
  // Every word must appear, in any order: "parc jazz" should find a jazz
  // evening in a park without the person guessing the title's word order.
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

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
