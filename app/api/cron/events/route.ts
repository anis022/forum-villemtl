import { createClient } from "@supabase/supabase-js";
import { collectEvents } from "@/utils/ingest/events-feed";

/**
 * The daily events sync.
 *
 * Montréal republishes its events feed every day; this pulls it, geocodes it
 * and reconciles the table, so the map is never showing last month's concerts
 * because nobody remembered to run a script. `npm run sync:events` still exists
 * and does the same work — it is the manual handle on the same machine.
 *
 * Scheduled from vercel.json at 12:00 UTC. Vercel's cron takes UTC only, with
 * no timezone field, so there is no schedule that is 08:00 in Montréal all year
 * — 12:00 UTC is 08:00 local on eastern daylight time, which covers mid-March
 * to early November and therefore the entire outdoor-events season, and 07:00
 * local through the winter. Erring early is the right way round: the map is
 * never staler than asked for, only fresher. (vercel.json rejects comment keys,
 * which is why this note lives here.)
 *
 * Vercel calls it with `Authorization: Bearer $CRON_SECRET` when that variable
 * is set on the project, which is the only thing standing between this endpoint
 * and anyone who can spell its URL — so a missing secret refuses the request
 * rather than defaulting to open.
 */

/** The feed and three GeoJSON datasets, then ~300 point-in-polygon passes. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** PostgREST has no transactions, so writes go in survivable chunks. */
const CHUNK = 100;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Supabase renamed these: a project issues `sb_secret_…` keys now, where it
  // used to issue a JWT called `service_role`. Either is accepted so the name
  // on the Vercel side can match whichever the dashboard is calling it.
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !key || !url) {
    return Response.json({ error: "sync is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // This key bypasses RLS, which is the point: nothing else may write this
  // table, and no browser ever holds it. It is read from the environment on
  // every request rather than at module scope, so rotating it in Vercel takes
  // effect on the next deploy without anything here needing to change.
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let rows;
  let stats;
  try {
    ({ rows, stats } = await collectEvents());
  } catch (error) {
    // The open-data portal rate-limits and occasionally answers with an error
    // page. Yesterday's events are better than none, so a bad fetch changes
    // nothing and says so.
    return Response.json({ error: `feed unavailable: ${(error as Error).message}` }, { status: 502 });
  }

  if (rows.length === 0) {
    return Response.json({ error: "feed returned no borough events" }, { status: 502 });
  }

  /*
   * Upsert then prune, rather than the delete-all-and-reinsert the CLI does
   * inside a transaction. Without transactions, a failure halfway through a
   * delete-then-insert leaves the borough with an empty events map until
   * somebody notices. This order never has fewer events on the map than it
   * started with.
   */
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("borough_events")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "source_url" });
    if (error) {
      return Response.json({ error: `upsert failed: ${error.message}` }, { status: 500 });
    }
  }

  const { data: existing, error: readError } = await supabase
    .from("borough_events")
    .select("source_url");
  if (readError) {
    return Response.json({ error: `read failed: ${readError.message}` }, { status: 500 });
  }

  const keep = new Set(rows.map((r) => r.source_url));
  const stale = (existing ?? [])
    .map((r) => r.source_url as string)
    .filter((u) => !keep.has(u));

  for (let i = 0; i < stale.length; i += CHUNK) {
    const { error } = await supabase
      .from("borough_events")
      .delete()
      .in("source_url", stale.slice(i, i + CHUNK));
    if (error) {
      return Response.json({ error: `prune failed: ${error.message}` }, { status: 500 });
    }
  }

  return Response.json({ ok: true, synced: rows.length, removed: stale.length, stats });
}
