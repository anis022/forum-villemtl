-- Administrators manage administrator access from the moderation screen.
--
-- `public.staff` already is the authorization list and `role = 'official'` is
-- the administrator role everywhere in the app. This migration makes entries
-- reversible instead of deleting them, exposes only a narrow officials-only
-- view of the list, and puts every mutation behind a SECURITY DEFINER function
-- that identifies the caller from auth.uid(). The table itself keeps RLS with
-- no browser-readable policies.

-- 1. Reversible access and a small audit trail --------------------------------

alter table public.staff
  add column if not exists active boolean not null default true,
  add column if not exists access_changed_at timestamptz not null default now(),
  add column if not exists access_changed_by uuid
    references public.profiles (id) on delete set null;

comment on column public.staff.active is
  'Whether this address currently receives the official administrator role.';
comment on column public.staff.access_changed_by is
  'Administrator who most recently granted or revoked this address.';

-- 2. Every existing role derivation now respects `active` ---------------------

create or replace function public.is_official_email(addr text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.staff s
     where s.email = lower(trim(coalesce(addr, '')))
       and s.active
  )
$$;

create or replace function public.sync_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  confirmed boolean := new.email_confirmed_at is not null;
  normalized text := lower(trim(coalesce(new.email, '')));
  on_staff boolean;
  is_elected boolean;
begin
  select s.active, s.elected into on_staff, is_elected
    from public.staff s
   where s.email = normalized;

  on_staff := confirmed and coalesce(on_staff, false);

  update public.profiles
     set role = case when on_staff then 'official' else 'citizen' end,
         elected = on_staff and coalesce(is_elected, false)
   where id = new.id;

  return new;
end;
$$;

-- The account-creation trigger from 0026, with one material change: an
-- inactive staff row may still provide a known spelling for a member's name,
-- but it does not grant the official role.
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

  select s.active, s.elected, nullif(s.first_name, ''), nullif(s.last_name, '')
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

-- 3. The officials-only list used by the moderation screen --------------------

create or replace function public.list_staff_access()
returns table (
  email text,
  first_name text,
  last_name text,
  elected boolean,
  active boolean,
  has_account boolean,
  confirmed boolean,
  is_self boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select s.email,
         s.first_name,
         s.last_name,
         s.elected,
         s.active,
         u.id is not null,
         u.email_confirmed_at is not null,
         s.email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    from public.staff s
    left join auth.users u on lower(trim(coalesce(u.email, ''))) = s.email
   order by s.active desc,
            lower(coalesce(s.first_name, '')),
            lower(coalesce(s.last_name, '')),
            s.email;
end;
$$;

revoke all on function public.list_staff_access() from public, anon;
grant execute on function public.list_staff_access() to authenticated;

-- 4. One safe switch for granting and revoking -------------------------------

create or replace function public.set_staff_access(p_email text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  caller_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if length(normalized) > 320
     or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  -- Keeping the caller active guarantees the screen can never remove its own
  -- last way back in. A second administrator can still revoke this address.
  if not p_active and normalized = caller_email then
    raise exception 'cannot revoke self' using errcode = '42501';
  end if;

  if p_active then
    insert into public.staff (
      email, active, elected, seeded, access_changed_at, access_changed_by
    )
    values (normalized, true, false, false, now(), auth.uid())
    on conflict (email) do update set
      active = true,
      seeded = false,
      access_changed_at = excluded.access_changed_at,
      access_changed_by = excluded.access_changed_by;
  else
    update public.staff
       set active = false,
           access_changed_at = now(),
           access_changed_by = auth.uid()
     where public.staff.email = normalized;

    if not found then
      raise exception 'access not found' using errcode = 'P0002';
    end if;
  end if;

  -- The auth trigger only runs when an auth row changes. Changing the staff
  -- list therefore recomputes the matching existing profile here; future
  -- accounts are covered by handle_new_user above.
  update public.profiles p
     set role = case
                  when p_active and u.email_confirmed_at is not null
                    then 'official'
                  else 'citizen'
                end,
         elected = p_active
                   and u.email_confirmed_at is not null
                   and coalesce(s.elected, false)
    from auth.users u
    left join public.staff s on s.email = lower(trim(coalesce(u.email, '')))
   where p.id = u.id
     and lower(trim(coalesce(u.email, ''))) = normalized;
end;
$$;

revoke all on function public.set_staff_access(text, boolean) from public, anon;
grant execute on function public.set_staff_access(text, boolean) to authenticated;
