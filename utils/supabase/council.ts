import { cookies } from "next/headers";
import { createClient } from "./server";
import { embedQuery, toVectorLiteral } from "@/utils/embedding";
import type { CouncilResult, InterventionType, SearchHit, Topic } from "@/utils/council";

async function sb() {
  return createClient(await cookies());
}

export async function listTopics(): Promise<Topic[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("council_topics")
    .select("id, slug, label_fr, label_en")
    .order("label_fr");
  return (data ?? []).map((t) => ({
    id: t.id as string,
    slug: t.slug as string,
    labelFr: t.label_fr as string,
    labelEn: t.label_en as string,
  }));
}

type SearchRow = {
  id: string;
  youtube_id: string;
  meeting_title: string;
  meeting_date: string;
  start_s: number;
  end_s: number;
  text: string;
  lexical_rank: number | null;
  semantic_rank: number | null;
  similarity: number | null;
  margin: number | null;
};

/**
 * Hybrid search over the transcript.
 *
 * The query is embedded in-process with the same model used at ingestion. If
 * that fails — the model cannot load, or the corpus has no vectors yet — the
 * RPC accepts a null embedding and degrades to lexical-only rather than
 * returning nothing. A partly-working search beats an error page.
 */
export async function searchCouncil(
  query: string,
  matchCount = 12,
): Promise<{ hits: SearchHit[]; semantic: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { hits: [], semantic: false };

  let embedding: string | null = null;
  try {
    embedding = toVectorLiteral(await embedQuery(trimmed));
  } catch (err) {
    console.error("[council] embedding indisponible, repli lexical:", err);
  }

  const supabase = await sb();
  const { data, error } = await supabase.rpc("search_council", {
    query_text: trimmed,
    query_embedding: embedding,
    match_count: matchCount,
  });

  if (error) {
    console.error("[council] search_council:", error.message);
    return { hits: [], semantic: false };
  }

  const hits = (data as SearchRow[]).map((r) => ({
    id: r.id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    youtubeId: r.youtube_id,
    startS: Number(r.start_s),
    endS: Number(r.end_s),
    text: r.text,
    lexicalRank: r.lexical_rank,
    semanticRank: r.semantic_rank,
    similarity: r.similarity === null ? null : Number(r.similarity),
    margin: r.margin === null ? null : Number(r.margin),
  }));

  return { hits, semantic: embedding !== null };
}

/** How much of the archive the answer is actually drawn from. */
export async function corpusStats(): Promise<{ meetings: number; segments: number }> {
  const supabase = await sb();
  const [m, s] = await Promise.all([
    supabase.from("council_meetings").select("id", { count: "exact", head: true }),
    supabase.from("council_segments").select("id", { count: "exact", head: true }),
  ]);
  return { meetings: m.count ?? 0, segments: s.count ?? 0 };
}

export type CouncilFilters = {
  topicId?: string;
  type?: InterventionType;
  from?: string | null; // ISO date, inclusive
};

type Row = {
  id: string;
  meeting_title: string;
  meeting_date: string;
  youtube_id: string;
  start_s: number;
  speaker_role: CouncilResult["speakerRole"];
  type: InterventionType | null;
  sentiment: CouncilResult["sentiment"];
  summary: string | null;
  topic_ids: string[];
};

/**
 * The analytics query. Runs the SQL RPC (topic / type / date filters on the
 * joined meeting) — a real aggregate over tagged interventions, no LLM.
 */
export async function queryInterventions(f: CouncilFilters): Promise<CouncilResult[]> {
  const supabase = await sb();
  const { data, error } = await supabase.rpc("council_interventions_filtered", {
    p_topic: f.topicId ?? null,
    p_type: f.type ?? null,
    p_from: f.from ?? null,
    p_to: null,
  });
  if (error || !data) return [];

  return (data as Row[]).map((r) => ({
    id: r.id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    youtubeId: r.youtube_id,
    startS: Number(r.start_s),
    speakerRole: r.speaker_role,
    type: r.type,
    sentiment: r.sentiment,
    summary: r.summary,
    topicIds: r.topic_ids ?? [],
  }));
}

/** Count distinct meetings represented in a result set (for the headline). */
export function distinctMeetings(results: CouncilResult[]): number {
  return new Set(results.map((r) => r.youtubeId)).size;
}
