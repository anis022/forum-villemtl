-- Make each sitting readable on its own, not only searchable.
--
-- Everything so far answers "who raised this?". This answers the other
-- question a resident arrives with: "what happened at the meeting?" — and it
-- answers it from the record rather than from a model. Every figure below is a
-- count of rows the borough published, so the summary cannot say anything the
-- minutes do not.
--
-- What makes a sitting legible turns out to be four things, and all four are
-- countable:
--
--   how many residents came and what they came about
--   what the council decided, and where it did not agree
--   which subjects drew a crowd
--   how much of it can be watched

alter table public.council_meetings
  -- Who chaired. The borough mayor usually, a councillor standing in otherwise,
  -- and the difference is worth keeping: Sonny Moroz chaired four of the six
  -- 2026 sittings as maire suppléant while remaining the Snowdon councillor.
  add column if not exists president text,
  add column if not exists president_acting boolean not null default false;

/**
 * One row per sitting, with everything the overview needs.
 *
 * Aggregated in SQL rather than by fetching every row and counting in the page:
 * six sittings today, but the shape of this should not change when there are
 * sixty.
 */
create or replace function public.council_meeting_summaries()
returns table (
  youtube_id text,
  meeting_date date,
  title text,
  kind text,
  president text,
  president_acting boolean,
  pv_url text,
  odj_url text,
  duration_s integer,
  oral integer,
  written integer,
  people integer,
  aligned integer,
  resolutions integer,
  unanimous integer,
  divided integer,
  debates integer,
  remarks integer,
  top_subjects text[]
)
language sql
stable
set search_path = public
as $$
  select
    m.youtube_id, m.meeting_date, m.title, m.kind,
    m.president, m.president_acting, m.pv_url, m.odj_url, m.duration_s,

    (select count(*)::int from council_questions q
      where q.meeting_id = m.id and q.mode = 'orale'),
    (select count(*)::int from council_questions q
      where q.meeting_id = m.id and q.mode = 'ecrite'),
    -- Distinct humans, so a resident who asks twice counts once.
    (select count(distinct coalesce(q.person_id::text, lower(q.name)))::int
       from council_questions q where q.meeting_id = m.id),
    (select count(*)::int from council_questions q
      where q.meeting_id = m.id and q.start_s is not null),

    (select count(*)::int from council_resolutions r where r.meeting_id = m.id),
    (select count(*)::int from council_resolutions r
      where r.meeting_id = m.id and r.outcome ilike '%UNANIMIT%'),
    -- Where the council split. Rarer than unanimity and far more interesting,
    -- so the page can lead with it.
    (select count(*)::int from council_resolutions r
      where r.meeting_id = m.id and r.outcome is not null
        and r.outcome not ilike '%UNANIMIT%'),
    (select count(*)::int from council_resolutions r
      where r.meeting_id = m.id and r.debate),

    (select count(*)::int from council_remarks k where k.meeting_id = m.id),

    -- The subjects several residents came about. The clerk files them under a
    -- shared wording, so a repeated subject is the sitting's own account of
    -- what it was about: eleven people on the Sherbrooke parking meters says
    -- more than any summary of that evening could.
    (select array_agg(s.subject order by s.n desc, s.subject)
       from (
         select q.subject, count(*) as n
           from council_questions q
          where q.meeting_id = m.id
          group by q.subject
         having count(*) > 1
          order by n desc
          limit 3
       ) s)
  from council_meetings m
  order by m.meeting_date desc;
$$;

grant execute on function public.council_meeting_summaries() to anon, authenticated;
