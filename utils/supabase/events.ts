import { cookies } from "next/headers";
import { createClient } from "./server";
import type { BoroughEvent, District, Setting } from "@/utils/events";

async function sb() {
  return createClient(await cookies());
}

type Row = {
  id: string;
  source_url: string;
  title: string;
  starts_on: string;
  ends_on: string | null;
  event_type: string | null;
  audience: string | null;
  setting: Setting | null;
  cost: string | null;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  district: District | null;
};

const toEvent = (r: Row): BoroughEvent => ({
  id: r.id,
  sourceUrl: r.source_url,
  title: r.title,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  eventType: r.event_type,
  audience: r.audience,
  setting: r.setting,
  cost: r.cost,
  venueName: r.venue_name,
  address: r.address,
  lat: r.lat === null ? null : Number(r.lat),
  lon: r.lon === null ? null : Number(r.lon),
  district: r.district,
});

/**
 * Every event that has not finished yet, ordered by start date.
 *
 * The whole set is sent to the client: having it all there makes the district
 * and type filters instant, with no round trip per toggle. That only stays
 * defensible because the columns are narrow — `description` is deliberately not
 * among them. It is stored by the ingest script and never rendered anywhere, so
 * selecting it shipped roughly a quarter of a megabyte of dead text on every
 * single load of this page.
 *
 * The date filter belongs here as well as in the sync. The sync already drops
 * anything finished, but the table is only ever as fresh as the last run, and a
 * sync that fails or is skipped for a week should not leave last month's
 * concerts sitting on the map. Read time is the only place that knows what day
 * it is on every request.
 *
 * `ends_on` is null for single-day events and set for a season-long series, so
 * "not finished" is `ends_on >= today` when there is one and `starts_on >=
 * today` when there is not — not simply `starts_on >= today`, which would hide
 * a summer programme the day after it opened.
 */
export async function listEvents(): Promise<BoroughEvent[]> {
  const supabase = await sb();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("borough_events")
    .select(
      "id, source_url, title, starts_on, ends_on, event_type, audience, setting, cost, venue_name, address, lat, lon, district",
    )
    .or(`ends_on.gte.${today},and(ends_on.is.null,starts_on.gte.${today})`)
    .order("starts_on");

  if (error) {
    console.error("[events] listEvents:", error.message);
    return [];
  }
  return (data as Row[]).map(toEvent);
}
