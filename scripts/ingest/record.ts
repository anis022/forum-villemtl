/**
 * Load the official record — people, public questions, resolutions — from the
 * parsed proces-verbaux into Postgres.
 *
 *   npm run ingest:record
 *   npm run ingest:record -- --dry
 *
 * Reads what `scripts/py/crawl_docs.py` and `scripts/py/parse_pv.py` produced
 * under data/docs/. Those two stages own the PDFs; this one owns the database,
 * and the JSON in between is the seam.
 *
 * Idempotent by construction: a sitting's questions and resolutions are deleted
 * and rewritten together, so re-running after an improved parse replaces the
 * old reading instead of doubling it. People are kept across runs, because
 * their ids are what make "the same resident, three sittings apart" a fact the
 * database can state.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { MEETINGS } from "./meetings.ts";
import { embedPassages, toVectorLiteral, EMBEDDING_DIMS } from "../../utils/embedding.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const DOCS = join(ROOT, "data", "docs");
const PARSED = join(DOCS, "parsed");
const INDEX = join(DOCS, "index.json");

const BATCH = 32;
const dry = process.argv.includes("--dry");

type PortalDoc = { type: string; docId: string; url: string; bulky: boolean };
type PortalMeeting = { date: string; time: string; kind: string; docs: PortalDoc[] };

type ParsedQuestion = {
  name: string;
  subject: string;
  mode: "orale" | "ecrite";
  order: number;
};

type ParsedResolution = {
  number: string;
  title: string;
  body: string;
  movedBy: string | null;
  secondedBy: string | null;
  outcome: string | null;
  agendaCode: string | null;
  dossier: string | null;
  debate: boolean;
  order: number;
};

type ParsedPv = {
  presences: {
    president: string | null;
    councillors: { name: string; district: string }[];
    staff: { name: string; role: string }[];
  };
  resolutions: ParsedResolution[];
  publicQuestions: ParsedQuestion[];
};

/**
 * The clerk is consistent but not perfect, and a database that treats "Joel
 * Coppieters" and "Joël Coppieters" as two residents will over-count every
 * question they ever asked. Folding accents and case gives one key per human.
 */
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function loadIndex(): PortalMeeting[] {
  if (!existsSync(INDEX)) {
    throw new Error(`${INDEX} absent. Lancer scripts/py/crawl_docs.py d'abord.`);
  }
  return JSON.parse(readFileSync(INDEX, "utf8")) as PortalMeeting[];
}

function pvFor(index: PortalMeeting[], date: string): { parsed: ParsedPv; url: string } | null {
  const meeting = index.find((m) => m.date === date);
  if (!meeting) return null;
  const doc = meeting.docs.find((d) => d.type === "pv");
  if (!doc) return null;
  const file = join(PARSED, `pv-${doc.docId}.json`);
  if (!existsSync(file)) return null;
  return { parsed: JSON.parse(readFileSync(file, "utf8")) as ParsedPv, url: doc.url };
}

function odjFor(index: PortalMeeting[], date: string): string | null {
  const meeting = index.find((m) => m.date === date);
  // The light agenda, not the 80 MB bundle with every annexe inline.
  return meeting?.docs.find((d) => d.type === "odj" && !d.bulky)?.url ?? null;
}

async function embedAll(texts: string[]): Promise<string[]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    vectors.push(...(await embedPassages(texts.slice(i, i + BATCH))));
  }
  const wrong = vectors.find((v) => v.length !== EMBEDDING_DIMS);
  if (wrong) throw new Error(`dimension ${wrong.length}, attendu ${EMBEDDING_DIMS}`);
  return vectors.map(toVectorLiteral);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

const index = loadIndex();
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("begin");

  // MEETINGS is the definition of the corpus, not merely an addition to it.
  // Narrowing the scope to 2026 left the earlier sittings sitting in the table,
  // and the page went on counting them: "14 séances" under a heading promising
  // 2026. Anything no longer listed goes, and the cascade takes its questions,
  // resolutions and segments with it.
  const { rowCount: removed } = await client.query(
    "delete from council_meetings where youtube_id <> all($1)",
    [MEETINGS.map((m) => m.youtubeId)],
  );
  if (removed) console.log(`  ${removed} seance(s) hors périmètre supprimee(s)`);

  let totalQuestions = 0;
  let totalResolutions = 0;

  for (const meeting of MEETINGS) {
    const pv = pvFor(index, meeting.date);
    const portal = index.find((m) => m.date === meeting.date);

    // Register the sitting whether or not its minutes exist yet: the most
    // recent one is always recorded before it is transcribed on paper.
    const { rows } = await client.query<{ id: string }>(
      `insert into council_meetings
         (youtube_id, title, meeting_date, url, kind, pv_url, odj_url, transcript_source)
       values ($1, $2, $3, $4, $5, $6, $7, 'whisper')
       on conflict (youtube_id) do update
         set title = excluded.title,
             meeting_date = excluded.meeting_date,
             kind = excluded.kind,
             pv_url = coalesce(excluded.pv_url, council_meetings.pv_url),
             odj_url = coalesce(excluded.odj_url, council_meetings.odj_url)
       returning id`,
      [
        meeting.youtubeId,
        meeting.title,
        meeting.date,
        `https://www.youtube.com/watch?v=${meeting.youtubeId}`,
        portal?.kind ?? null,
        pv?.url ?? null,
        odjFor(index, meeting.date),
      ],
    );
    const meetingId = rows[0].id;

    if (!pv) {
      console.log(`  ${meeting.date}  proces-verbal absent — seance enregistree seule`);
      continue;
    }

    // People first: questions reference them.
    const roles = new Map<string, { name: string; role: string; district: string | null }>();
    for (const c of pv.parsed.presences.councillors) {
      roles.set(nameKey(c.name), { name: c.name, role: "councillor", district: c.district });
    }
    if (pv.parsed.presences.president) {
      const p = pv.parsed.presences.president;
      roles.set(nameKey(p), { name: p, role: "mayor", district: null });
    }
    for (const s of pv.parsed.presences.staff) {
      roles.set(nameKey(s.name), { name: s.name, role: "staff", district: null });
    }
    for (const q of pv.parsed.publicQuestions) {
      const key = nameKey(q.name);
      // A resident who is also a councillor keeps the stronger role.
      if (!roles.has(key)) roles.set(key, { name: q.name, role: "resident", district: null });
    }

    for (const [key, p] of roles) {
      await client.query(
        `insert into council_people (name, name_key, role, district)
         values ($1, $2, $3, $4)
         on conflict (name_key) do update
           set name = excluded.name,
               district = coalesce(excluded.district, council_people.district),
               -- Never demote: being listed as a resident in one sitting must
               -- not overwrite a councillor's role recorded in another.
               role = case when council_people.role = 'resident'
                           then excluded.role else council_people.role end`,
        [p.name, key, p.role, p.district],
      );
    }

    const { rows: peopleRows } = await client.query<{ id: string; name_key: string }>(
      `select id, name_key from council_people where name_key = any($1)`,
      [[...roles.keys()]],
    );
    const peopleByKey = new Map(peopleRows.map((r) => [r.name_key, r.id]));

    // Replace this sitting's record wholesale.
    await client.query("delete from council_questions where meeting_id = $1", [meetingId]);
    await client.query("delete from council_resolutions where meeting_id = $1", [meetingId]);

    const questions = pv.parsed.publicQuestions;
    if (questions.length) {
      const vectors = dry ? [] : await embedAll(questions.map((q) => `${q.name}. ${q.subject}`));
      for (const [i, q] of questions.entries()) {
        await client.query(
          `insert into council_questions
             (meeting_id, person_id, name, subject, mode, speaking_order, embedding)
           values ($1, $2, $3, $4, $5, $6, $7::vector)`,
          [
            meetingId,
            peopleByKey.get(nameKey(q.name)) ?? null,
            q.name,
            q.subject,
            q.mode,
            q.order,
            vectors[i] ?? null,
          ],
        );
      }
    }

    const resolutions = pv.parsed.resolutions;
    if (resolutions.length) {
      const vectors = dry
        ? []
        : await embedAll(resolutions.map((r) => `${r.title}. ${r.body}`.slice(0, 2000)));
      for (const [i, r] of resolutions.entries()) {
        await client.query(
          `insert into council_resolutions
             (meeting_id, number, title, body, moved_by, seconded_by, outcome,
              agenda_code, dossier, debate, speaking_order, embedding)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector)`,
          [
            meetingId,
            r.number,
            r.title,
            r.body,
            r.movedBy,
            r.secondedBy,
            r.outcome,
            r.agendaCode,
            r.dossier,
            r.debate,
            r.order,
            vectors[i] ?? null,
          ],
        );
      }
    }

    totalQuestions += questions.length;
    totalResolutions += resolutions.length;
    console.log(
      `  ${meeting.date}  ${questions.length.toString().padStart(3)} interventions, ` +
        `${resolutions.length.toString().padStart(3)} resolutions`,
    );
  }

  if (dry) {
    await client.query("rollback");
    console.log(`\nessai a blanc annule : ${totalQuestions} interventions, ${totalResolutions} resolutions`);
  } else {
    await client.query("commit");
    console.log(`\n${totalQuestions} interventions, ${totalResolutions} resolutions ecrites`);
  }
} catch (err) {
  await client.query("rollback").catch(() => {});
  throw err;
} finally {
  await client.end();
}
