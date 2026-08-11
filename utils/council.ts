// Client-safe types and helpers for the council-meetings feature.
// No server-only imports here (mirrors the utils/issues.ts split).

/** Which part of a sitting a result came from — the filter the page offers. */
export const SECTIONS = ["questions", "resolutions", "elus"] as const;
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
  /** The full spoken turn, kept for anyone who wants it. */
  transcript: string | null;
  /** The window around the match — what the card shows. */
  excerpt: string | null;
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

/**
 * One thing an elected member raised, from the council's own two periods.
 *
 * A row per item rather than per councillor: a member brings six things to a
 * sitting, and a search for one of them should not return the other five.
 */
export type RemarkHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  youtubeId: string;
  pvUrl: string | null;
  personId: string | null;
  name: string;
  topic: string;
  kind: "commentaire" | "question";
  startS: number | null;
  lexical: boolean;
  similarity: number | null;
};

/**
 * One sitting, summarised.
 *
 * Every field is a count of rows the borough published — nothing here is
 * generated prose, so the summary cannot claim anything the minutes do not.
 * `topSubjects` is the sitting's own account of itself: subjects the clerk
 * recorded for more than one resident, which is how eleven people turning up
 * about the Sherbrooke parking meters becomes visible without anyone writing
 * an editorial about it.
 */
export type MeetingSummary = {
  youtubeId: string;
  meetingDate: string;
  title: string;
  kind: string | null;
  president: string | null;
  presidentActing: boolean;
  pvUrl: string | null;
  odjUrl: string | null;
  durationS: number | null;
  oral: number;
  written: number;
  people: number;
  aligned: number;
  resolutions: number;
  unanimous: number;
  /** Decisions that were not unanimous — where the council split. */
  divided: number;
  debates: number;
  remarks: number;
  topSubjects: string[];
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

/**
 * The part of a long intervention that shows why it matched.
 *
 * A resident holds the floor for up to ten minutes, which comes back as five
 * thousand characters of transcript on average and eight thousand at worst.
 * Printing that whole block on a search result is unreadable — sixteen of them
 * is ninety thousand characters — and it buries the sentence the reader
 * actually searched for somewhere in the middle.
 *
 * So the card shows a window around the first match instead, and the video link
 * carries whoever wants the rest. Cut on word boundaries: a snippet that starts
 * mid-word reads as corruption rather than as an excerpt.
 */
const EXCERPT_CHARS = 300;

export function excerptAround(text: string, terms: string[]): string {
  if (text.length <= EXCERPT_CHARS) return text;

  const fold = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hay = fold(text);

  let at = -1;
  for (const term of terms) {
    const i = hay.indexOf(fold(term));
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }

  // No term found — this is a "related" row, so the opening is as good a
  // window as any.
  if (at < 0) at = 0;

  let start = Math.max(0, at - Math.floor(EXCERPT_CHARS / 3));
  let end = Math.min(text.length, start + EXCERPT_CHARS);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space > 0 && space < start + 30) start = space + 1;
  }
  const space = text.lastIndexOf(" ", end);
  if (space > start + EXCERPT_CHARS / 2) end = space;

  return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
}

/**
 * The words a reader actually typed, recovered from the expanded query.
 *
 * `expandQuery` wraps alternatives in parentheses and joins them with a bare
 * `or` for websearch_to_tsquery; none of that is a word to look for in a
 * transcript.
 */
export function searchTerms(expanded: string): string[] {
  return expanded
    .replace(/[()"]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.toLowerCase() !== "or" && w.length > 2);
}

/**
 * A sitting's date, written the way each language writes it.
 *
 * `Intl` gives "1 juin 2026". French wants "1er juin 2026" — the first of the
 * month is the one ordinal the language insists on, and the borough's own
 * minutes use it. English takes the cardinal unchanged.
 */
export function formatMeetingDate(iso: string, lang: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  const text = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  if (lang !== "fr" || d.getDate() !== 1) return text;
  return text.replace(/^1\b/, "1er");
}

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
