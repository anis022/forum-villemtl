-- Make the forum read like a place with people in it rather than a ticket
-- queue: faces on posts, and a visible trace of what each person has backed.
--
-- The engagement data already existed — votes and comments both carry the
-- user — it was simply never surfaced. What is genuinely new here is the
-- avatar, and a way to fetch a handful of supporters per issue without
-- issuing one query per card.

-- 1. Avatars ----------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_url text;

-- Public bucket: avatars appear next to every post, so they are readable by
-- anyone who can read the forum, which is everyone.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Files live under <user-id>/<name>, which is what makes ownership checkable
-- from the path alone.
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can replace their own avatar" on storage.objects;
create policy "Users can replace their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 2. Supporters, in bulk ----------------------------------------------------
-- A face pile needs a few supporters per issue. Fetching them one issue at a
-- time would be a query per card on every list render, so the whole page's
-- worth is fetched in one call and grouped client-side.

create or replace function public.issue_supporters(
  p_issue_ids uuid[],
  p_per_issue int default 5
)
returns table (
  issue_id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  voted_at timestamptz
)
language sql stable
set search_path = public
as $$
  select issue_id, user_id, first_name, last_name, avatar_url, voted_at
    from (
      select v.issue_id,
             v.user_id,
             p.first_name,
             p.last_name,
             p.avatar_url,
             v.created_at as voted_at,
             row_number() over (
               partition by v.issue_id order by v.created_at desc
             ) as rn
        from public.votes v
        join public.profiles p on p.id = v.user_id
       where v.issue_id = any (p_issue_ids)
    ) ranked
   where rn <= p_per_issue;
$$;

grant execute on function public.issue_supporters(uuid[], int) to anon, authenticated;

-- 3. One person's activity --------------------------------------------------
-- Powers the profile page: what someone opened, answered and backed, newest
-- first, as a single ordered stream.

create or replace function public.profile_activity(
  p_user_id uuid,
  p_limit int default 40
)
returns table (
  kind text,
  issue_id uuid,
  issue_title text,
  body text,
  happened_at timestamptz
)
language sql stable
set search_path = public
as $$
  select kind, issue_id, issue_title, body, happened_at
    from (
      select 'issue' as kind, i.id as issue_id, i.title as issue_title,
             i.body, i.created_at as happened_at
        from public.issues i
       where i.author_id = p_user_id

      union all

      select 'comment', c.issue_id, i.title, c.body, c.created_at
        from public.comments c
        join public.issues i on i.id = c.issue_id
       where c.author_id = p_user_id

      union all

      select 'vote', v.issue_id, i.title, null, v.created_at
        from public.votes v
        join public.issues i on i.id = v.issue_id
       where v.user_id = p_user_id
    ) stream
   order by happened_at desc
   limit p_limit;
$$;

grant execute on function public.profile_activity(uuid, int) to anon, authenticated;
