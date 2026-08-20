/**
 * The projects cron, run by hand.
 *
 *   npm run sync:projects           # propose what is missing
 *   npm run sync:projects -- --dry  # say what it would propose, write nothing
 *
 * Same work as `/api/cron/projects`, over a direct Postgres connection instead
 * of the Supabase client, and sharing every decision with it through
 * `planProposals`. This exists for the same reason `npm run sync:events` does:
 * a scheduled job nobody can run on demand is a job nobody can debug.
 */

import { Client } from "pg";
import {
  looksLikeProject,
  planProposals,
  type KnownProject,
  type ResolutionCandidate,
} from "../../utils/ingest/project-candidates.ts";

const dry = process.argv.includes("--dry");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  const { rows: resolutions } = await client.query(
    `select cr.number, cr.title, cr.body, cr.outcome, cr.dossier,
            to_char(m.meeting_date, 'YYYY-MM-DD') as meeting_date, m.youtube_id
       from public.council_resolutions cr
       join public.council_meetings m on m.id = cr.meeting_id
      order by cr.number`,
  );

  const candidates: ResolutionCandidate[] = resolutions
    .map((r) => ({
      number: r.number,
      title: r.title,
      body: r.body,
      outcome: r.outcome,
      dossier: r.dossier,
      meetingDate: r.meeting_date,
      youtubeId: r.youtube_id,
    }))
    .filter((c) => c.meetingDate && looksLikeProject(c.title));

  const { rows: projects } = await client.query(
    "select id, slug, content from public.projects",
  );
  const { rows: revisions } = await client.query(
    "select resolution_number, project_id, slug, status from public.project_revisions",
  );

  const alreadyProposed = new Set<string>();
  const pendingTargets = new Set<string>();
  for (const r of revisions) {
    if (r.resolution_number) alreadyProposed.add(r.resolution_number);
    if (r.status === "pending") pendingTargets.add(r.project_id ?? r.slug);
  }

  const { proposals, skipped } = planProposals({
    candidates,
    projects: projects as KnownProject[],
    alreadyProposed,
    pendingTargets,
  });

  console.log(`  ${candidates.length} décisions retenues, ${proposals.length} propositions`);

  for (const proposal of proposals) {
    const what = proposal.kind === "edited" ? "modifie" : "cree ";
    if (dry) {
      console.log(`  [essai] ${what} ${proposal.slug}  (${proposal.resolution_number})`);
      continue;
    }
    await client.query(
      `insert into public.project_revisions
         (project_id, slug, content, origin, status, resolution_number, source_note)
       values ($1, $2, $3::jsonb, 'cron', 'pending', $4, $5)`,
      [
        proposal.project_id,
        proposal.slug,
        JSON.stringify(proposal.content),
        proposal.resolution_number,
        proposal.source_note,
      ],
    );
    console.log(`  ${what} ${proposal.slug}  (${proposal.resolution_number})`);
  }

  for (const line of skipped) console.log(`  passe : ${line}`);
} finally {
  await client.end();
}
