/**
 * Move the projects that lived in the repository into the table.
 *
 *   npm run seed:projects
 *   npm run seed:projects -- --dry
 *
 * `utils/projects.ts` held them as a typed constant, and that constant is still
 * the source this reads — importing it rather than restating it is the only way
 * the row lands identical to what the page has been rendering. Once this has
 * run, that constant is history: the table is what /projets reads.
 *
 * Idempotent. A project already in the table is left alone rather than
 * overwritten, because by then it may carry edits the office made through the
 * site, and a re-run of a seed must never be the thing that reverts them.
 */

import { Client } from "pg";
import { SEEDED_PROJECTS } from "../../utils/projects.ts";

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
  for (const project of SEEDED_PROJECTS) {
    const { slug, ...content } = project;

    const { rows: already } = await client.query("select id from public.projects where slug = $1", [
      slug,
    ]);
    if (already.length) {
      console.log(`  ${slug} : deja en table, laisse tel quel`);
      continue;
    }

    // Checked against the same function the approval path uses, so a row the
    // seed plants can never be one a person would have been refused.
    const { rows: check } = await client.query(
      "select public.project_content_complete($1::jsonb) as ok",
      [JSON.stringify(content)],
    );
    if (!check[0].ok) {
      console.error(`  ${slug} : INCOMPLET, refuse`);
      process.exitCode = 1;
      continue;
    }

    if (dry) {
      console.log(`  ${slug} : serait insere (${content.photos.length} photos, ${content.milestones.length} jalons)`);
      continue;
    }

    await client.query(
      `insert into public.projects (slug, content, status, published)
       values ($1, $2::jsonb, $3, true)`,
      [slug, JSON.stringify(content), project.status],
    );
    console.log(`  ${slug} : insere`);
  }
} finally {
  await client.end();
}
