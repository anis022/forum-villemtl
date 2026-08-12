import { cookies } from "next/headers";
import { createClient } from "./server";
import { expandQuery } from "@/utils/council-terms";
import {
  distinctMeetings,
  distinctPeople,
  excerptAround,
  searchTerms,
  type CouncilAnswer,
  type MeetingSummary,
  type QuestionHit,
  type RemarkHit,
  type ResolutionHit,
  type SearchHit,
  type Section,
} from "@/utils/council";

async function sb() {
  return createClient(await cookies());
}

/**
 * Embed the query with the same model used at ingestion.
 *
 * Imported here rather than at module scope on purpose. The embedder pulls in
 * onnxruntime-node, whose native library is absent on some platforms — notably
 * the deployed Linux function when the lockfile was resolved on another OS. A
 * static import would make that a module-load failure and take the whole page
 * down with a 500; loading it inside the try means the failure degrades to
 * lexical-only search, which is what the null embedding is for.
 *
 * Losing it costs the "related" list. It never costs a count: counting is
 * lexical by design, so the number on the page is the same either way.
 */
async function embed(query: string): Promise<string | null> {
  try {
    const { embedQuery, toVectorLiteral } = await import("@/utils/embedding");
    return toVectorLiteral(await embedQuery(query));
  } catch (err) {
    console.error("[council] embedding indisponible, repli lexical:", err);
    return null;
  }
}

type QuestionRow = {
  id: string;
  youtube_id: string;
  meeting_title: string;
  meeting_date: string;
  pv_url: string | null;
  person_id: string | null;
  name: string;
  subject: string;
  mode: "orale" | "ecrite";
  speaking_order: number;
  start_s: number | null;
  end_s: number | null;
  transcript: string | null;
  lexical: boolean;
  similarity: number | null;
};

function toQuestion(r: QuestionRow, terms: string[]): QuestionHit {
  return {
    id: r.id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    youtubeId: r.youtube_id,
    pvUrl: r.pv_url,
    personId: r.person_id,
    name: r.name,
    subject: r.subject,
    mode: r.mode,
    speakingOrder: r.speaking_order,
    startS: r.start_s === null ? null : Number(r.start_s),
    endS: r.end_s === null ? null : Number(r.end_s),
    transcript: r.transcript,
    excerpt: r.transcript ? excerptAround(r.transcript, terms) : null,
    lexical: r.lexical,
    similarity: r.similarity === null ? null : Number(r.similarity),
  };
}

/**
 * The answer to "how many people raised this?".
 *
 * Counting happens here, in TypeScript, over rows the database returned —
 * not in SQL and not in a model. The corpus is one year of sittings, so the
 * matched set is small enough to return whole, which means the count is over
 * every match rather than over a page of them.
 */
export async function answerAboutQuestions(
  query: string,
  mode?: "orale" | "ecrite",
  lexicalOnly = false,
): Promise<CouncilAnswer> {
  const trimmed = query.trim();
  const empty: CouncilAnswer = {
    query: trimmed,
    expanded: trimmed,
    counted: [],
    related: [],
    people: 0,
    meetings: 0,
  };
  if (!trimmed) return empty;

  const expanded = expandQuery(trimmed);
  const embedding = lexicalOnly ? null : await embed(trimmed);

  const supabase = await sb();
  const { data, error } = await supabase.rpc("search_council_questions", {
    query_text: expanded,
    query_embedding: embedding,
    p_mode: mode ?? null,
  });

  if (error) {
    console.error("[council] search_council_questions:", error.message);
    return { ...empty, expanded };
  }

  const terms = searchTerms(expanded);
  const hits = (data as QuestionRow[]).map((r) => toQuestion(r, terms));
  const counted = hits.filter((h) => h.lexical);
  const related = hits.filter((h) => !h.lexical);

  return {
    query: trimmed,
    expanded,
    counted,
    related,
    people: distinctPeople(counted),
    meetings: distinctMeetings(counted),
  };
}

type ResolutionRow = {
  id: string;
  youtube_id: string;
  meeting_title: string;
  meeting_date: string;
  pv_url: string | null;
  odj_url: string | null;
  number: string;
  title: string;
  body: string | null;
  outcome: string | null;
  agenda_code: string | null;
  moved_by: string | null;
  seconded_by: string | null;
  debate: boolean;
  start_s: number | null;
  lexical: boolean;
  similarity: number | null;
};

export async function searchResolutions(query: string): Promise<{
  counted: ResolutionHit[];
  related: ResolutionHit[];
  expanded: string;
}> {
  const trimmed = query.trim();
  if (!trimmed) return { counted: [], related: [], expanded: trimmed };

  const expanded = expandQuery(trimmed);
  const embedding = await embed(trimmed);

  const supabase = await sb();
  const { data, error } = await supabase.rpc("search_council_resolutions", {
    query_text: expanded,
    query_embedding: embedding,
  });

  if (error) {
    console.error("[council] search_council_resolutions:", error.message);
    return { counted: [], related: [], expanded };
  }

  const hits = (data as ResolutionRow[]).map((r) => ({
    id: r.id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    youtubeId: r.youtube_id,
    pvUrl: r.pv_url,
    odjUrl: r.odj_url,
    number: r.number,
    title: r.title,
    body: r.body,
    outcome: r.outcome,
    agendaCode: r.agenda_code,
    movedBy: r.moved_by,
    secondedBy: r.seconded_by,
    debate: r.debate,
    startS: r.start_s === null ? null : Number(r.start_s),
    lexical: r.lexical,
    similarity: r.similarity === null ? null : Number(r.similarity),
  }));

  return {
    counted: hits.filter((h) => h.lexical),
    related: hits.filter((h) => !h.lexical),
    expanded,
  };
}

type RemarkRow = {
  id: string;
  youtube_id: string;
  meeting_title: string;
  meeting_date: string;
  pv_url: string | null;
  person_id: string | null;
  name: string;
  topic: string;
  kind: "commentaire" | "question";
  start_s: number | null;
  lexical: boolean;
  similarity: number | null;
};

/**
 * What the elected members raised themselves (agenda items 10.04 and 10.07).
 *
 * Counted the same way as everything else: only rows containing the words are
 * counted, and here the count that means something is of *items* rather than of
 * people — five councillors between them raise thirty things a sitting, so
 * "how many people" would almost always be "five" and say nothing.
 */
export async function searchRemarks(
  query: string,
  kind?: "commentaire" | "question",
): Promise<{ counted: RemarkHit[]; related: RemarkHit[]; expanded: string }> {
  const trimmed = query.trim();
  if (!trimmed) return { counted: [], related: [], expanded: trimmed };

  const expanded = expandQuery(trimmed);
  const embedding = await embed(trimmed);

  const supabase = await sb();
  const { data, error } = await supabase.rpc("search_council_remarks", {
    query_text: expanded,
    query_embedding: embedding,
    p_kind: kind ?? null,
  });

  if (error) {
    console.error("[council] search_council_remarks:", error.message);
    return { counted: [], related: [], expanded };
  }

  const hits = (data as RemarkRow[]).map((r) => ({
    id: r.id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    youtubeId: r.youtube_id,
    pvUrl: r.pv_url,
    personId: r.person_id,
    name: r.name,
    topic: r.topic,
    kind: r.kind,
    startS: r.start_s === null ? null : Number(r.start_s),
    lexical: r.lexical,
    similarity: r.similarity === null ? null : Number(r.similarity),
  }));

  return {
    counted: hits.filter((h) => h.lexical),
    related: hits.filter((h) => !h.lexical),
    expanded,
  };
}

type SegmentRow = {
  id: string;
  youtube_id: string;
  meeting_title: string;
  meeting_date: string;
  start_s: number;
  end_s: number;
  text: string;
  section: Section | null;
  speaker: string | null;
  lexical_rank: number | null;
  semantic_rank: number | null;
};

/**
 * Passages of the recording itself, for when the words are what is wanted.
 *
 * `lexicalOnly` turns off the meaning half. It exists because ranking fuses
 * word matches with nearest neighbours and then truncates: filtering the
 * survivors afterwards does not give you the best word matches, it gives you
 * whichever word matches happened to outrank the neighbours. A caller that
 * wants only rows containing the words has to say so before the cut, not after.
 *
 * It is also the cheap path. No embedding is computed, so no model is loaded,
 * which is what makes it safe to serve on every request at any volume.
 */
export async function searchCouncil(
  query: string,
  section?: Section,
  matchCount = 12,
  lexicalOnly = false,
): Promise<{ hits: SearchHit[]; semantic: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { hits: [], semantic: false };

  const embedding = lexicalOnly ? null : await embed(trimmed);

  const supabase = await sb();
  const { data, error } = await supabase.rpc("search_council", {
    query_text: expandQuery(trimmed),
    query_embedding: embedding,
    match_count: matchCount,
    p_section: section ?? null,
  });

  if (error) {
    console.error("[council] search_council:", error.message);
    return { hits: [], semantic: false };
  }

  const hits = (data as SegmentRow[]).map((r) => ({
    id: r.id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    youtubeId: r.youtube_id,
    startS: Number(r.start_s),
    endS: Number(r.end_s),
    text: r.text,
    section: r.section,
    speaker: r.speaker,
    lexicalRank: r.lexical_rank,
    semanticRank: r.semantic_rank,
  }));

  return { hits, semantic: embedding !== null };
}

type SummaryRow = {
  youtube_id: string;
  meeting_date: string;
  title: string;
  kind: string | null;
  president: string | null;
  president_acting: boolean;
  pv_url: string | null;
  odj_url: string | null;
  duration_s: number | null;
  oral: number;
  written: number;
  people: number;
  aligned: number;
  resolutions: number;
  unanimous: number;
  divided: number;
  debates: number;
  remarks: number;
  top_subjects: string[] | null;
};

function toSummary(r: SummaryRow): MeetingSummary {
  return {
    youtubeId: r.youtube_id,
    meetingDate: r.meeting_date,
    title: r.title,
    kind: r.kind,
    president: r.president,
    presidentActing: r.president_acting,
    pvUrl: r.pv_url,
    odjUrl: r.odj_url,
    durationS: r.duration_s,
    oral: Number(r.oral),
    written: Number(r.written),
    people: Number(r.people),
    aligned: Number(r.aligned),
    resolutions: Number(r.resolutions),
    unanimous: Number(r.unanimous),
    divided: Number(r.divided),
    debates: Number(r.debates),
    remarks: Number(r.remarks),
    topSubjects: r.top_subjects ?? [],
  };
}

/** Every sitting, newest first, with the figures the overview shows. */
export async function listMeetingSummaries(): Promise<MeetingSummary[]> {
  const supabase = await sb();
  const { data, error } = await supabase.rpc("council_meeting_summaries");
  if (error) {
    console.error("[council] council_meeting_summaries:", error.message);
    return [];
  }
  return (data as SummaryRow[]).map(toSummary);
}

/** One sitting in full: its summary plus everything said and decided in it. */
export async function getMeeting(youtubeId: string): Promise<{
  summary: MeetingSummary;
  questions: QuestionHit[];
  resolutions: ResolutionHit[];
  remarks: RemarkHit[];
} | null> {
  const all = await listMeetingSummaries();
  const summary = all.find((m) => m.youtubeId === youtubeId);
  if (!summary) return null;

  const supabase = await sb();
  const { data: meetingRow } = await supabase
    .from("council_meetings")
    .select("id")
    .eq("youtube_id", youtubeId)
    .maybeSingle();
  if (!meetingRow) return null;
  const id = (meetingRow as { id: string }).id;

  const [q, r, k] = await Promise.all([
    supabase
      .from("council_questions")
      .select("id, person_id, name, subject, mode, speaking_order, start_s, end_s, transcript")
      .eq("meeting_id", id)
      .order("mode")
      .order("speaking_order"),
    supabase
      .from("council_resolutions")
      .select(
        "id, number, title, body, outcome, agenda_code, moved_by, seconded_by, debate, start_s",
      )
      .eq("meeting_id", id)
      .order("speaking_order"),
    supabase
      .from("council_remarks")
      .select("id, person_id, name, topic, kind, start_s")
      .eq("meeting_id", id)
      .order("kind")
      .order("speaking_order"),
  ]);

  const meta = {
    meetingTitle: summary.title,
    meetingDate: summary.meetingDate,
    youtubeId: summary.youtubeId,
    pvUrl: summary.pvUrl,
  };

  return {
    summary,
    // No excerpt: on a meeting page the whole turn is the point, not the part
    // that matched a search nobody ran.
    questions: ((q.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...meta,
      id: row.id as string,
      personId: (row.person_id as string | null) ?? null,
      name: row.name as string,
      subject: row.subject as string,
      mode: row.mode as "orale" | "ecrite",
      speakingOrder: row.speaking_order as number,
      startS: row.start_s === null ? null : Number(row.start_s),
      endS: row.end_s === null ? null : Number(row.end_s),
      transcript: (row.transcript as string | null) ?? null,
      excerpt: (row.transcript as string | null) ?? null,
      lexical: true,
      similarity: null,
    })),
    resolutions: ((r.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...meta,
      odjUrl: summary.odjUrl,
      id: row.id as string,
      number: row.number as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      outcome: (row.outcome as string | null) ?? null,
      agendaCode: (row.agenda_code as string | null) ?? null,
      movedBy: (row.moved_by as string | null) ?? null,
      secondedBy: (row.seconded_by as string | null) ?? null,
      debate: Boolean(row.debate),
      startS: row.start_s === null ? null : Number(row.start_s),
      lexical: true,
      similarity: null,
    })),
    remarks: ((k.data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...meta,
      id: row.id as string,
      personId: (row.person_id as string | null) ?? null,
      name: row.name as string,
      topic: row.topic as string,
      kind: row.kind as "commentaire" | "question",
      startS: row.start_s === null ? null : Number(row.start_s),
      lexical: true,
      similarity: null,
    })),
  };
}

/**
 * Every time a subject was raised at the council, for a project page.
 *
 * Deliberately not `searchCouncil`. That one ranks by meaning and returns the
 * best dozen passages, which is right for a search box and wrong here: a
 * project page is making a claim of record — "residents raised this at five
 * sittings" — and a claim of record has to be a complete literal match or it is
 * not a count. So this is `ilike` over the subject the clerk wrote down and the
 * title the borough numbered, every row, no embedding, no ranking.
 *
 * It also means the number on the page cannot drift when the embedding model
 * changes, and that it degrades to nothing rather than to something plausible
 * when the council tables are empty.
 */
export async function councilMentions(term: string): Promise<{
  questions: QuestionHit[];
  resolutions: ResolutionHit[];
}> {
  const clean = term.trim();
  if (!clean) return { questions: [], resolutions: [] };
  // `%` and `_` are ilike wildcards; a project term is a plain word.
  const pattern = `%${clean.replace(/[%_\\]/g, " ")}%`;

  const supabase = await sb();
  const meeting = "meeting:council_meetings!inner(title, meeting_date, youtube_id, pv_url, odj_url)";

  const [q, r] = await Promise.all([
    supabase
      .from("council_questions")
      .select(
        `id, name, subject, mode, speaking_order, start_s, end_s, transcript, person_id, ${meeting}`,
      )
      .or(`subject.ilike.${pattern},transcript.ilike.${pattern}`)
      .order("speaking_order", { ascending: true }),
    supabase
      .from("council_resolutions")
      .select(
        `id, number, title, body, outcome, agenda_code, moved_by, seconded_by, debate, start_s, ${meeting}`,
      )
      .or(`title.ilike.${pattern},body.ilike.${pattern}`)
      .order("speaking_order", { ascending: true }),
  ]);

  if (q.error) console.error("[council] mentions/questions:", q.error.message);
  if (r.error) console.error("[council] mentions/resolutions:", r.error.message);

  type Joined = { meeting: { title: string; meeting_date: string; youtube_id: string; pv_url: string | null; odj_url: string | null } };

  const questions = ((q.data ?? []) as unknown as (QuestionRow & Joined)[]).map((row) => ({
    ...toQuestion({
      ...row,
      meeting_title: row.meeting.title,
      meeting_date: row.meeting.meeting_date,
      youtube_id: row.meeting.youtube_id,
      pv_url: row.meeting.pv_url,
      lexical: true,
      similarity: null,
      // The term the caller matched on is what the excerpt should centre on.
    }, [clean]),
  }));

  const resolutions = ((r.data ?? []) as unknown as (Record<string, unknown> & Joined)[]).map(
    (row) => ({
      id: row.id as string,
      meetingTitle: row.meeting.title,
      meetingDate: row.meeting.meeting_date,
      youtubeId: row.meeting.youtube_id,
      pvUrl: row.meeting.pv_url,
      odjUrl: row.meeting.odj_url,
      number: row.number as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      outcome: (row.outcome as string | null) ?? null,
      agendaCode: (row.agenda_code as string | null) ?? null,
      movedBy: (row.moved_by as string | null) ?? null,
      secondedBy: (row.seconded_by as string | null) ?? null,
      debate: Boolean(row.debate),
      startS: row.start_s === null ? null : Number(row.start_s),
      lexical: true,
      similarity: null,
    }),
  );

  // Oldest first: this is a history, not a ranking.
  const byDate = <T extends { meetingDate: string }>(a: T, b: T) =>
    a.meetingDate.localeCompare(b.meetingDate);

  return { questions: questions.sort(byDate), resolutions: resolutions.sort(byDate) };
}
