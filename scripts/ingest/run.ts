/**
 * Full ingestion for one meeting: captions -> windows -> vectors -> database.
 *
 *   $env:DATABASE_URL = "postgresql://..."   # Supabase > Settings > Database
 *   node --experimental-strip-types scripts/ingest/run.ts <youtubeId>
 *
 * Writes go over a direct Postgres connection because PostgREST with the
 * publishable key is read-only under RLS. The connection string is read from
 * DATABASE_URL rather than assembled here, so no credential is ever stored in
 * the repository.
 *
 * Re-running for the same video replaces its segments, so a failed or
 * improved pass can simply be repeated.
 */

import { Client } from "pg";
import { fetchCues, toWindows } from "./captions.ts";
import { embedPassages, toVectorLiteral, EMBEDDING_DIMS } from "../../utils/embedding.ts";

const BATCH = 32;

const youtubeId = process.argv[2];
if (!youtubeId) {
  console.error("usage: run.ts <youtubeId>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent. Supabase > Settings > Database > Connection string.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  const { rows: meetings } = await client.query<{ id: string; title: string }>(
    "select id, title from council_meetings where youtube_id = $1",
    [youtubeId],
  );
  if (!meetings.length) {
    throw new Error(
      `Aucune seance avec youtube_id='${youtubeId}'. Inserer la ligne council_meetings d'abord.`,
    );
  }
  const meeting = meetings[0];
  console.log(`Seance : ${meeting.title}`);

  console.log("1/4 sous-titres…");
  const cues = await fetchCues(youtubeId);
  const windows = toWindows(cues);
  const covered = cues.at(-1)?.end ?? 0;
  console.log(`     ${cues.length} cues -> ${windows.length} fenetres (${(covered / 60).toFixed(0)} min)`);

  console.log("2/4 vectorisation…");
  const vectors: number[][] = [];
  for (let i = 0; i < windows.length; i += BATCH) {
    const slice = windows.slice(i, i + BATCH);
    vectors.push(...(await embedPassages(slice.map((w) => w.text))));
    process.stdout.write(`\r     ${Math.min(i + BATCH, windows.length)}/${windows.length}`);
  }
  process.stdout.write("\n");

  const wrong = vectors.find((v) => v.length !== EMBEDDING_DIMS);
  if (wrong) throw new Error(`dimension ${wrong.length}, attendu ${EMBEDDING_DIMS}`);

  console.log("3/4 ecriture…");
  await client.query("begin");
  // Idempotent: a re-run replaces rather than duplicates.
  await client.query("delete from council_segments where meeting_id = $1", [meeting.id]);

  for (let i = 0; i < windows.length; i += BATCH) {
    const slice = windows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const tuples = slice.map((w, k) => {
      const v = vectors[i + k];
      values.push(meeting.id, w.startS, w.endS, w.text, toVectorLiteral(v));
      const b = k * 5;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::vector)`;
    });
    await client.query(
      `insert into council_segments (meeting_id, start_s, end_s, text, embedding)
       values ${tuples.join(", ")}`,
      values,
    );
  }

  await client.query("update council_meetings set duration_s = $1 where id = $2", [
    Math.round(covered),
    meeting.id,
  ]);
  await client.query("commit");

  console.log("4/4 verification…");
  const { rows } = await client.query<{ n: string; embedded: string }>(
    `select count(*) as n, count(embedding) as embedded
       from council_segments where meeting_id = $1`,
    [meeting.id],
  );
  console.log(`     ${rows[0].n} segments, ${rows[0].embedded} vectorises`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  throw err;
} finally {
  await client.end();
}
