-- Let a photograph be removed, which it never actually could be.
--
-- Migration 0012 added two delete policies to `issue-images`, and 0031
-- rewrote all three of that bucket's rules to require a current membership.
-- Neither reached this database: the only policies it carries for the bucket
-- are the public read and the upload from 0003, so `storage.objects` has had
-- no DELETE policy for photographs since the day the bucket was made.
--
-- Nothing said so. A delete that no policy matches removes no rows and returns
-- no error, so every photograph ever replaced is still sitting in a public
-- bucket at a URL that still resolves — which is the opposite of what pressing
-- "Retirer" promises. `discardMedia` in app/actions/issues.ts now checks the
-- empty result rather than the error alone, and this is what makes it pass.
--
-- The statements are the ones 0031 already wrote, unchanged. Re-stating them
-- here rather than asking anyone to re-run 0031 keeps the ledger honest about
-- what this database actually had.

-- Membership on the upload as well. 0031 decided this and `issue-videos` has
-- enforced it since 0041; the photograph half was simply never applied.
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

-- Officials reach any attachment, for the reason they reach any report.
drop policy if exists "Officials can delete any issue image" on storage.objects;
create policy "Officials can delete any issue image"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and public.is_official((select auth.uid()))
    and public.viewer_is_member()
  );
