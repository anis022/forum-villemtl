-- Citizen polls --------------------------------------------------------------
--
-- Polls are public reading material, like the forum. Creating one is an
-- official action; answering one is a member action. Individual choices are
-- private: the public tables expose only denormalised totals, while a signed-in
-- member may read their own vote so the interface can mark their selection.

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(trim(question)) between 5 and 200),
  description text not null default '' check (char_length(trim(description)) <= 2000),
  total_vote_count integer not null default 0 check (total_vote_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists polls_created_idx on public.polls (created_at desc);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  position smallint not null check (position between 0 and 9),
  vote_count integer not null default 0 check (vote_count >= 0),
  unique (poll_id, position),
  unique (poll_id, id)
);

create index if not exists poll_options_poll_idx
  on public.poll_options (poll_id, position);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, option_id)
    references public.poll_options (poll_id, id) on delete cascade
);

create index if not exists poll_votes_option_idx on public.poll_votes (option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Polls are viewable by everyone" on public.polls;
create policy "Polls are viewable by everyone"
  on public.polls for select using (true);

drop policy if exists "Poll options are viewable by everyone" on public.poll_options;
create policy "Poll options are viewable by everyone"
  on public.poll_options for select using (true);

-- A choice can reveal a political opinion. It is never part of the public
-- result set; the member who cast it can read it back and nobody else can.
drop policy if exists "Members can view their own poll votes" on public.poll_votes;
create policy "Members can view their own poll votes"
  on public.poll_votes for select to authenticated
  using ((select auth.uid()) = user_id);

-- No direct insert/update/delete policies. The two functions below are the
-- complete write surface, which keeps multi-row creation and vote switching
-- atomic and prevents a client from editing denormalised totals.

create or replace function public.create_poll(
  p_question text,
  p_description text,
  p_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  verdict text;
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  p_question := trim(coalesce(p_question, ''));
  p_description := trim(coalesce(p_description, ''));

  if char_length(p_question) not between 5 and 200
     or char_length(p_description) > 2000
     or coalesce(cardinality(p_options), 0) not between 2 and 10
     or exists (
       select 1 from unnest(p_options) option_label
        where char_length(trim(coalesce(option_label, ''))) not between 1 and 120
     )
     or (
       select count(*) from (
         select lower(trim(option_label)) from unnest(p_options) option_label
         group by lower(trim(option_label))
       ) distinct_options
     ) <> cardinality(p_options) then
    raise exception 'invalid poll' using errcode = '22023';
  end if;

  select score.verdict into verdict
    from public.moderation_score(
      concat_ws(' ', p_question, p_description, array_to_string(p_options, ' '))
    ) score;
  if verdict = 'block' then
    raise exception 'moderation_blocked' using errcode = '42501';
  end if;

  insert into public.polls (author_id, question, description)
  values (auth.uid(), p_question, p_description)
  returning id into created_id;

  insert into public.poll_options (poll_id, label, position)
  select created_id, trim(option_label), (ordinality - 1)::smallint
    from unnest(p_options) with ordinality as option_rows(option_label, ordinality);

  return created_id;
end;
$$;

revoke all on function public.create_poll(text, text, text[]) from public, anon;
grant execute on function public.create_poll(text, text, text[]) to authenticated;

create or replace function public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.viewer_is_member() then
    raise exception 'membership required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.poll_options o
     where o.poll_id = p_poll_id and o.id = p_option_id
  ) then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  insert into public.poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, user_id) do update
    set option_id = excluded.option_id,
        updated_at = now()
    where public.poll_votes.option_id is distinct from excluded.option_id;
end;
$$;

revoke all on function public.cast_poll_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_poll_vote(uuid, uuid) to authenticated;

create or replace function public.sync_poll_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
    update public.polls set total_vote_count = total_vote_count + 1 where id = new.poll_id;
  elsif tg_op = 'UPDATE' and old.option_id is distinct from new.option_id then
    update public.poll_options
       set vote_count = greatest(vote_count - 1, 0)
     where id = old.option_id;
    update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
  elsif tg_op = 'DELETE' then
    update public.poll_options
       set vote_count = greatest(vote_count - 1, 0)
     where id = old.option_id;
    update public.polls
       set total_vote_count = greatest(total_vote_count - 1, 0)
     where id = old.poll_id;
  end if;
  return null;
end;
$$;

drop trigger if exists poll_votes_sync_counts on public.poll_votes;
create trigger poll_votes_sync_counts
  after insert or update of option_id or delete on public.poll_votes
  for each row execute function public.sync_poll_vote_counts();
