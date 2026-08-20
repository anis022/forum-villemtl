/**
 * What the projects cron would propose, without proposing it.
 *
 *   npm run projects:dry
 *
 * The classifier in utils/ingest/project-candidates.ts is a filter over titles
 * a clerk wrote, so the only way to know whether it is tuned right is to read
 * what it keeps and what it drops against the real record. This prints both.
 */

import { Client } from "pg";
import { looksLikeProject, subjectOf, slugOf } from "../../utils/ingest/project-candidates.ts";
import { unshout } from "../../utils/council.ts";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query<{ number: string; title: string; meeting_date: Date }>(
  `select cr.number, cr.title, m.meeting_date
     from council_resolutions cr
     join council_meetings m on m.id = cr.meeting_id
    order by m.meeting_date desc, cr.number`,
);

const kept = rows.filter((r) => looksLikeProject(r.title));
for (const r of kept) {
  console.log(`  ${r.number}  ${slugOf(subjectOf(r.title)).padEnd(40)} ${unshout(subjectOf(r.title)).slice(0, 58)}`);
}

const contractish = rows.filter((r) => /^\s*(contrats?|renouvellement contrat|d[ée]pense additionnelle)/i.test(r.title));
const dropped = contractish.filter((r) => !looksLikeProject(r.title));

console.log(`\n  ${rows.length} resolutions -> ${contractish.length} contracts -> ${kept.length} proposed`);
console.log(`\n  dropped as equipment or service (${dropped.length}) :`);
for (const r of dropped) console.log(`    ${r.title.replace(/\s+/g, " ").slice(0, 84)}`);

await client.end();
