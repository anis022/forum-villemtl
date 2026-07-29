-- Put reports on a map.
--
-- A pothole is a place before it is a paragraph. Storing where it is lets the
-- forum answer "what is broken near me", which a chronological list never can,
-- and lets a resident see at a glance whether their street is already covered.
--
-- Plain columns rather than PostGIS: every query here is "show me all of them",
-- with a few hundred rows inside one borough. A geometry type and a spatial
-- index would buy nothing and cost an extension.

alter table public.issues
  add column if not exists lat double precision,
  add column if not exists lon double precision;

-- Reports predating this migration have no location; they stay in the list and
-- are simply absent from the map, which is honest — nobody knows where they were.
comment on column public.issues.lat is
  'Latitude of the report, picked on the map. Null for issues created before locations existed.';

-- Enough to keep a bounding-box filter cheap if the archive ever outgrows a
-- single fetch. Partial, because the rows without a location can never match.
create index if not exists issues_location_idx
  on public.issues (lat, lon)
  where lat is not null and lon is not null;
