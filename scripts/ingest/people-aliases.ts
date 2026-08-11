/**
 * Spellings the clerk uses for one and the same resident.
 *
 * The minutes are typed by hand, sitting after sitting, and the same person
 * comes out slightly differently each time. Left alone, the database counts
 * "Stephen Jass" and "Steven Jass" as two residents, and the page reports that
 * six people raised the Terrebonne bike path when five did. Over-counting is
 * exactly the failure this feature exists to avoid.
 *
 * Why a reviewed list instead of fuzzy matching:
 *
 * The variants that need merging are not reachable by any single distance
 * rule. "Liz" and "Elizabeth" are six edits apart; "Alex" and "Alexander" five.
 * A rule loose enough to catch those also merges "Laura Renteria Diaz" with
 * "Steven Leyba-Diaz" — two different residents who share a surname. Merging
 * two real people is a worse error than splitting one, because it is invisible:
 * a split shows up as an inflated count someone may notice, while a bad merge
 * silently attributes one neighbour's words to another.
 *
 * So every group below was confirmed against the record rather than against the
 * spelling — same subject, usually the same sitting. The evidence is quoted in
 * the comment beside each. Adding a group is cheap; `npm run ingest:record`
 * prints any surname collision that is not listed here, so new variants surface
 * on the next ingest instead of quietly inflating a count.
 *
 * The first spelling in each group is canonical: it is what `council_people`
 * stores and what the page shows when it names the person. Each individual
 * question still displays the spelling the minutes actually printed.
 */

export const ALIASES: string[][] = [
  // Written and oral question, same day, same petition about the Sherbrooke
  // Ouest parking meters (13 April 2026).
  ["Alexander Aronson", "Alex Aronson"],

  // Both raised bike lanes, 2 February and 9 March 2026. French/English
  // spelling of the same given name.
  ["Georges Christianis", "George Christianis"],

  // Five interventions, February to June 2026, every one of them the Terrebonne
  // bike path.
  ["Stephen Jass", "Steven Jass"],

  // Same day, same petition on the Sherbrooke Ouest parking meters — one filed
  // in writing, one asked aloud (13 April 2026).
  ["Elizabeth Ostroff", "Liz Ostroff"],

  // A regular through 2026 — Empress theatre, bilingual city, diversity. The
  // 4 May spelling is the odd one out.
  ["Michael Shafter", "Michel Shafter"],
];

/**
 * Look-alikes that are genuinely different people.
 *
 * Without this the collision report would raise the same pair on every ingest.
 * A warning that always fires is one nobody reads, and the whole point of the
 * report is that it stays quiet until something new appears — so a pair checked
 * once is recorded as checked.
 */
export const CONFIRMED_DISTINCT: string[][] = [
  // Share only the tail of a compound surname, and nothing else:
  //   Laura Renteria Diaz — soccer club in Côte-des-Neiges, 4 May 2026
  //   Steven Leyba-Diaz   — bike path and waste collection, 2 February 2026
  ["Laura Renteria Diaz", "Steven Leyba-Diaz"],
];

/**
 * Comparison key: accents, case and punctuation folded away.
 *
 * Must stay in step with `nameKey` in record.ts — both fold the same way, so a
 * group member written with an accent still matches.
 */
function fold(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The surname to group by when hunting for look-alikes.
 *
 * A hyphen is a typing decision, not a fact about the name: "Leyba-Diaz" and
 * "Leyba Diaz" are the same surname, and comparing them as written would file
 * them apart and miss the collision entirely.
 */
function surnameOf(name: string): string | null {
  const tokens = fold(name).replace(/-/g, " ").split(" ").filter(Boolean);
  return tokens.length < 2 ? null : tokens[tokens.length - 1];
}

/** Pairs already checked by a human, keyed the same way as the report. */
const CHECKED = new Set(
  CONFIRMED_DISTINCT.map((group) => group.map(fold).sort().join(" ~ ")),
);

/** folded variant -> canonical spelling. */
const CANONICAL = new Map<string, string>();
for (const group of ALIASES) {
  for (const variant of group) CANONICAL.set(fold(variant), group[0]);
}

/** The one spelling this person is counted under. */
export function canonicalName(name: string): string {
  return CANONICAL.get(fold(name)) ?? name.trim();
}

/**
 * Surname collisions that are not in the list above.
 *
 * Every one is either a new spelling variant to add, or two genuine neighbours
 * who share a surname. Both are worth a human glance, and neither should be
 * decided by this file on its own.
 */
export function unlistedCollisions(names: string[]): string[][] {
  const bySurname = new Map<string, Set<string>>();

  for (const raw of names) {
    const canonical = canonicalName(raw);
    const surname = surnameOf(canonical);
    if (!surname) continue;
    const set = bySurname.get(surname) ?? new Set<string>();
    set.add(canonical);
    bySurname.set(surname, set);
  }

  return [...bySurname.values()]
    .filter((s) => s.size > 1)
    .map((s) => [...s].sort())
    .filter((group) => !CHECKED.has(group.map(fold).sort().join(" ~ ")));
}
