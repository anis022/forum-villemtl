-- A poll is a topic with a ballot in it, not a second kind of thing.
--
-- Polls arrived as their own island: their own table with their own question and
-- description, their own page at /sondages, their own card in its own band on
-- the home page, and their own colour. Everything the forum already does — reply
-- to it, support it, report it, edit it, take it down, find it in search, see it
-- on somebody's profile — had to be built again or went missing. Most of it went
-- missing.
--
-- The cheapest way to have all of that is to stop having two things. A poll
-- becomes one row in `public.polls` hanging off an ordinary issue, and the issue
-- is the topic: it owns the question (its title), the explanation (its body), the
-- author, the category, the comments, the supports, the moderation and the two
-- policies that already decide who may edit and who may delete. This table keeps
-- only what a ballot actually is — the options and the counting.
--
-- `question` and `description` are therefore dropped rather than left beside the
-- issue's title and body. Two columns holding the same sentence is the failure
-- where somebody edits the topic, the poll keeps the old wording, and the page
-- shows whichever one the query happened to select.

-- 1. Attach ------------------------------------------------------------------

alter table public.polls
  add column if not exists issue_id uuid references public.issues (id) on delete cascade;

-- Every poll that predates this gets the topic it should always have had. The
-- author, the wording and the date all move across, so the topic reads as
-- though it had been posted that way.
do $$
declare
  p record;
  new_issue uuid;
  moved_body text;
begin
  for p in select * from public.polls where issue_id is null loop
    -- `issues.body` insists on twenty characters and a poll's description was
    -- allowed to be empty, so the two have to be reconciled rather than assumed
    -- compatible. The question is appended before anything is invented, so the
    -- topic still reads as its own words.
    moved_body := trim(coalesce(p.description, ''));
    if char_length(moved_body) < 20 then
      moved_body := trim(moved_body || ' — ' || coalesce(p.question, ''));
    end if;
    if char_length(moved_body) < 20 then
      moved_body := rpad(moved_body, 20, '.');
    end if;

    insert into public.issues (author_id, title, body, category, status, created_at)
    values (p.author_id, left(p.question, 140), moved_body, 'general', 'open', p.created_at)
    returning id into new_issue;

    update public.polls set issue_id = new_issue where id = p.id;
  end loop;
end $$;

alter table public.polls
  alter column issue_id set not null;

-- One ballot per topic. A second would have no place to render and no way for a
-- reader to tell which of the two a comment was about.
create unique index if not exists polls_issue_idx on public.polls (issue_id);

alter table public.polls drop column if exists question;
alter table public.polls drop column if exists description;

-- 2. Who may do what ---------------------------------------------------------
--
-- The same answer as for the topic itself, because it is the topic: its author
-- while they are still a member, or the borough office. Expressed once, here,
-- and called by the three functions below rather than restated in each.

create or replace function public.may_edit_issue(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.issues i
     where i.id = target
       and (
         (i.author_id = (select auth.uid()) and public.viewer_is_member())
         or public.is_official((select auth.uid()))
       )
  )
$$;

grant execute on function public.may_edit_issue(uuid) to authenticated;

-- 3. Writing a ballot --------------------------------------------------------
--
-- Options arrive as a whole list and are reconciled against what is stored,
-- rather than deleted and reinserted. That is the difference between renaming a
-- choice and destroying the votes cast for it: an option keeps its id, so it
-- keeps its `vote_count` and the rows in `poll_votes` that point at it.
--
-- Removing an option does destroy its votes, and it should — there is nothing
-- honest to do with a vote for a choice that no longer exists — so the caller is
-- the one who has to mean it.

create or replace function public.save_poll_options(
  p_poll_id uuid,
  p_options jsonb            -- [{ id: uuid | null, label: text }, …] in order
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_issue uuid;
  item jsonb;
  n int := 0;
  kept uuid[] := '{}';
  fresh uuid;
begin
  select issue_id into target_issue from public.polls where id = p_poll_id;
  if target_issue is null then
    raise exception 'unknown poll %', p_poll_id;
  end if;
  if not public.may_edit_issue(target_issue) then
    raise exception 'not authorised';
  end if;

  if jsonb_array_length(p_options) < 2 then
    raise exception 'a ballot needs at least two choices';
  end if;

  for item in select * from jsonb_array_elements(p_options) loop
    n := n + 1;
    if coalesce(item ->> 'id', '') <> '' then
      update public.poll_options
         set label = trim(item ->> 'label'), position = n
       where id = (item ->> 'id')::uuid and poll_id = p_poll_id;
      kept := kept || (item ->> 'id')::uuid;
    else
      insert into public.poll_options (poll_id, label, position)
      values (p_poll_id, trim(item ->> 'label'), n)
      returning id into fresh;
      kept := kept || fresh;
    end if;
  end loop;

  delete from public.poll_options
   where poll_id = p_poll_id and not (id = any (kept));

  -- The total is the sum of what survived, so removing a choice takes its votes
  -- out of the denominator instead of leaving percentages that no longer add up.
  update public.polls
     set total_vote_count = coalesce(
       (select sum(o.vote_count) from public.poll_options o where o.poll_id = p_poll_id), 0)
   where id = p_poll_id;
end $$;

grant execute on function public.save_poll_options(uuid, jsonb) to authenticated;

-- 4. Creating one ------------------------------------------------------------
--
-- The topic and its ballot are made together or not at all: a topic that says
-- "which of these three" with no choices under it is a broken post, and the
-- function is the only thing that can guarantee the two arrive as a pair.

create or replace function public.create_poll_topic(
  p_title text,
  p_body text,
  p_category text,
  p_kind text,
  p_options jsonb,
  p_allow_pin_description boolean default false,
  p_allow_pin_image boolean default false,
  p_max_pins smallint default 1
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  new_issue uuid;
  new_poll uuid;
begin
  if actor is null or not public.viewer_is_member() then
    raise exception 'not authorised';
  end if;
  if p_kind not in ('choice', 'map') then
    raise exception 'unknown poll kind %', p_kind;
  end if;

  insert into public.issues (author_id, title, body, category, status)
  values (actor, trim(p_title), trim(p_body), p_category, 'open')
  returning id into new_issue;

  insert into public.polls (
    author_id, issue_id, kind,
    allow_pin_description, allow_pin_image, max_pins_per_member
  )
  values (
    actor, new_issue, p_kind,
    p_allow_pin_description, p_allow_pin_image, greatest(1, least(10, p_max_pins))
  )
  returning id into new_poll;

  if p_kind = 'choice' then
    perform public.save_poll_options(new_poll, p_options);
  end if;

  return new_issue;
end $$;

grant execute on function public.create_poll_topic(text, text, text, text, jsonb, boolean, boolean, smallint)
  to authenticated;

-- 5. Reading them with their topics ------------------------------------------
--
-- The feed asks for a page of issues and then asks this for the ballots among
-- them, rather than joining a poll onto every issue that will never have one.

create or replace function public.polls_for_issues(p_issue_ids uuid[])
returns table (
  poll_id uuid,
  issue_id uuid,
  kind text,
  total_vote_count integer,
  map_response_count integer,
  allow_pin_description boolean,
  allow_pin_image boolean,
  max_pins_per_member smallint,
  my_option_id uuid,
  options jsonb
)
language sql stable set search_path = public as $$
  select p.id, p.issue_id, p.kind, p.total_vote_count, p.map_response_count,
         p.allow_pin_description, p.allow_pin_image, p.max_pins_per_member,
         (select v.option_id from public.poll_votes v
           where v.poll_id = p.id and v.user_id = (select auth.uid())),
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'id', o.id, 'label', o.label, 'voteCount', o.vote_count)
                     order by o.position)
              from public.poll_options o where o.poll_id = p.id),
           '[]'::jsonb)
    from public.polls p
   where p.issue_id = any (p_issue_ids);
$$;

grant execute on function public.polls_for_issues(uuid[]) to anon, authenticated;
