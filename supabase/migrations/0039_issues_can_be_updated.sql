-- Nobody could edit a topic, and nothing said so.
--
-- `public.issues` carried policies for select, insert and delete, and none for
-- update. Migration 0011 added `edited_at` and `edited_by`, wrote a policy
-- letting officials update any row, and opened with the line "the existing
-- policy already lets an author update their own row" — which was not true of
-- this database, and 0011's own official policy is not on it either. The
-- columns landed; the policies did not.
--
-- With RLS on and no update policy, an update is not refused: it matches zero
-- rows and reports success. So the edit button added in the previous commit
-- saved nothing, said "saved", and returned to a page showing the old words —
-- and the automatic translation of an official post failed the same way, which
-- is how this was found at all.
--
-- Both powers, kept apart the way 0011 meant them to be.

-- 1. An author correcting their own words --------------------------------------
--
-- `viewer_is_member()` for the same reason it guards posting since 0031: a
-- session whose membership has lapsed may keep reading, and may not keep
-- changing what the forum holds.
--
-- The `with check` repeats the `using` clause rather than trusting it. `using`
-- decides which rows may be touched; `with check` decides what they may become.
-- Without it an author could set `author_id` to somebody else and hand their
-- post away, which the row-level test would happily allow because it only ever
-- looked at the row as it was.

drop policy if exists "Authors can update their own issues" on public.issues;
create policy "Authors can update their own issues"
  on public.issues for update to authenticated
  using ((select auth.uid()) = author_id and public.viewer_is_member())
  with check ((select auth.uid()) = author_id and public.viewer_is_member());

-- 2. The office reaching any row -----------------------------------------------
-- Restored verbatim from 0011, whose reasoning still holds: an official
-- altering a resident's words is a real power over somebody's speech on a
-- public forum, so the row records who touched it and when, and the page says
-- so. An edit nobody can see is indistinguishable from censorship.

drop policy if exists "Officials can update any issue" on public.issues;
create policy "Officials can update any issue"
  on public.issues for update to authenticated
  using (public.is_official((select auth.uid())))
  with check (public.is_official((select auth.uid())));
