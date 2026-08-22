-- The office finds out that somebody posted.
--
-- Until now a resident could open a topic at two in the morning and nothing
-- anywhere would say so. The office learned about it by visiting the feed and
-- scrolling, which means a report only reached a person if a person happened to
-- look, and the one week nobody looks is the week it matters.
--
-- So a topic published by a resident now lands in two places: a row here, which
-- the notification centre reads, and an email, which the application sends
-- after the response has gone out (see `utils/notify/staff.ts`). Two channels
-- for one event, because the two fail differently: a mailbox rule can swallow
-- the mail and a person can be signed out for a month, and neither of those
-- should be the reason a resident is left waiting.
--
-- Only topics. A reply is a conversation already in progress, and mailing nine
-- people every time a thread moves is how a notification becomes something you
-- filter to a folder you never open.

-- 1. The rows the centre reads ------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- One value today. It is a column and not an assumption so that the next kind
  -- of notice is a new value here rather than a second table shaped like this
  -- one.
  kind text not null default 'citizen_topic' check (kind in ('citizen_topic')),
  -- Cascades. A topic that was withdrawn should leave the centre with it: a
  -- notice pointing at a deleted page is a dead end, and keeping it would mean
  -- the centre shows work that cannot be done.
  issue_id uuid not null references public.issues (id) on delete cascade,
  -- The person whose action caused this. Kept when they close their account:
  -- `set null` rather than a cascade, so one departure does not silently empty
  -- the office's history of what it was told.
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- One notice per person per topic. This is what makes the fan-out safe to run
  -- twice.
  unique (recipient_id, issue_id, kind)
);

-- The centre's only query: this person's notices, newest first. The partial
-- index is the badge's query, how many are unread, which runs on every page
-- render for every member of staff and must never touch a read row.
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- Yours and nobody else's. There is no policy for INSERT on purpose: rows here
-- are written by the trigger below, running as definer, and a notice a browser
-- could forge is a notice the office cannot trust.
drop policy if exists "Recipients read their own notifications" on public.notifications;
create policy "Recipients read their own notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);

-- Marking one read is the only thing a browser may change. The policy settles
-- whose rows, and the column grant below settles which column: a WITH CHECK
-- can only see the row it is handed, so on its own it would happily let a
-- recipient repoint their own notice at a different topic. Nothing terrible
-- comes of that, but a permission that is wider than its one purpose is a
-- permission somebody eventually finds a use for.
drop policy if exists "Recipients mark their own notifications read" on public.notifications;
create policy "Recipients mark their own notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 2. Who is on duty ------------------------------------------------------------

-- The office, as accounts. `public.staff` is the roster of addresses; this is
-- the subset of it that has a confirmed account, which is the only kind of
-- person who can be handed a row in a table keyed by profile id.
--
-- Definer, because `public.staff` has no readable policies at all and this has
-- to work when the caller is the resident who just posted.
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

-- Not callable from a browser. Nothing here needs it and the shape of the
-- office is not a resident's business.
revoke all on function public.staff_profile_ids() from public, anon, authenticated;

-- 3. The fan-out ----------------------------------------------------------------

create or replace function public.notify_staff_of_topic()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  author_role text;
begin
  select p.role into author_role
    from public.profiles p where p.id = new.author_id;

  -- The office posting is not news to the office. This is also what keeps an
  -- official's own announcement from filling nine notification centres.
  if coalesce(author_role, 'citizen') <> 'citizen' then
    return null;
  end if;

  -- Aliased. A `setof uuid` arrives as a column named after the function, so
  -- an unaliased `id` here resolves to nothing and the statement fails at run
  -- time rather than at creation.
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

-- 4. Reading them ---------------------------------------------------------------

-- The badge. A plain count through the policy above would do, but it is asked
-- for on every page render, and going through PostgREST to count rows the
-- server already knows the owner of costs a round trip that this does not.
create or replace function public.unread_notification_count()
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::integer
    from public.notifications n
   where n.recipient_id = (select auth.uid())
     and n.read_at is null
$$;

grant execute on function public.unread_notification_count() to authenticated;

-- Opening the centre clears it. Invoker, so the UPDATE policy above is what
-- decides whose rows move. The function cannot be pointed at anyone else's.
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

-- 5. The mail --------------------------------------------------------------------

-- One row per topic that has been mailed out. It exists to answer a single
-- question (has this already gone?), because the send happens in the
-- application after the response is finished, and a retried request, a second
-- instance, or a redeploy mid-flight would otherwise mail the office twice for
-- one report.
create table if not exists public.notification_emails (
  issue_id uuid primary key references public.issues (id) on delete cascade,
  sent_at timestamptz not null default now(),
  -- How many addresses the send was handed. Not proof of delivery, since no
  -- mail system can promise that, but enough to tell "nobody was on the roster"
  -- apart from "the roster was fine and the provider refused".
  recipient_count integer not null default 0
);

alter table public.notification_emails enable row level security;
-- No policies. Only the service-role path below touches this.

-- Claim the topic and get the addresses in one statement.
--
-- The insert is the lock: whichever caller lands the row wins, and every other
-- caller gets nothing back and sends nothing. Splitting this into a read and a
-- later write would leave exactly the gap where two of them both see "not sent"
-- and both send.
--
-- Addresses come from `public.staff` rather than from the notification rows
-- above, and the two lists are deliberately not the same. A notice needs a
-- profile to belong to; an email needs only an address. Somebody on the roster
-- who has not signed in yet is still on the office's staff, and the mail is
-- often how they find out there is something to sign in for.
create or replace function public.claim_topic_notification(p_issue_id uuid)
returns table (email text, first_name text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  claimed boolean := false;
begin
  insert into public.notification_emails (issue_id, recipient_count)
  values (p_issue_id, 0)
  on conflict (issue_id) do nothing;

  get diagnostics claimed = row_count;
  if not claimed then
    return;
  end if;

  return query
  select s.email, s.first_name
    from public.staff s
   where s.active
   order by s.email;

  update public.notification_emails
     set recipient_count = (select count(*) from public.staff s where s.active)
   where notification_emails.issue_id = p_issue_id;
end;
$$;

-- The roster is the office's contact list, and handing it to a signed-in
-- resident would turn "who works here" into a scrape. Only the server-side
-- service role may call this.
revoke all on function public.claim_topic_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_topic_notification(uuid) to service_role;

-- Releasing a claim, for the one case that matters: the mail provider refused
-- the whole batch, so nothing was sent and the next attempt should be allowed
-- to try again rather than believing the office was told.
create or replace function public.release_topic_notification(p_issue_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.notification_emails where issue_id = p_issue_id;
$$;

revoke all on function public.release_topic_notification(uuid) from public, anon, authenticated;
grant execute on function public.release_topic_notification(uuid) to service_role;
