/**
 * Apply a migration file.
 *
 *   npm run migrate -- supabase/migrations/0007_search_margin.sql
 *
 * Wraps the file in a transaction so a failure part-way leaves nothing behind.
 * Connection comes from DATABASE_URL; nothing is assembled or stored here.
 */

import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: apply.ts <fichier.sql>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`applique : ${file}`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error(`ECHEC (annule) : ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
