import { cookies } from "next/headers";
import { createClient } from "./server";
import type { CouncilResult, InterventionType, Topic } from "@/utils/council";

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
