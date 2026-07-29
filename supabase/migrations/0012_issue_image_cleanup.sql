-- Let a replaced photo actually go away.
--
-- The bucket had an insert policy and no delete policy, so every attachment
-- ever uploaded was permanent: swapping a photo would have left the old file
-- sitting in public storage, still reachable by URL long after the report
-- stopped pointing at it. For a resident who attached the wrong picture, that
-- is the opposite of removing it.
--
-- Uploads stay confined to the uploader's own uid folder, so an official who
-- replaces someone's photo files the new one under their own name — which is
-- accurate, they are the one who uploaded it.

drop policy if exists "Users can delete their own issue images" on storage.objects;
create policy "Users can delete their own issue images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Officials reach any attachment, for the same reason they reach any report.
drop policy if exists "Officials can delete any issue image" on storage.objects;
create policy "Officials can delete any issue image"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'official'
    )
  );
