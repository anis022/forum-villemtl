-- Administrators can add a member by hand.
--
-- The roster is the party's CSV export, loaded by `npm run members`, and a
-- person who joined this week is not in it until somebody runs the next load.
-- The moderation screen can now put an address on the roster directly.
--
-- A hand-added row is marked `manual` so the export load leaves it alone: the
-- loader deletes every address the export no longer lists, and without the
-- marker it would remove the person an administrator just let in. The day the
-- export does list the address, the loader rewrites the row and clears the
-- marker, and from then on the export owns it like any other.
--
-- Only manual rows can be removed from the screen. A row that came from the
-- export is the party's record, and removing it here would last only until the
-- next load anyway.

alter table public.members
  add column if not exists manual boolean not null default false,
  add column if not exists added_by uuid references public.profiles (id) on delete set null;

comment on column public.members.manual is
  'Added from the moderation screen rather than the membership export; the export load keeps it.';

-- 1. The list -------------------------------------------------------------------

create or replace function public.list_manual_members()
returns table (
  email text,
  first_name text,
  last_name text,
  has_account boolean,
  added_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select m.email,
         m.first_name,
         m.last_name,
         u.id is not null,
         m.synced_at
    from public.members m
    left join auth.users u on lower(trim(coalesce(u.email, ''))) = m.email
   where m.manual
   order by m.synced_at desc;
end;
$$;

revoke all on function public.list_manual_members() from public, anon;
grant execute on function public.list_manual_members() to authenticated;

-- 2. Adding ---------------------------------------------------------------------

create or replace function public.add_manual_member(
  p_email text,
  p_first_name text,
  p_last_name text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if length(normalized) > 320
     or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  if exists (select 1 from public.members m where m.email = normalized and not m.manual and not m.seeded) then
    raise exception 'already member' using errcode = '23505';
  end if;

  insert into public.members (email, first_name, last_name, manual, added_by, synced_at)
  values (
    normalized,
    left(trim(coalesce(p_first_name, '')), 120),
    left(trim(coalesce(p_last_name, '')), 120),
    true,
    auth.uid(),
    now()
  )
  on conflict (email) do update set
    first_name = excluded.first_name,
    last_name  = excluded.last_name,
    expires_on = null,
    manual     = true,
    seeded     = false,
    added_by   = excluded.added_by,
    synced_at  = excluded.synced_at;
end;
$$;

revoke all on function public.add_manual_member(text, text, text) from public, anon;
grant execute on function public.add_manual_member(text, text, text) to authenticated;

-- 3. Removing -------------------------------------------------------------------

create or replace function public.remove_manual_member(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
begin
  if not public.viewer_is_member() or not public.is_official(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  delete from public.members m where m.email = normalized and m.manual;

  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.remove_manual_member(text) from public, anon;
grant execute on function public.remove_manual_member(text) to authenticated;
