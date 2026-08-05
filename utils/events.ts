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
export const ACCENT = "#097d6c";

/** The warm accent, for something happening today rather than later. */
export const ACCENT_TODAY = "#d94f45";

/** The time windows the filter offers. */
export const WHENS = ["all", "today", "week", "month"] as const;
export type When = (typeof WHENS)[number];

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
