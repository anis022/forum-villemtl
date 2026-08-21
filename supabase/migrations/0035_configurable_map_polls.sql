-- Configurable map polls ------------------------------------------------------
--
-- Existing polls remain classic choice polls. New staff-created polls may
-- instead collect map points, with the staff deciding whether a point may
-- carry a description, a photo, and how many points one member may submit.

alter table public.polls
  add column if not exists kind text not null default 'choice'
    check (kind in ('choice', 'map')),
  add column if not exists allow_pin_description boolean not null default false,
  add column if not exists allow_pin_image boolean not null default false,
  add column if not exists max_pins_per_member smallint not null default 1
    check (max_pins_per_member between 1 and 10),
  add column if not exists map_response_count integer not null default 0
    check (map_response_count >= 0);

create table if not exists public.poll_map_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between 45.4495 and 45.5095),
  lon double precision not null check (lon between -73.665 and -73.598),
  description text not null default '' check (char_length(trim(description)) <= 1000),
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists poll_map_responses_poll_idx
  on public.poll_map_responses (poll_id, created_at);
create index if not exists poll_map_responses_member_idx
  on public.poll_map_responses (poll_id, user_id);

alter table public.poll_map_responses enable row level security;

-- The base row contains user_id and therefore is not public. Members can read
-- their own rows; the public view below deliberately leaves identity out.
drop policy if exists "Members can view their own map responses" on public.poll_map_responses;
create policy "Members can view their own map responses"
  on public.poll_map_responses for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace view public.poll_map_responses_public
with (security_barrier = true)
as
select id, poll_id, lat, lon, description, image_path, created_at
  from public.poll_map_responses;

revoke all on public.poll_map_responses_public from public;
grant select on public.poll_map_responses_public to anon, authenticated;

-- The original three-argument creator was already staff-only, but removing it
-- leaves one unambiguous write surface and ensures every new poll records its
-- mode and configuration.
drop function if exists public.create_poll(text, text, text[]);

create function public.create_poll(
  p_question text,
  p_description text,
  p_options text[],
  p_kind text,
  p_allow_pin_description boolean,
  p_allow_pin_image boolean,
  p_max_pins_per_member integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  verdict text;
  option_count integer := coalesce(cardinality(p_options), 0);
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  p_question := trim(coalesce(p_question, ''));
  p_description := trim(coalesce(p_description, ''));
  p_kind := lower(trim(coalesce(p_kind, '')));

  if char_length(p_question) not between 5 and 200
     or char_length(p_description) > 2000
     or p_kind not in ('choice', 'map')
     or p_max_pins_per_member not between 1 and 10 then
    raise exception 'invalid poll' using errcode = '22023';
  end if;

  if p_kind = 'choice' then
    if option_count not between 2 and 10
       or exists (
         select 1 from unnest(p_options) option_label
          where char_length(trim(coalesce(option_label, ''))) not between 1 and 120
       )
       or (
         select count(*) from (
           select lower(trim(option_label)) from unnest(p_options) option_label
           group by lower(trim(option_label))
         ) distinct_options
       ) <> option_count then
      raise exception 'invalid poll' using errcode = '22023';
    end if;
    p_allow_pin_description := false;
    p_allow_pin_image := false;
    p_max_pins_per_member := 1;
  elsif option_count <> 0 then
    raise exception 'map polls cannot have choices' using errcode = '22023';
  end if;

  select score.verdict into verdict
    from public.moderation_score(
      concat_ws(' ', p_question, p_description, array_to_string(p_options, ' '))
    ) score;
  if verdict = 'block' then
    raise exception 'moderation_blocked' using errcode = '42501';
  end if;

  insert into public.polls (
    author_id,
    question,
    description,
    kind,
    allow_pin_description,
    allow_pin_image,
    max_pins_per_member
  )
  values (
    auth.uid(),
    p_question,
    p_description,
    p_kind,
    coalesce(p_allow_pin_description, false),
    coalesce(p_allow_pin_image, false),
    p_max_pins_per_member
  )
  returning id into created_id;

  if p_kind = 'choice' then
    insert into public.poll_options (poll_id, label, position)
    select created_id, trim(option_label), (ordinality - 1)::smallint
      from unnest(p_options) with ordinality as option_rows(option_label, ordinality);
  end if;

  return created_id;
end;
$$;

revoke all on function public.create_poll(text, text, text[], text, boolean, boolean, integer)
  from public, anon;
grant execute on function public.create_poll(text, text, text[], text, boolean, boolean, integer)
  to authenticated;

create or replace function public.submit_poll_map_response(
  p_poll_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_description text,
  p_image_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.polls%rowtype;
  existing_count integer;
  response_id uuid;
  verdict text;
begin
  if not public.viewer_is_member() then
    raise exception 'membership required' using errcode = '42501';
  end if;

  select * into target from public.polls where id = p_poll_id;
  if not found or target.kind <> 'map' then
    raise exception 'invalid map poll' using errcode = '22023';
  end if;

  p_description := trim(coalesce(p_description, ''));
  p_image_path := nullif(trim(coalesce(p_image_path, '')), '');

  if p_lat not between 45.4495 and 45.5095
     or p_lon not between -73.665 and -73.598
     or char_length(p_description) > 1000
     or (not target.allow_pin_description and p_description <> '')
     or (not target.allow_pin_image and p_image_path is not null)
     or (
       p_image_path is not null
       and p_image_path not like auth.uid()::text || '/%'
     ) then
    raise exception 'invalid map response' using errcode = '22023';
  end if;

  select count(*) into existing_count
    from public.poll_map_responses
   where poll_id = p_poll_id and user_id = auth.uid();
  if existing_count >= target.max_pins_per_member then
    raise exception 'poll_pin_limit' using errcode = '23514';
  end if;

  if p_description <> '' then
    select score.verdict into verdict from public.moderation_score(p_description) score;
    if verdict = 'block' then
      raise exception 'moderation_blocked' using errcode = '42501';
    end if;
  end if;

  insert into public.poll_map_responses (
    poll_id, user_id, lat, lon, description, image_path
  )
  values (
    p_poll_id, auth.uid(), p_lat, p_lon, p_description, p_image_path
  )
  returning id into response_id;

  return response_id;
end;
$$;

revoke all on function public.submit_poll_map_response(uuid, double precision, double precision, text, text)
  from public, anon;
grant execute on function public.submit_poll_map_response(uuid, double precision, double precision, text, text)
  to authenticated;

create or replace function public.sync_poll_map_response_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.polls
       set map_response_count = map_response_count + 1
     where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update public.polls
       set map_response_count = greatest(map_response_count - 1, 0)
     where id = old.poll_id;
  end if;
  return null;
end;
$$;

drop trigger if exists poll_map_responses_sync_count on public.poll_map_responses;
create trigger poll_map_responses_sync_count
  after insert or delete on public.poll_map_responses
  for each row execute function public.sync_poll_map_response_count();

-- Public, WebP-normalised attachments for map points. Folder one is the uid,
-- so the storage policy and the function above independently bind an upload to
-- the member submitting it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poll-pin-images', 'poll-pin-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Poll pin images are publicly readable" on storage.objects;
create policy "Poll pin images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'poll-pin-images');

drop policy if exists "Members can upload their own poll pin images" on storage.objects;
create policy "Members can upload their own poll pin images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'poll-pin-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.viewer_is_member()
  );

drop policy if exists "Members can delete their own poll pin images" on storage.objects;
create policy "Members can delete their own poll pin images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'poll-pin-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.viewer_is_member()
  );
