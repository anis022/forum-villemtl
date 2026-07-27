-- Forum: citizens open issues, other citizens comment and upvote, and elected
-- officials reply with a response that is marked as official.

-- 1. Roles ------------------------------------------------------------------

alter table public.profiles
  add column if not exists role text not null default 'citizen'
  check (role in ('citizen', 'official'));

-- Officials are promoted by hand:
--   update public.profiles set role = 'official' where id = '<uuid>';

-- 2. Issues -----------------------------------------------------------------

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 150),
  body text not null check (char_length(trim(body)) between 20 and 5000),
  category text not null default 'general'
    check (category in ('general','voirie','proprete','securite','transport','parcs','logement')),
  status text not null default 'open'
    check (status in ('open','answered','resolved')),
  -- Denormalised so the list can sort by popularity without an aggregate join.
  vote_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists issues_ranking_idx
  on public.issues (vote_count desc, created_at desc);

alter table public.issues enable row level security;

drop policy if exists "Issues are viewable by everyone" on public.issues;
create policy "Issues are viewable by everyone"
  on public.issues for select using (true);

drop policy if exists "Authenticated users can create issues" on public.issues;
create policy "Authenticated users can create issues"
  on public.issues for insert to authenticated
  with check ((select auth.uid()) = author_id);

drop policy if exists "Authors can update their own issues" on public.issues;
create policy "Authors can update their own issues"
  on public.issues for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

-- 3. Comments ---------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 5000),
  -- Frozen at write time: if someone later loses their official role, past
  -- replies should still read as official when they were made.
  is_official boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_issue_idx
  on public.comments (issue_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

drop policy if exists "Authenticated users can comment" on public.comments;
create policy "Authenticated users can comment"
  on public.comments for insert to authenticated
  with check ((select auth.uid()) = author_id);

-- 4. Votes ------------------------------------------------------------------

-- One row per (issue, user): the primary key is what enforces one vote each.
create table if not exists public.votes (
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

alter table public.votes enable row level security;

drop policy if exists "Votes are viewable by everyone" on public.votes;
create policy "Votes are viewable by everyone"
  on public.votes for select using (true);

drop policy if exists "Users can cast their own vote" on public.votes;
create policy "Users can cast their own vote"
  on public.votes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can retract their own vote" on public.votes;
create policy "Users can retract their own vote"
  on public.votes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. Counter triggers -------------------------------------------------------

create or replace function public.sync_vote_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.issues set vote_count = vote_count + 1 where id = new.issue_id;
  elsif tg_op = 'DELETE' then
    update public.issues set vote_count = greatest(vote_count - 1, 0) where id = old.issue_id;
  end if;
  return null;
end;
$$;

drop trigger if exists votes_sync_count on public.votes;
create trigger votes_sync_count
  after insert or delete on public.votes
  for each row execute function public.sync_vote_count();

create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.issues
       set comment_count = comment_count + 1,
           -- An official reply flips the issue into the "answered" state.
           status = case when new.is_official and status = 'open' then 'answered' else status end
     where id = new.issue_id;
  elsif tg_op = 'DELETE' then
    update public.issues set comment_count = greatest(comment_count - 1, 0) where id = old.issue_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_sync_count on public.comments;
create trigger comments_sync_count
  after insert or delete on public.comments
  for each row execute function public.sync_comment_count();
