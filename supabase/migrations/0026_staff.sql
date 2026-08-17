-- Who speaks for the borough office, and which of them were elected.
--
-- Two problems, one table.
--
-- The first is a hole migration 0025 left open. It gates the forum on the
-- membership roster, and lets @montreal.ca addresses through beside it so that
-- officials — who are not required to hold a party card — could still sign in.
-- But "@montreal.ca" is not four people, it is the entire City of Montréal:
-- every employee of every department, several thousand addresses, each of them
-- able to create an account and post answers marked as official. That was a
-- wildcard standing in for a list, and this is the list.
--
-- The second is that the list is not homogeneous. Four of the nine are elected
-- members of the borough council. The other five work for them and are here to
-- answer too — which they should, and which the site has no vocabulary for: the
-- checkmark beside a name reads "Élu·e de la Ville de Montréal", and putting it
-- next to a staffer's name is the site telling a lie about who holds office.
-- So the table records both facts, and the badge stops speaking for both.
--
-- What does *not* change: the five who were not elected keep every capability
-- an official has. They answer, their replies are marked as official answers,
-- they move a topic to "Répondu" and they see the moderation queue. That is the
-- job. The only thing reserved to the elected four is the claim to be one.

-- 1. The list ------------------------------------------------------------------

create table if not exists public.staff (
  email text primary key check (email = lower(email) and email <> ''),
  -- Filled in only where the spelling is known from a source. Left null, the
  -- account creation trigger falls back to the address's local part, which
  -- gets the letters right and the accents wrong — "Stephanie" rather than
  -- "Stéphanie". Correct one by writing it here; a name in this table wins.
  first_name text,
  last_name text,
  -- Holds a seat on the borough council. Everything else here is staff.
  elected boolean not null default false,
  -- Same marker as public.members: rows the demonstration seed planted, so it
  -- knows which ones to take back out.
  seeded boolean not null default false,
  added_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- No policies, as with public.members: this table decides who may post as the
-- borough office, and nothing reachable from a browser has any business reading
-- or writing it. It is maintained here, in migrations, on purpose — granting a
-- person the ability to publish official answers on a political forum should be
-- a reviewed change to the repository and not an edit to a file on somebody's
-- desktop.

insert into public.staff (email, first_name, last_name, elected) values
  -- The four who sit on the borough council. Names as spelled in
  -- utils/officials.ts, which is the file the /elus page and their portraits
  -- come from — the same person should not be "Stephanie" here and "Stéphanie"
  -- there.
  ('stephanie.valenzuela@montreal.ca', 'Stéphanie', 'Valenzuela', true),
  ('milany.thiagarajah@montreal.ca',   'Milany',    'Thiagarajah', true),
  ('alexandre.teodoresco@montreal.ca', 'Alexandre', 'Teodoresco',  true),
  ('sonny.moroz@montreal.ca',          'Sonny',     'Moroz',       true),
  -- The office. Names deliberately left null rather than guessed: an address
  -- says how a name is spelled in a mailbox, not how the person spells it, and
  -- inventing the apostrophe in a surname is worse than deriving a plain one.
  ('guillaume.pelletier@montreal.ca',          null, null, false),
  ('alexandra.damours@montreal.ca',            null, null, false),
  ('alexandre.degardin-sagnier@montreal.ca',   null, null, false),
  ('zakaria.sabek@montreal.ca',                null, null, false),
  ('anis.benabdallah@montreal.ca',             null, null, false)
on conflict (email) do update set
  first_name = excluded.first_name,
  last_name  = excluded.last_name,
  elected    = excluded.elected,
  seeded     = false;

-- 2. The domain check becomes a list lookup ------------------------------------

-- Same name, same meaning to every caller — "this address may act for the
-- borough office" — and a different answer for the thousands of city addresses
-- that are not on the list.
--
-- No longer `immutable`: it reads a table now, so it is `stable`, and
-- `security definer` so that the RLS on public.staff does not make it answer
-- "no" to everyone.
--
-- The parameter is `addr`, not `email`, and the rename is why this is a drop
-- rather than a replace — Postgres will not rename an input parameter in place.
-- It matters more than a rename usually does: in a SQL-language function an
-- unqualified name that matches a column of a table in scope resolves to the
-- column, silently. `where s.email = lower(trim(coalesce(email, '')))` is
-- therefore `s.email = s.email`, which is true of every row, which made this
-- function answer "yes, official" for every address on earth and opened the
-- whole gate. It failed as wide open as a check can fail, and it did it without
-- an error. Nothing in the parameter list may share a name with a column of
-- public.staff.
drop function if exists public.is_official_email(text);

create function public.is_official_email(addr text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s where s.email = lower(trim(coalesce(addr, '')))
  )
$$;

grant execute on function public.is_official_email(text) to anon, authenticated;

-- 3. Elected, on the profile ---------------------------------------------------

-- Derived from the table above on every insert and every email change, exactly
-- like `role`, and never accepted from the client for the same reason: the
-- claim to hold elected office is the one thing on this site that nobody may
-- assert about themselves.
alter table public.profiles
  add column if not exists elected boolean not null default false;

create or replace function public.sync_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  confirmed boolean := new.email_confirmed_at is not null;
  normalized text := lower(trim(coalesce(new.email, '')));
  on_staff boolean;
  is_elected boolean;
begin
  -- An unverified address still does not count. Without the confirmation check
  -- anyone could sign up as someone@montreal.ca and start posting official
  -- answers without ever proving they own the address — and now that the list
  -- is nine named people, borrowing one of their addresses is a shorter path
  -- than it was.
  select true, s.elected into on_staff, is_elected
  from public.staff s where s.email = normalized;

  on_staff := confirmed and coalesce(on_staff, false);

  update public.profiles
     set role = case when on_staff then 'official' else 'citizen' end,
         elected = on_staff and coalesce(is_elected, false)
   where id = new.id;

  return new;
end;
$$;

-- 4. A name for the five, and the elected flag from the first insert -----------

-- Same shape as the version in 0025, with the staff list added as a source of
-- names between the membership roster and the client's own metadata, and the
-- role and the elected flag set here so an official is correct from the very
-- first row rather than a moment later when the sync trigger catches up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(trim(coalesce(new.email, '')));
  status text := public.membership_status(normalized);
  confirmed boolean := new.email_confirmed_at is not null;
  on_staff boolean;
  is_elected boolean;
  given text;
  family text;
  -- Kept apart from `given`/`family` rather than coalesced into them in the
  -- query below: a SELECT INTO that matches nothing sets *every* target to
  -- null, so reading and writing the same variable in one statement would wipe
  -- the roster's name for every member who is not also on the staff list.
  staff_first text;
  staff_last text;
  parts text[];
begin
  if status <> 'ok' then
    raise exception 'address % is not an active membership (%)', normalized, status
      using errcode = '42501';
  end if;

  select nullif(m.first_name, ''), nullif(m.last_name, '') into given, family
  from public.members m where m.email = normalized;

  select true, s.elected, nullif(s.first_name, ''), nullif(s.last_name, '')
    into on_staff, is_elected, staff_first, staff_last
  from public.staff s where s.email = normalized;

  given := coalesce(given, staff_first, nullif(new.raw_user_meta_data ->> 'first_name', ''));
  family := coalesce(family, staff_last, nullif(new.raw_user_meta_data ->> 'last_name', ''));

  if given is null and family is null then
    parts := string_to_array(split_part(normalized, '@', 1), '.');
    given := initcap(coalesce(parts[1], ''));
    family := initcap(coalesce(array_to_string(parts[2:], ' '), ''));
  end if;

  on_staff := confirmed and coalesce(on_staff, false);

  insert into public.profiles (id, first_name, last_name, role, elected)
  values (
    new.id,
    coalesce(given, ''),
    coalesce(family, ''),
    case when on_staff then 'official' else 'citizen' end,
    on_staff and coalesce(is_elected, false)
  );

  return new;
end;
$$;

-- 5. Everyone who already exists -----------------------------------------------

-- Both columns, recomputed together. Anyone whose @montreal.ca address is not
-- on the list loses the official role here — which is the point of the
-- migration, and is why it is spelled out rather than left to the next time
-- they happen to change their email address.
update public.profiles p
   set role = case when o.on_staff then 'official' else 'citizen' end,
       elected = o.on_staff and o.is_elected
  from (
    select u.id,
           u.email_confirmed_at is not null and s.email is not null as on_staff,
           coalesce(s.elected, false) as is_elected
      from auth.users u
      left join public.staff s on s.email = lower(trim(coalesce(u.email, '')))
  ) o
 where o.id = p.id;
