-- Officials are identified by a *verified* @montreal.ca address, plus photo
-- attachments on issues.

-- 1. Deriving the official role ---------------------------------------------

-- Domain check. Anchored on '@montreal.ca' so 'x@montreal.ca.evil.com' and
-- 'x@notmontreal.ca' both fail.
create or replace function public.is_official_email(email text)
returns boolean language sql immutable as $$
  select lower(coalesce(email, '')) like '%@montreal.ca'
$$;

-- Role is recomputed from auth.users on every insert/update. It is never
-- accepted from the client, and an unverified address does not count: without
-- the confirmation check anyone could sign up as someone@montreal.ca and
-- start posting official answers without ever proving they own the address.
create or replace function public.sync_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  official boolean;
begin
  official := new.email_confirmed_at is not null
              and public.is_official_email(new.email);

  update public.profiles
     set role = case when official then 'official' else 'citizen' end
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_role_sync on auth.users;
create trigger on_auth_user_role_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_profile_role();

-- The profile row is created by on_auth_user_created; set the role there too
-- so a confirmed official is correct from the very first insert.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    case
      when new.email_confirmed_at is not null and public.is_official_email(new.email)
        then 'official'
      else 'citizen'
    end
  );
  return new;
end;
$$;

-- Backfill anyone who already exists.
update public.profiles p
   set role = case
     when u.email_confirmed_at is not null and public.is_official_email(u.email)
       then 'official' else 'citizen' end
  from auth.users u
 where u.id = p.id;

-- Helper used by RLS policies below.
create or replace function public.is_official(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role = 'official')
$$;

-- 2. Close the official-comment forgery hole --------------------------------

-- The previous policy only checked author_id, so a citizen could POST straight
-- to the REST API with is_official = true and forge an official answer.
drop policy if exists "Authenticated users can comment" on public.comments;
create policy "Authenticated users can comment"
  on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and is_official = public.is_official((select auth.uid()))
  );

-- 3. Officials can change issue status --------------------------------------

-- A SECURITY DEFINER entry point rather than a broad UPDATE policy, so
-- officials can move status without being able to rewrite anyone's text.
create or replace function public.set_issue_status(p_issue_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_official(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('open', 'answered', 'resolved') then
    raise exception 'invalid status';
  end if;

  update public.issues set status = p_status where id = p_issue_id;
end;
$$;

revoke all on function public.set_issue_status(uuid, text) from public, anon;
grant execute on function public.set_issue_status(uuid, text) to authenticated;

-- 4. Photo attachments ------------------------------------------------------

alter table public.issues add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-images', 'issue-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Issue images are publicly readable" on storage.objects;
create policy "Issue images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'issue-images');

-- Uploads are confined to a folder named after the uploader's uid, so nobody
-- can overwrite someone else's attachment.
drop policy if exists "Users can upload their own issue images" on storage.objects;
create policy "Users can upload their own issue images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'issue-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
