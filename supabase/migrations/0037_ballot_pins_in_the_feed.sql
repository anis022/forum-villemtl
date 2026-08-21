-- The feed shows the map, so the feed needs the pins.
--
-- `polls_for_issues` returned a count of map answers and nothing else, which was
-- enough while a map ballot in the feed was a sentence saying how many people
-- had replied. It is a map now, and a map with no points on it is worse than the
-- sentence was: it reads as "nobody has answered" rather than as "this was not
-- loaded".
--
-- The pins come from `poll_map_responses_public`, which is the view that already
-- decides what of a map answer is public — the place, the description and the
-- photograph, never who left it.

drop function if exists public.polls_for_issues(uuid[]);

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
  options jsonb,
  map_responses jsonb
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
           '[]'::jsonb),
         -- Only for the kind that has any, so a page of ordinary choice ballots
         -- does not carry an empty array per row for a column nothing reads.
         case when p.kind = 'map' then coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'id', r.id, 'lat', r.lat, 'lon', r.lon,
                     'description', r.description, 'image_path', r.image_path,
                     'created_at', r.created_at)
                     order by r.created_at)
              from public.poll_map_responses_public r where r.poll_id = p.id),
           '[]'::jsonb) else '[]'::jsonb end
    from public.polls p
   where p.issue_id = any (p_issue_ids);
$$;

grant execute on function public.polls_for_issues(uuid[]) to anon, authenticated;
