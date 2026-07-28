// Client-safe types and helpers for the council-meetings feature.
// No server-only imports here (mirrors the utils/issues.ts split).

export type Topic = {
  id: string;
  slug: string;
  labelFr: string;
  labelEn: string;
};

export const INTERVENTION_TYPES = [
  "complaint",
  "question",
  "support",
  "info",
  "response",
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export type SpeakerRole = "resident" | "councillor" | "mayor" | "staff" | "unknown";
export type Sentiment = "neg" | "neutral" | "pos";

/**
 * One transcript window returned by search. `text` is verbatim — nothing is
 * paraphrased between the recording and the page, so a reader can always check
 * the wording against the video at `startS`.
 */
export type SearchHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string; // ISO (YYYY-MM-DD)
  youtubeId: string;
  startS: number;
  endS: number;
  text: string;
  /** Which half of the hybrid search found it — useful for tuning, and shown. */
  lexicalRank: number | null;
  semanticRank: number | null;
  /** Raw cosine similarity. Not comparable across queries — see `margin`. */
  similarity: number | null;
  /** Standard deviations above the corpus mean for this query. */
  margin: number | null;
};

/*
 * There is deliberately no relevance gate here.
 *
 * An attempt was made using `margin` — how far the best hit stands above the
 * corpus mean for that query. On 381 segments it looked separable; on 3400 it
 * collapsed: relevant queries scored a median 3.71, irrelevant ones 3.68, with
 * "recette de tarte aux pommes" (3.68) beating "déneigement" (3.47). With
 * enough windows of rambling transcript, some window is always an outlier, so
 * the margin measures oddity rather than relevance.
 *
 * A cross-encoder does separate the two (relevant -1.76..4.02 against
 * irrelevant -5.20..0.44) at roughly 850 ms per search. Its residual errors
 * are caption-corruption artifacts — "déneigement" fails to match the
 * transcript's "déénagement" — so transcript quality, not ranking, is the
 * binding constraint.
 */

export type CouncilResult = {
  id: string;
  meetingTitle: string;
  meetingDate: string; // ISO (YYYY-MM-DD)
  youtubeId: string;
  startS: number;
  speakerRole: SpeakerRole;
  type: InterventionType | null;
  sentiment: Sentiment | null;
  summary: string | null;
  topicIds: string[];
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

/** Preset ranges keep the UI to a single dropdown instead of date pickers. */
export const RANGE_MONTHS = [3, 6, 12, 0] as const; // 0 = all
export type RangeMonths = (typeof RANGE_MONTHS)[number];

/** ISO date N months before today, or null for "all". */
export function rangeFrom(months: number): string | null {
  if (!months) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
