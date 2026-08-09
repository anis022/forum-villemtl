/**
 * Load transcripts — and the alignment between them and the official record —
 * into Postgres.
 *
 *   npm run ingest:record        # must run first: it creates the questions
 *   npm run ingest:transcript
 *
 * Reads what scripts/py/transcribe.py and scripts/py/align.py produced under
 * data/transcripts/. Writes three things:
 *
 *   - retrieval windows into council_segments, with their section label so the
 *     page can filter public questions apart from the agenda;
 *   - the moment and the words for each aligned intervention, back onto the
 *     council_questions row the minutes created;
 *   - the model that produced all of it, onto the meeting.
 *
 * Idempotent per meeting: segments are replaced wholesale, so re-running after
 * a better decode swaps the transcript rather than doubling it.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { embedPassages, toVectorLiteral, EMBEDDING_DIMS } from "../../utils/embedding.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const TRANSCRIPTS = join(ROOT, "data", "transcripts");

const BATCH = 32;

/**
 * Retrieval windows, not Whisper's own segments.
 *
 * The decoder emits a clause at a time — four or five seconds, often half a
 * sentence. Embedding those individually gives vectors of fragments that match
 * nothing well. Roughly forty seconds is enough context to be about something,
 * and the overlap keeps an exchange that straddles a boundary findable from
 * either side.
 *
 * Unlike the caption-era windowing this replaces, the text now has punctuation
 * and casing, so windows break on sentence ends rather than mid-clause.
 */
const TARGET_S = 40;
const OVERLAP_S = 8;

type Word = { start: number; end: number; word: string; p: number };

type Segment = {
  start: number;
  end: number;
  text: string;
  language: string | null;
  avgLogprob: number;
  words: Word[];
};

type AlignedQuestion = {
  name: string;
  mode: "orale" | "ecrite";
  order: number;
  startS: number | null;
  endS: number | null;
  transcript: string | null;
};

type Transcript = {
  youtubeId: string;
  meetingDate: string;
  model: string;
  duration: number;
  segments: Segment[];
  alignment?: {
    questions: AlignedQuestion[];
    sections: { start: number; end: number; section: string }[];
    questionPeriod: { start: number | null; end: number | null };
  };
};

type Window = {
  startS: number;
  endS: number;
  text: string;
  lang: string | null;
  avgLogprob: number;
  words: Word[];
};

function toWindows(segments: Segment[]): Window[] {
  const windows: Window[] = [];
  let i = 0;

  while (i < segments.length) {
    const startS = segments[i].start;
    let j = i;
    const parts: Segment[] = [];

    while (j < segments.length && segments[j].end - startS <= TARGET_S) {
      parts.push(segments[j]);
      j++;
    }
    // A single segment longer than the target still has to land somewhere.
    if (!parts.length) {
      parts.push(segments[i]);
      j = i + 1;
    }

    const words = parts.flatMap((p) => p.words);
    // Majority language: a window is one language even when a sentence inside
    // it switched, and the index only needs to know which one to lean on.
    const langs = new Map<string, number>();
    for (const p of parts) if (p.language) langs.set(p.language, (langs.get(p.language) ?? 0) + 1);
    const lang = [...langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    windows.push({
      startS,
      endS: parts[parts.length - 1].end,
      text: parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim(),
      lang,
      avgLogprob: parts.reduce((s, p) => s + p.avgLogprob, 0) / parts.length,
      words,
    });

    if (j >= segments.length) break;

    // Step back far enough to create the overlap, but always make progress.
    const resumeAt = parts[parts.length - 1].end - OVERLAP_S;
    let next = j;
    while (next > i + 1 && segments[next - 1].start >= resumeAt) next--;
    i = next;
  }

  return windows;
}

/** The section a window belongs to, from the alignment's own boundaries. */
function sectionAt(t: Transcript, startS: number): string | null {
  const period = t.alignment?.questionPeriod;
  if (!period || period.start === null || period.end === null) return null;
  if (startS < period.start) return "commentaires";
  if (startS <= period.end) return "questions";
  return "resolutions";
}

async function embedAll(texts: string[]): Promise<string[]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    vectors.push(...(await embedPassages(texts.slice(i, i + BATCH))));
    process.stdout.write(`\r     ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
  }
  process.stdout.write("\n");
  const wrong = vectors.find((v) => v.length !== EMBEDDING_DIMS);
  if (wrong) throw new Error(`dimension ${wrong.length}, attendu ${EMBEDDING_DIMS}`);
  return vectors.map(toVectorLiteral);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

if (!existsSync(TRANSCRIPTS)) {
  console.error(`${TRANSCRIPTS} absent. Lancer scripts/py/transcribe.py d'abord.`);
  process.exit(1);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const files = readdirSync(TRANSCRIPTS)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !only.length || only.includes(f.replace(/\.json$/, "")));

if (!files.length) {
  console.error("aucune transcription correspondante.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  for (const file of files) {
    const t = JSON.parse(readFileSync(join(TRANSCRIPTS, file), "utf8")) as Transcript;

    const { rows } = await client.query<{ id: string }>(
      "select id from council_meetings where youtube_id = $1",
      [t.youtubeId],
    );
    if (!rows.length) {
      console.error(`  ${t.youtubeId}: aucune seance — lancer npm run ingest:record d'abord`);
      continue;
    }
    const meetingId = rows[0].id;

    console.log(`  ${t.youtubeId}  ${t.meetingDate}`);

    const windows = toWindows(t.segments);
    console.log(`     ${t.segments.length} segments -> ${windows.length} fenetres`);
    const vectors = await embedAll(windows.map((w) => w.text));

    await client.query("begin");
    await client.query("delete from council_segments where meeting_id = $1", [meetingId]);

    for (const [i, w] of windows.entries()) {
      await client.query(
        `insert into council_segments
           (meeting_id, start_s, end_s, text, words, lang, section, avg_logprob, embedding)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::vector)`,
        [
          meetingId,
          w.startS,
          w.endS,
          w.text,
          JSON.stringify(w.words),
          w.lang,
          sectionAt(t, w.startS),
          w.avgLogprob,
          vectors[i],
        ],
      );
    }

    // Carry the alignment back onto the record the minutes produced.
    let aligned = 0;
    for (const q of t.alignment?.questions ?? []) {
      if (q.startS === null) continue;
      const res = await client.query(
        `update council_questions
            set start_s = $1, end_s = $2, transcript = $3
          where meeting_id = $4 and mode = $5 and speaking_order = $6`,
        [q.startS, q.endS, q.transcript, meetingId, q.mode, q.order],
      );
      aligned += res.rowCount ?? 0;
    }

    // A question's own words are a better thing to search than the clerk's
    // one-line subject, so anything that gained a transcript is re-embedded.
    const { rows: toEmbed } = await client.query<{ id: string; name: string; subject: string; transcript: string }>(
      `select id, name, subject, transcript from council_questions
        where meeting_id = $1 and transcript is not null`,
      [meetingId],
    );
    if (toEmbed.length) {
      const qv = await embedAll(
        toEmbed.map((r) => `${r.name}. ${r.subject}. ${r.transcript}`.slice(0, 2000)),
      );
      for (const [i, r] of toEmbed.entries()) {
        await client.query("update council_questions set embedding = $1::vector where id = $2", [
          qv[i],
          r.id,
        ]);
      }
    }

    // Link each window to the intervention it falls inside, so a passage can
    // say whose words it is.
    await client.query(
      `update council_segments s
          set question_id = q.id
         from council_questions q
        where s.meeting_id = $1
          and q.meeting_id = $1
          and q.start_s is not null
          and s.start_s >= q.start_s
          and s.start_s < q.end_s`,
      [meetingId],
    );

    await client.query(
      `update council_meetings
          set duration_s = $1, transcript_model = $2, transcript_source = 'whisper'
        where id = $3`,
      [Math.round(t.duration), t.model, meetingId],
    );
    await client.query("commit");

    console.log(`     ${aligned} interventions horodatees`);
  }
} catch (err) {
  await client.query("rollback").catch(() => {});
  throw err;
} finally {
  await client.end();
}
