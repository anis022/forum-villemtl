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
  description: string | null;
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
  description: r.description,
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
 * Every current event, ordered by start date.
 *
 * The whole set is sent to the client: at ~300 rows it is a few tens of
 * kilobytes, and having it all client-side makes the district and type filters
 * instant, with no round trip per toggle.
 */
export async function listEvents(): Promise<BoroughEvent[]> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("borough_events")
    .select(
      "id, source_url, title, description, starts_on, ends_on, event_type, audience, setting, cost, venue_name, address, lat, lon, district",
    )
    .order("starts_on");

  if (error) {
    console.error("[events] listEvents:", error.message);
    return [];
  }
  return (data as Row[]).map(toEvent);
}
