-- Reading stays public; every action that changes the forum requires a current
-- Ensemble Montréal membership (with the existing named borough-office
-- exception built into viewer_is_member()). Migration 0025 already protected
-- new topics, replies and support. This closes the remaining write paths for a
-- session whose membership later lapses or is removed from the roster.

-- 1. Withdrawing forum content ----------------------------------------------

drop policy if exists "Authors can delete their own issues" on public.issues;
create policy "Authors can delete their own issues"
  on public.issues for delete to authenticated
  using (
    (select auth.uid()) = author_id
    and public.viewer_is_member()
  );

drop policy if exists "Officials can delete any issue" on public.issues;
create policy "Officials can delete any issue"
  on public.issues for delete to authenticated
  using (
    public.is_official((select auth.uid()))
    and public.viewer_is_member()
  );

drop policy if exists "Authors can delete their own comments" on public.comments;
create policy "Authors can delete their own comments"
  on public.comments for delete to authenticated
  using (
    (select auth.uid()) = author_id
    and public.viewer_is_member()
  );

drop policy if exists "Officials can remove comments" on public.comments;
create policy "Officials can remove comments"
  on public.comments for delete to authenticated
  using (
    public.is_official((select auth.uid()))
    and public.viewer_is_member()
  );

drop policy if exists "Users can retract their own vote" on public.votes;
create policy "Users can retract their own vote"
  on public.votes for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and public.viewer_is_member()
  );

-- 2. Office actions ----------------------------------------------------------

drop policy if exists "Officials can clear flags" on public.moderation_flags;
create policy "Officials can clear flags"
  on public.moderation_flags for update to authenticated
  using (
    public.is_official((select auth.uid()))
    and public.viewer_is_member()
  )
  with check (
    public.is_official((select auth.uid()))
    and public.viewer_is_member()
  );

-- This function owns its update and therefore bypasses table RLS. The member
-- check must live inside the function beside the official-role check.
create or replace function public.set_issue_status(p_issue_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target text;
begin
  if not public.viewer_is_member() then
    raise exception 'membership required';
  end if;

  if not public.is_official(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('open', 'answered', 'resolved') then
    raise exception 'invalid status';
  end if;

  target := case
    when p_status = 'open' then public.unresolved_status(p_issue_id)
    else p_status
  end;

  update public.issues set status = target where id = p_issue_id;
end;
$$;

-- 3. Attachments -------------------------------------------------------------

drop policy if exists "Users can upload their own issue images" on storage.objects;
create policy "Users can upload their own issue images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'issue-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.viewer_is_member()
  );

drop policy if exists "Users can delete their own issue images" on storage.objects;
create policy "Users can delete their own issue images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.viewer_is_member()
  );

drop policy if exists "Officials can delete any issue image" on storage.objects;
create policy "Officials can delete any issue image"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and public.is_official((select auth.uid()))
    and public.viewer_is_member()
  );
