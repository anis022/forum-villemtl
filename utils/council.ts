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
