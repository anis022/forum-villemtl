import { createClient } from "@supabase/supabase-js";

/**
 * Applying the one retention rule the application owns.
 *
 * The privacy policy tells residents that a message the filter held and an
 * elected official then cleared is erased after twelve months. This is what
 * makes that sentence true. A policy that promises a deletion nobody performs is
 * worse than a policy that promises nothing, because it is believed.
 *
 * Everything else the forum holds — reports, replies, the council record — is
 * left alone on purpose. The borough is a public body, and destroying its
 * records is governed by an approved calendrier de conservation rather than by
 * a cron job somebody wrote on a Sunday. See migration 0022.
 *
 * Scheduled weekly rather than daily: the rule has a twelve-month horizon, so
 * running it every night would be 364 requests a year to delete nothing.
 *
 * Same guard as the events cron — `Authorization: Bearer $CRON_SECRET`, and a
 * missing secret refuses rather than defaults to open.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret) {
    return Response.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!key || !url) {
    return Response.json({ error: "supabase credentials not set" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.rpc("purge_cleared_flags", { p_months: 12 });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, cleared_flags_deleted: data ?? 0 });
}
