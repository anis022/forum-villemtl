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
import { canonicalName, unlistedCollisions } from "./people-aliases.ts";
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

type ParsedRemark = {
  name: string;
  topic: string;
  kind: "commentaire" | "question";
  order: number;
};

type ParsedPv = {
  presences: {
    president: string | null;
    presidentActing: boolean;
    councillors: { name: string; district: string }[];
    staff: { name: string; role: string }[];
  };
  resolutions: ParsedResolution[];
  publicQuestions: ParsedQuestion[];
  councilRemarks: ParsedRemark[];
};

/**
 * One key per human.
 *
 * Two things separate the same resident into two rows if left alone. Accents
 * and case do it silently — "Joel Coppieters" and "Joël Coppieters". Outright
 * different spellings do it too, and no amount of folding reaches those, so the
 * name goes through the reviewed alias list first: see people-aliases.ts for
 * why that list is hand-checked rather than computed.
 */
function nameKey(name: string): string {
  return canonicalName(name)
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
  let totalRemarks = 0;
  const everyName: string[] = [];
  const seenKeys = new Set<string>();

  for (const meeting of MEETINGS) {
    const pv = pvFor(index, meeting.date);
    const portal = index.find((m) => m.date === meeting.date);

    // Register the sitting whether or not its minutes exist yet: the most
    // recent one is always recorded before it is transcribed on paper.
    const { rows } = await client.query<{ id: string }>(
      // transcript_source is deliberately absent. This stage registers the
      // sitting and its paperwork; it has no idea whether a transcript exists.
      // Asserting 'whisper' here left the 9 March recording claiming a Whisper
      // transcript it did not have. The pass that writes the transcript is the
      // only one that can say so, and it does.
      `insert into council_meetings
         (youtube_id, title, meeting_date, url, kind, pv_url, odj_url,
          president, president_acting)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (youtube_id) do update
         set title = excluded.title,
             meeting_date = excluded.meeting_date,
             kind = excluded.kind,
             pv_url = coalesce(excluded.pv_url, council_meetings.pv_url),
             odj_url = coalesce(excluded.odj_url, council_meetings.odj_url),
             president = excluded.president,
             president_acting = excluded.president_acting
       returning id`,
      [
        meeting.youtubeId,
        meeting.title,
        meeting.date,
        `https://www.youtube.com/watch?v=${meeting.youtubeId}`,
        portal?.kind ?? null,
        pv?.url ?? null,
        odjFor(index, meeting.date),
        pv?.parsed.presences.president ?? null,
        pv?.parsed.presences.presidentActing ?? false,
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
      // Chairing a sitting as maire suppléant is a duty for the evening, not an
      // office. Recording it as the person's role would put "Maire·sse" beside
      // the Snowdon councillor's name on every page of the site.
      const role = pv.parsed.presences.presidentActing ? "councillor" : "mayor";
      roles.set(nameKey(p), { name: p, role, district: null });
    }
    for (const s of pv.parsed.presences.staff) {
      roles.set(nameKey(s.name), { name: s.name, role: "staff", district: null });
    }
    for (const q of pv.parsed.publicQuestions) {
      const key = nameKey(q.name);
      // The canonical spelling is what the person is stored and counted under;
      // the question row keeps the spelling the minutes printed, so nothing on
      // the page contradicts the PDF it links to.
      const canonical = canonicalName(q.name);
      // A resident who is also a councillor keeps the stronger role.
      if (!roles.has(key)) roles.set(key, { name: canonical, role: "resident", district: null });
    }

    for (const [key, p] of roles) {
      seenKeys.add(key);
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

    // Resolutions are wholly owned here, so they are replaced outright.
    await client.query("delete from council_resolutions where meeting_id = $1", [meetingId]);

    // Questions are not. This stage owns who spoke and about what; the
    // transcript stage owns when, and the words. Deleting and reinserting threw
    // the second half away — re-reading the minutes after a parser fix silently
    // wiped every timestamp and quote, and the only symptom was the page
    // quietly going back to "moment non repéré". So rows are upserted on their
    // natural key and the alignment columns are left untouched.
    //
    // Anything past the end of the new reading is removed below: a corrected
    // parse can yield fewer speakers than the one before it.

    const questions = pv.parsed.publicQuestions;
    everyName.push(...questions.map((q) => q.name));
    if (questions.length) {
      const vectors = dry ? [] : await embedAll(questions.map((q) => `${q.name}. ${q.subject}`));
      for (const [i, q] of questions.entries()) {
        await client.query(
          `insert into council_questions
             (meeting_id, person_id, name, subject, mode, speaking_order, embedding)
           values ($1, $2, $3, $4, $5, $6, $7::vector)
           on conflict (meeting_id, mode, speaking_order) do update
             set person_id = excluded.person_id,
                 name      = excluded.name,
                 subject   = excluded.subject,
                 embedding = excluded.embedding`,
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

    // Drop speakers the previous reading had but this one does not.
    for (const mode of ["orale", "ecrite"] as const) {
      const n = questions.filter((q) => q.mode === mode).length;
      await client.query(
        `delete from council_questions
          where meeting_id = $1 and mode = $2 and speaking_order >= $3`,
        [meetingId, mode, n],
      );
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

    // What the elected members raised themselves, from 10.04 and 10.07.
    const remarks = pv.parsed.councilRemarks ?? [];
    await client.query("delete from council_remarks where meeting_id = $1", [meetingId]);
    if (remarks.length) {
      const vectors = dry
        ? []
        : await embedAll(remarks.map((r) => `${r.name}. ${r.topic}`));
      for (const [i, r] of remarks.entries()) {
        await client.query(
          `insert into council_remarks
             (meeting_id, person_id, name, topic, kind, speaking_order, embedding)
           values ($1,$2,$3,$4,$5,$6,$7::vector)`,
          [
            meetingId,
            peopleByKey.get(nameKey(r.name)) ?? null,
            r.name,
            r.topic,
            r.kind,
            r.order,
            vectors[i] ?? null,
          ],
        );
      }
    }

    totalQuestions += questions.length;
    totalResolutions += resolutions.length;
    totalRemarks += remarks.length;
    console.log(
      `  ${meeting.date}  ${questions.length.toString().padStart(3)} interventions, ` +
        `${resolutions.length.toString().padStart(3)} resolutions, ` +
        `${remarks.length.toString().padStart(3)} prises de parole d'elus`,
    );
  }

  // The minutes define who exists, the same way MEETINGS defines the corpus.
  // Merging two spellings, or re-reading a sitting after fixing the parser,
  // leaves the superseded row behind — and it keeps being counted. That is how
  // "Sonny Moroz le maire suppléant" survived as a second person with the role
  // of borough mayor after the name itself had been corrected.
  const { rowCount: stale } = await client.query(
    "delete from council_people where name_key <> all($1)",
    [[...seenKeys]],
  );
  if (stale) console.log(`  ${stale} personne(s) obsolete(s) supprimee(s)`);

  // Surfaced every run rather than logged once and forgotten: a new spelling of
  // a regular attendee looks exactly like a new resident, and the only symptom
  // is a count that is quietly one too high.
  const collisions = unlistedCollisions(everyName);
  if (collisions.length) {
    console.log(
      `\n${collisions.length} homonymie(s) non repertoriee(s) — meme nom de famille, ` +
        `prenoms differents. Verifier s'il s'agit d'une seule personne et, le cas ` +
        `echeant, l'ajouter a scripts/ingest/people-aliases.ts :`,
    );
    for (const group of collisions) console.log(`  ${group.join("  |  ")}`);
  }

  if (dry) {
    await client.query("rollback");
    console.log(
      `\nessai a blanc annule : ${totalQuestions} interventions, ` +
        `${totalResolutions} resolutions, ${totalRemarks} prises de parole d'elus`,
    );
  } else {
    await client.query("commit");
    console.log(
      `\n${totalQuestions} interventions, ${totalResolutions} resolutions, ` +
        `${totalRemarks} prises de parole d'elus ecrites`,
    );
  }
} catch (err) {
  await client.query("rollback").catch(() => {});
  throw err;
} finally {
  await client.end();
}
