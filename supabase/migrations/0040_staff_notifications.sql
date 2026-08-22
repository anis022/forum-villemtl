create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'citizen_topic' check (kind in ('citizen_topic')),
  issue_id uuid not null references public.issues (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, issue_id, kind)
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Recipients read their own notifications" on public.notifications;
create policy "Recipients read their own notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Recipients mark their own notifications read" on public.notifications;
create policy "Recipients mark their own notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.staff_profile_ids()
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
    from public.staff s
    join auth.users u on lower(trim(coalesce(u.email, ''))) = s.email
    join public.profiles p on p.id = u.id
   where s.active
     and u.email_confirmed_at is not null
$$;

revoke all on function public.staff_profile_ids() from public, anon, authenticated;

create or replace function public.notify_staff_of_topic()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  author_role text;
begin
  select p.role into author_role
    from public.profiles p where p.id = new.author_id;

  if coalesce(author_role, 'citizen') <> 'citizen' then
    return null;
  end if;

  insert into public.notifications (recipient_id, kind, issue_id, actor_id)
  select staff.id, 'citizen_topic', new.id, new.author_id
    from public.staff_profile_ids() as staff(id)
   where staff.id <> new.author_id
  on conflict (recipient_id, issue_id, kind) do nothing;

  return null;
end;
$$;

drop trigger if exists issues_notify_staff on public.issues;
create trigger issues_notify_staff
  after insert on public.issues
  for each row execute function public.notify_staff_of_topic();

create or replace function public.unread_notification_count()
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::integer
    from public.notifications n
   where n.recipient_id = (select auth.uid())
     and n.read_at is null
$$;

grant execute on function public.unread_notification_count() to authenticated;

create or replace function public.mark_notifications_read()
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  touched integer;
begin
  update public.notifications
     set read_at = now()
   where recipient_id = (select auth.uid())
     and read_at is null;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

grant execute on function public.mark_notifications_read() to authenticated;

create table if not exists public.notification_emails (
  issue_id uuid primary key references public.issues (id) on delete cascade,
  sent_at timestamptz not null default now(),
  recipient_count integer not null default 0
);

alter table public.notification_emails enable row level security;

drop function if exists public.claim_topic_notification(uuid);

create function public.claim_topic_notification(p_issue_id uuid)
returns table (email text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  claimed integer;
begin
  insert into public.notification_emails (issue_id, recipient_count)
  select p_issue_id, count(*) from public.staff s where s.active
  on conflict (issue_id) do nothing;

  get diagnostics claimed = row_count;
  if claimed = 0 then
    return;
  end if;

  return query
  select s.email
    from public.staff s
   where s.active
   order by s.email;
end;
$$;

revoke all on function public.claim_topic_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_topic_notification(uuid) to service_role;

create or replace function public.release_topic_notification(p_issue_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.notification_emails where issue_id = p_issue_id;
$$;

revoke all on function public.release_topic_notification(uuid) from public, anon, authenticated;
grant execute on function public.release_topic_notification(uuid) to service_role;
