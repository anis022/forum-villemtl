-- Let people correct their own reports, and let elected officials intervene.
--
-- Two different powers, deliberately kept apart:
--
--   * An author fixing a typo or adding detail to their own report. Ordinary,
--     expected, needs no explanation.
--
--   * An elected official altering or withdrawing someone else's report. That
--     is a real power over a resident's words on a public forum, so it leaves
--     a trace: the row records who touched it and when, and the page says so.
--     An edit nobody can see is indistinguishable from censorship.

alter table public.issues
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references public.profiles (id) on delete set null;

comment on column public.issues.edited_by is
  'Who last edited. Compare against author_id: when they differ, someone other than the author changed a resident''s words, and the page must say so.';

-- 1. Editing ----------------------------------------------------------------
-- The existing policy already lets an author update their own row. This adds
-- the official's reach over any row.

drop policy if exists "Officials can update any issue" on public.issues;
create policy "Officials can update any issue"
  on public.issues for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'official'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'official'
    )
  );

-- 2. Withdrawing ------------------------------------------------------------
-- Authors may withdraw what they wrote; officials may withdraw anything.
-- Comments and votes cascade, which is what "withdrawn" should mean — leaving
-- orphaned replies under a deleted report would be worse than removing them.

drop policy if exists "Authors can delete their own issues" on public.issues;
create policy "Authors can delete their own issues"
  on public.issues for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Officials can delete any issue" on public.issues;
create policy "Officials can delete any issue"
  on public.issues for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'official'
    )
  );
