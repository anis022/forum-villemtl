// Client-safe types and helpers for the council-meetings feature.
// No server-only imports here (mirrors the utils/issues.ts split).

/** Which part of a sitting a result came from — the filter the page offers. */
export const SECTIONS = ["questions", "resolutions"] as const;
export type Section = (typeof SECTIONS)[number];

export function isSection(v: string): v is Section {
  return (SECTIONS as readonly string[]).includes(v);
}

/** The borough runs two question periods, and residents ask about both. */
export const MODES = ["orale", "ecrite"] as const;
export type QuestionMode = (typeof MODES)[number];

/**
 * One resident's intervention, as the proces-verbal recorded it.
 *
 * `subject` is the clerk's wording and `transcript` is what was actually said,
 * aligned from the recording. Both are verbatim; neither is paraphrased.
 */
export type QuestionHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string; // ISO (YYYY-MM-DD)
  youtubeId: string;
  /** The borough's published minutes — the source this row was read from. */
  pvUrl: string | null;
  personId: string | null;
  name: string;
  subject: string;
  mode: QuestionMode;
  speakingOrder: number;
  startS: number | null;
  endS: number | null;
  transcript: string | null;
  /**
   * True when the row literally contains the words searched for. Only these
   * are counted — see `CouncilAnswer`.
   */
  lexical: boolean;
  similarity: number | null;
};

/** One decision of the council, as numbered in the minutes. */
export type ResolutionHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  youtubeId: string;
  pvUrl: string | null;
  odjUrl: string | null;
  number: string;
  title: string;
  body: string | null;
  outcome: string | null;
  agendaCode: string | null;
  movedBy: string | null;
  secondedBy: string | null;
  debate: boolean;
  startS: number | null;
  lexical: boolean;
  similarity: number | null;
};

/** One passage of transcript, for when the words themselves are the answer. */
export type SearchHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  youtubeId: string;
  startS: number;
  endS: number;
  text: string;
  section: Section | null;
  speaker: string | null;
  lexicalRank: number | null;
  semanticRank: number | null;
};

/**
 * What the page states out loud.
 *
 * The split between `counted` and `related` is the honest part of this feature.
 * `counted` holds rows that contain the words asked about, so "three residents"
 * means three residents a reader can check by reading the quotes. `related`
 * holds rows an embedding placed nearby that contain none of those words: worth
 * reading, never worth counting.
 *
 * An earlier attempt tried to count by similarity instead. It could not be made
 * to work — the notes in migration 0007 and 0018 record why, and the short
 * version is that nearest-neighbour ranking always returns neighbours, so an
 * off-topic query produced a confident number for a thing nobody discussed.
 */
export type CouncilAnswer = {
  query: string;
  /** After bilingual widening — shown so a reader knows what was searched. */
  expanded: string;
  counted: QuestionHit[];
  related: QuestionHit[];
  /** Distinct humans among `counted`. This is the number in the headline. */
  people: number;
  /** Distinct sittings among `counted`. */
  meetings: number;
};

/** Deep-link straight to the moment in the recording. */
export function youtubeDeepLink(youtubeId: string, startS: number): string {
  return `https://www.youtube.com/watch?v=${youtubeId}&t=${Math.floor(startS)}s`;
}

/** seconds -> "1 h 23" for display. */
export function formatTimestamp(startS: number): string {
  const s = Math.floor(startS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/**
 * Distinct people in a set of interventions.
 *
 * Falls back to the printed name when a row has no person id, folded the same
 * way the ingest folds `name_key`, so "Joël" and "Joel" stay one person rather
 * than becoming two and inflating every count on the page.
 */
export function distinctPeople(hits: QuestionHit[]): number {
  const keys = new Set(
    hits.map(
      (h) =>
        h.personId ??
        h.name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase(),
    ),
  );
  return keys.size;
}

export function distinctMeetings(hits: { youtubeId: string }[]): number {
  return new Set(hits.map((h) => h.youtubeId)).size;
}
