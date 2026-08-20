-- Projects move out of the repository, and every change to one is reviewed.
--
-- Until now `utils/projects.ts` held them: a TypeScript file, one project in it,
-- edited by whoever could open a pull request. That file's own header explains
-- why it was built that way, and the reason was good — montreal.ca rebuilds and
-- retires project pages on its own schedule, so a scraper that silently returns
-- nothing is worse than a file a person maintains after reading the minutes.
--
-- What that arrangement cannot do is let the borough office maintain its own
-- page. The nine people on `public.staff` are the ones who know that the chalet
-- contract was awarded; none of them should need a deploy to say so. So the
-- data moves here, and the thing the repository was providing — that nobody
-- publishes without a second person seeing it — moves here with it, as a
-- waitlist rather than as a code review.
--
-- Two tables, and the split is the whole design:
--
--   projects            what residents see. One row per project, live.
--   project_revisions   what somebody proposes. Pending until approved.
--
-- A revision that creates and a revision that edits are the same row shape,
-- which is what keeps the published version visible while an edit waits: the
-- proposal sits beside the project rather than inside it. A separate `pending`
-- state on `projects` could not do that without taking the page down.
--
-- Content is JSONB and not eleven normalised tables. The shape is the `Project`
-- type in utils/projects.ts — nested, bilingual, and arrays all the way down
-- (description paragraphs, photos with credits, milestones with optional labels
-- and sources). Normalising it would buy referential integrity over data that is
-- only ever read and written whole, and cost a join per paragraph. The columns
-- lifted out beside it are the ones something actually queries on.

-- 1. The live table ----------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  -- The URL. Stable once published: /projets/theatre-empress is a link people
  -- send each other, so a rename is a redirect problem and not a rename.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- The whole `Project`, minus the columns beside it. Validated on the way in
  -- by `project_content_complete` below, never by the client.
  content jsonb not null,

  -- Lifted out because the list page filters and orders on them.
  status text not null check (status in ('study', 'decided', 'underway', 'done')),

  -- False while a first revision is still being finished. A project that has
  -- never been approved has a row here only so that revisions can reference it.
  published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Who last had a change of theirs approved. Null for the seeded row, which
  -- came from the repository and not from a person using the site.
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists projects_published_idx
  on public.projects (published, status);

-- 2. The waitlist ------------------------------------------------------------

create table if not exists public.project_revisions (
  id uuid primary key default gen_random_uuid(),

  -- Null proposes a new project; set proposes an edit to that one. The two are
  -- otherwise identical, which is why approval is one function and not two.
  project_id uuid references public.projects (id) on delete cascade,

  -- Carried on the revision rather than read from the project, because a new
  -- project has no row to read it from yet, and because a reviewer should see
  -- the URL a proposal is claiming before it claims it.
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  content jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  -- 'cron' proposals wait. 'staff' proposals are approved by the same action
  -- that creates them — a person who may approve did not need to ask themselves
  -- for permission — and they are still written here, so the history of a
  -- project is every change to it and not only the automatic ones.
  origin text not null check (origin in ('cron', 'staff')),

  -- What the cron saw. A reviewer approving a machine's proposal needs the
  -- thing it read, not a summary of it.
  resolution_number text,
  source_note text,

  created_at timestamptz not null default now(),
  -- Null for cron rows: nobody authored them.
  created_by uuid references auth.users (id) on delete set null,

  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  review_note text
);

create index if not exists project_revisions_pending_idx
  on public.project_revisions (status, created_at desc);
create index if not exists project_revisions_project_idx
  on public.project_revisions (project_id, created_at desc);

-- One pending proposal per project at a time. Two people editing the same page
-- into two competing revisions is a merge nobody asked for; the second is told
-- to wait rather than silently queued behind the first. Partial, so approved and
-- rejected rows accumulate freely as the history they are.
create unique index if not exists project_revisions_one_pending_idx
  on public.project_revisions (coalesce(project_id::text, slug))
  where status = 'pending';

-- 3. The bar -----------------------------------------------------------------
--
-- utils/projects.ts set three requirements and enforced them with TypeScript:
-- prose in both languages, at least one photograph of the actual place, at
-- least two milestones. Its header is blunt about why — "a project with a
-- paragraph and no picture is a press release; a project with pictures and no
-- dates is an advertisement" — and that bar is why the file held one project
-- rather than six.
--
-- A type cannot enforce anything about a row a cron wrote. So the rule moves
-- into the database, and it is checked at approval rather than at insert: a
-- cron proposal is *expected* to arrive incomplete, with a title and the one
-- milestone the resolution gave it. It sits in the waitlist until a person adds
-- the photograph and the second date. The waitlist is now the thing that keeps
-- the bar, which is exactly the job code review was doing before.

create or replace function public.project_content_complete(content jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select
    -- Both languages, everywhere prose appears.
    coalesce(content #>> '{title,fr}', '') <> ''
    and coalesce(content #>> '{title,en}', '') <> ''
    and coalesce(content #>> '{summary,fr}', '') <> ''
    and coalesce(content #>> '{summary,en}', '') <> ''
    and coalesce(content ->> 'address', '') <> ''
    -- At least one paragraph, and every paragraph in both languages.
    and jsonb_array_length(coalesce(content -> 'description', '[]'::jsonb)) >= 1
    and not exists (
      select 1 from jsonb_array_elements(content -> 'description') d
       where coalesce(d ->> 'fr', '') = '' or coalesce(d ->> 'en', '') = ''
    )
    -- A photograph of the place, with the credit its licence requires.
    and jsonb_array_length(coalesce(content -> 'photos', '[]'::jsonb)) >= 1
    and not exists (
      select 1 from jsonb_array_elements(content -> 'photos') p
       where coalesce(p ->> 'src', '') = '' or coalesce(p ->> 'credit', '') = ''
    )
    -- Two dates, so it reads as a history rather than as an update.
    and jsonb_array_length(coalesce(content -> 'milestones', '[]'::jsonb)) >= 2
    and not exists (
      select 1 from jsonb_array_elements(content -> 'milestones') m
       where coalesce(m ->> 'on', '') = ''
          or coalesce(m #>> '{title,fr}', '') = ''
          or coalesce(m #>> '{title,en}', '') = ''
    );
$$;

-- 4. Row level security ------------------------------------------------------

alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;

-- Residents read published projects and nothing else. An unpublished row is a
-- draft somebody is still writing, and a draft of a municipal project is a
-- rumour.
drop policy if exists "Published projects are public" on public.projects;
create policy "Published projects are public"
  on public.projects for select using (published);

drop policy if exists "Officials see every project" on public.projects;
create policy "Officials see every project"
  on public.projects for select to authenticated
  using (public.is_official((select auth.uid())));

-- No insert, update or delete policy on public.projects at all, for anybody.
-- The live table is written only by `approve_project_revision` below, which is
-- security definer. That is what makes the waitlist a rule rather than a
-- convention: there is no path from a browser to this table that skips review,
-- because there is no policy that would let one through.

drop policy if exists "Officials see the waitlist" on public.project_revisions;
create policy "Officials see the waitlist"
  on public.project_revisions for select to authenticated
  using (public.is_official((select auth.uid())));

drop policy if exists "Officials propose changes" on public.project_revisions;
create policy "Officials propose changes"
  on public.project_revisions for insert to authenticated
  with check (
    public.is_official((select auth.uid()))
    and origin = 'staff'
    and created_by = (select auth.uid())
    and status = 'pending'
  );

-- An author may keep working on a proposal that has not been decided yet.
-- Deciding it is `approve` / `reject`, which are functions, so `status` is
-- pinned on both sides here: this policy edits content, never verdicts.
drop policy if exists "Officials edit pending proposals" on public.project_revisions;
create policy "Officials edit pending proposals"
  on public.project_revisions for update to authenticated
  using (public.is_official((select auth.uid())) and status = 'pending')
  with check (public.is_official((select auth.uid())) and status = 'pending');

-- 5. Approval ----------------------------------------------------------------

create or replace function public.approve_project_revision(
  revision_id uuid,
  note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  rev public.project_revisions;
  target uuid;
  actor uuid := auth.uid();
begin
  if not public.is_official(actor) then
    raise exception 'not authorised';
  end if;

  select * into rev from public.project_revisions r
   where r.id = revision_id and r.status = 'pending'
   for update;

  if not found then
    raise exception 'no pending revision %', revision_id;
  end if;

  -- Checked here and not at insert: an incomplete proposal is the normal state
  -- of a cron row, and refusing it on arrival would throw away the one thing
  -- the machine is good at, which is noticing.
  if not public.project_content_complete(rev.content) then
    raise exception 'incomplete: a project needs prose in both languages, a photograph with its credit, and two dated milestones';
  end if;

  if rev.project_id is null then
    insert into public.projects (slug, content, status, published, updated_by)
    values (rev.slug, rev.content,
            coalesce(rev.content ->> 'status', 'study'), true, actor)
    returning id into target;
  else
    update public.projects
       set slug = rev.slug,
           content = rev.content,
           status = coalesce(rev.content ->> 'status', status),
           published = true,
           updated_at = now(),
           updated_by = actor
     where id = rev.project_id
     returning id into target;

    if target is null then
      raise exception 'project % no longer exists', rev.project_id;
    end if;
  end if;

  update public.project_revisions
     set status = 'approved', reviewed_at = now(), reviewed_by = actor,
         review_note = note, project_id = target
   where id = revision_id;

  return target;
end;
$$;

create or replace function public.reject_project_revision(
  revision_id uuid,
  note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_official(actor) then
    raise exception 'not authorised';
  end if;

  update public.project_revisions
     set status = 'rejected', reviewed_at = now(), reviewed_by = actor,
         review_note = note
   where id = revision_id and status = 'pending';

  if not found then
    raise exception 'no pending revision %', revision_id;
  end if;
end;
$$;

grant execute on function public.approve_project_revision(uuid, text) to authenticated;
grant execute on function public.reject_project_revision(uuid, text) to authenticated;
grant execute on function public.project_content_complete(jsonb) to authenticated;

-- 6. Photographs -------------------------------------------------------------
-- Same shape as `issue-images`: public to read, because a project photograph is
-- published, and writable only by the office.

insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', true)
on conflict (id) do nothing;

drop policy if exists "Project photos are public" on storage.objects;
create policy "Project photos are public"
  on storage.objects for select
  using (bucket_id = 'project-photos');

drop policy if exists "Officials upload project photos" on storage.objects;
create policy "Officials upload project photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-photos' and public.is_official((select auth.uid()))
  );

drop policy if exists "Officials replace project photos" on storage.objects;
create policy "Officials replace project photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-photos' and public.is_official((select auth.uid())));

drop policy if exists "Officials remove project photos" on storage.objects;
create policy "Officials remove project photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-photos' and public.is_official((select auth.uid())));

-- 7. The queue as the reviewer sees it ---------------------------------------
--
-- `complete` is computed here rather than in TypeScript so that the badge in
-- the queue and the check inside `approve_project_revision` are the same
-- function. Computed twice in two languages, they would eventually disagree,
-- and the way that failure shows up is a proposal that looks ready and then
-- refuses — which teaches reviewers to distrust the queue.
--
-- `security_invoker` so the view does not become a hole around the table's RLS:
-- it runs as whoever selects from it, so a resident reaching this gets the same
-- nothing the table would have given them.

create or replace view public.project_revisions_view
with (security_invoker = on) as
  select r.id,
         r.project_id,
         r.slug,
         r.content,
         r.status,
         r.origin,
         r.resolution_number,
         r.source_note,
         r.created_at,
         r.reviewed_at,
         r.review_note,
         public.project_content_complete(r.content) as complete
    from public.project_revisions r;

grant select on public.project_revisions_view to authenticated;
