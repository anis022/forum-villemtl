-- Let people correct or withdraw what they wrote, and let elected officials do
-- the same to anyone's comment as moderation.
--
-- The rules match the ones already governing reports (migration 0011): an edit
-- is recorded, and an edit made by someone other than the author is recorded as
-- such. An invisible edit by someone with authority is indistinguishable from
-- censorship, so the page has to be able to say who changed the words.

alter table public.comments
  add column if not exists edited_at timestamptz;

alter table public.comments
  add column if not exists edited_by uuid references public.profiles (id) on delete set null;

/*
 * Deliberately not `for all`: this is two different permissions that happen to
 * land on the same table. An author may fix their own words; an official may
 * moderate anybody's. Splitting them keeps each policy readable as the sentence
 * it is meant to be.
 *
 * `is_official` is not in either policy's `with check`, so an edit cannot
 * promote a citizen's comment into an official answer, or demote one. It is
 * frozen at write time and stays that way.
 */
drop policy if exists "Authors can edit their own comments" on public.comments;
create policy "Authors can edit their own comments"
  on public.comments for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "Officials can moderate comments" on public.comments;
create policy "Officials can moderate comments"
  on public.comments for update to authenticated
  using (public.is_official((select auth.uid())))
  with check (public.is_official((select auth.uid())));

drop policy if exists "Authors can delete their own comments" on public.comments;
create policy "Authors can delete their own comments"
  on public.comments for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Officials can remove comments" on public.comments;
create policy "Officials can remove comments"
  on public.comments for delete to authenticated
  using (public.is_official((select auth.uid())));

/*
 * An update must not be able to move a comment to another issue, re-parent it
 * into a different thread, or rewrite its own depth — none of which the forms
 * offer, and all of which the REST API would accept from a signed-in browser
 * that a policy alone cannot stop, since RLS checks rows and not columns.
 */
create or replace function public.freeze_comment_position()
returns trigger
language plpgsql
as $$
begin
  new.issue_id := old.issue_id;
  new.parent_id := old.parent_id;
  new.depth := old.depth;
  new.is_official := old.is_official;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists comments_freeze_position on public.comments;
create trigger comments_freeze_position
  before update on public.comments
  for each row execute function public.freeze_comment_position();
