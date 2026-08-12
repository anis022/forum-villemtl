import { createClient } from "@supabase/supabase-js";

/**
 * Applying the short retention rules the application owns.
 *
 * The privacy policy tells residents that a message the filter held and an
 * elected official then cleared is erased after twelve months. This is what
 * makes that sentence true. A policy that promises a deletion nobody performs is
 * worse than a policy that promises nothing, because it is believed.
 *
 * Anonymous content-view signals are also erased after 30 days. They exist
 * only to answer what is trending this week and have no archival value.
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

  const [flags, views] = await Promise.all([
    supabase.rpc("purge_cleared_flags", { p_months: 12 }),
    supabase.rpc("purge_content_views", { p_days: 30 }),
  ]);

  if (flags.error) {
    return Response.json({ error: flags.error.message }, { status: 500 });
  }

  // During a rolling deployment the cron may run before migration 0023 lands.
  // Keep the established moderation retention working and report no traffic
  // rows removed rather than failing the whole job.
  const missingViewsFunction = views.error?.message.includes("purge_content_views");
  if (views.error && !missingViewsFunction) {
    return Response.json({ error: views.error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    cleared_flags_deleted: flags.data ?? 0,
    content_views_deleted: views.data ?? 0,
  });
}
