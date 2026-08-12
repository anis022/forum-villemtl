-- Anonymous, short-lived traffic signals for the forum's "Trending" panel.
--
-- This is deliberately not a general analytics system. It stores no user id,
-- IP address, user agent, referrer or page path. The application gives each
-- browser a random HttpOnly cookie, hashes it before it reaches Postgres, and
-- records at most one opening of one item per UTC day. Rows older than 30 days
-- are removed by the existing weekly retention cron.

create table if not exists public.content_views (
  viewer_hash text not null check (viewer_hash ~ '^[0-9a-f]{64}$'),
  content_type text not null check (content_type in ('event', 'project')),
  content_id text not null check (char_length(content_id) between 1 and 200),
  viewed_on date not null default ((now() at time zone 'utc')::date),
  viewed_at timestamptz not null default now(),
  primary key (viewer_hash, content_type, content_id, viewed_on)
);

create index if not exists content_views_recent_idx
  on public.content_views (viewed_at desc, content_type, content_id);

alter table public.content_views enable row level security;

-- No table policy on purpose: the browser cannot read or write raw visitor
-- hashes. Only the server-only service role may call the recording function.

create or replace function public.record_content_view(
  p_viewer_hash text,
  p_content_type text,
  p_content_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_viewer_hash !~ '^[0-9a-f]{64}$'
     or p_content_type not in ('event', 'project')
     or char_length(p_content_id) not between 1 and 200 then
    raise exception 'invalid content view';
  end if;

  insert into public.content_views (viewer_hash, content_type, content_id)
  values (p_viewer_hash, p_content_type, p_content_id)
  on conflict do nothing;

  return found;
end;
$$;

revoke all on function public.record_content_view(text, text, text) from public;
grant execute on function public.record_content_view(text, text, text) to service_role;

-- A seven-day window keeps the result current. Every opening contributes a
-- little less as it ages, so yesterday's genuine interest can overtake a spike
-- from the start of the week. Expired events are excluded even if they were
-- heavily read while they were current.
create or replace function public.trending_content(p_limit int default 8)
returns table (
  content_type text,
  content_id text,
  views bigint,
  score double precision,
  last_viewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cv.content_type,
         cv.content_id,
         count(*)::bigint as views,
         sum(exp(-extract(epoch from (now() - cv.viewed_at)) / 604800.0))::double precision as score,
         max(cv.viewed_at) as last_viewed_at
    from public.content_views cv
   where cv.viewed_at >= now() - interval '7 days'
     and (
       cv.content_type = 'project'
       or exists (
         select 1
           from public.borough_events e
          where e.id::text = cv.content_id
            and coalesce(e.ends_on, e.starts_on) >= current_date
       )
     )
   group by cv.content_type, cv.content_id
   order by score desc, views desc, last_viewed_at desc
   limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.trending_content(int) from public;
grant execute on function public.trending_content(int) to anon, authenticated;

create or replace function public.purge_content_views(p_days int default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.content_views
   where viewed_at < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_content_views(int) from public;
grant execute on function public.purge_content_views(int) to service_role;
