-- Borough events, for the map.
--
-- Source is Montréal's open-data events feed, not the two montreal.ca pages a
-- reader would land on. Those render the same events but carry no coordinates;
-- the feed ships lat/long for 455 of 456 CDN-NDG entries and is refreshed
-- daily, so scraping HTML would be strictly worse.
--
-- Two things the feed does not give us, filled in at ingestion:
--   * district — assigned by point-in-polygon against the official electoral
--     districts, not by trusting a text field. This doubles as a sanity check
--     that the coordinates really fall inside the borough.
--   * venue_name — only 6 of 303 current events carry an address, so the
--     containing park is looked up from the green-space dataset. A pin with no
--     readable place name is useless to a resident.

create table if not exists public.borough_events (
  id uuid primary key default gen_random_uuid(),

  -- The montreal.ca page for the event: stable, unique, and the link we show.
  source_url text not null unique,

  title text not null,
  description text,

  starts_on date not null,
  -- Null for single-day events; many run for a whole season.
  ends_on date,

  event_type text,
  audience text,

  -- Normalised from the feed's "À l'extérieur" / "En salle" / "En ligne".
  -- Online events have coordinates but no business being on a map.
  setting text check (setting in ('outdoor', 'indoor', 'online')),

  cost text,

  venue_name text,
  address text,
  lat double precision,
  lon double precision,

  -- One of the five: Côte-des-Neiges, Darlington, Snowdon, Notre-Dame-de-Grâce,
  -- Loyola. Null means the point fell outside the borough.
  district text,

  synced_at timestamptz not null default now()
);

create index if not exists borough_events_dates_idx
  on public.borough_events (starts_on, ends_on);

create index if not exists borough_events_district_idx
  on public.borough_events (district);

create index if not exists borough_events_type_idx
  on public.borough_events (event_type);

alter table public.borough_events enable row level security;

drop policy if exists "Borough events are public" on public.borough_events;
create policy "Borough events are public"
  on public.borough_events for select using (true);
