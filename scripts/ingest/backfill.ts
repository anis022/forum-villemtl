/**
 * Register the known meetings and ingest any that have no segments yet.
 *
 *   npm run backfill          ingest everything still missing
 *   npm run backfill -- --list   show status without doing work
 *
 * Each meeting is ingested in its own child process so that one bad video —
 * a pulled stream, a caption track that vanishes — cannot abort the batch.
 * Re-running only picks up what is still missing, so it is safe to interrupt.
 */

import { spawn } from "node:child_process";
import { Client } from "pg";
import { MEETINGS } from "./meetings.ts";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

const listOnly = process.argv.includes("--list");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Register first: run.ts refuses to ingest a video with no meeting row.
for (const m of MEETINGS) {
  await client.query(
    `insert into council_meetings (youtube_id, title, meeting_date, url, transcript_source)
     values ($1, $2, $3, $4, 'captions')
     on conflict (youtube_id) do update
       set title = excluded.title, meeting_date = excluded.meeting_date`,
    [m.youtubeId, m.title, m.date, `https://www.youtube.com/watch?v=${m.youtubeId}`],
  );
}

const { rows: status } = await client.query<{ youtube_id: string; title: string; n: string }>(
  `select m.youtube_id, m.title, count(s.id)::text as n
     from council_meetings m
     left join council_segments s on s.meeting_id = m.id
    group by m.id
    order by m.meeting_date desc`,
);
await client.end();

console.log("etat du corpus :");
for (const r of status) {
  console.log(`  ${Number(r.n) > 0 ? "OK  " : "vide"} ${r.n.padStart(5)} segments  ${r.title}`);
}

const pending = status.filter((r) => Number(r.n) === 0).map((r) => r.youtube_id);
if (listOnly) process.exit(0);
if (!pending.length) {
  console.log("\nrien a faire.");
  process.exit(0);
}

console.log(`\n${pending.length} seance(s) a ingerer.\n`);

const run = (id: string) =>
  new Promise<number>((resolve) => {
    const p = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env",
        "--env-file-if-exists=.env.local",
        "--experimental-strip-types",
        "scripts/ingest/run.ts",
        id,
      ],
      { stdio: "inherit" },
    );
    p.on("close", (code) => resolve(code ?? 1));
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Downloading a dozen caption tracks back to back earns an HTTP 429. Spacing
 * the requests avoids it; the retry pass waits longer still, because a 429
 * already served means the limiter is warm.
 */
const PAUSE_MS = 45_000;
const RETRY_PAUSE_MS = 150_000;

async function pass(ids: string[], pauseMs: number, label: string): Promise<string[]> {
  const failed: string[] = [];
  for (const [i, id] of ids.entries()) {
    console.log(`--- ${label} [${i + 1}/${ids.length}] ${id} ---`);
    const code = await run(id);
    if (code !== 0) {
      failed.push(id);
      console.error(`    echec (code ${code}) — on continue`);
    }
    if (i < ids.length - 1) await sleep(pauseMs);
  }
  return failed;
}

let failed = await pass(pending, PAUSE_MS, "passe 1");

if (failed.length) {
  console.log(`\n${failed.length} echec(s) — reprise dans ${RETRY_PAUSE_MS / 1000} s\n`);
  await sleep(RETRY_PAUSE_MS);
  failed = await pass(failed, RETRY_PAUSE_MS, "reprise");
}

console.log(`\ntermine : ${pending.length - failed.length} reussie(s), ${failed.length} echec(s)`);
if (failed.length) console.log(`echecs : ${failed.join(", ")}`);
