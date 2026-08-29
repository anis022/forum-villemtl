-- A report can be a video, not only a photograph.
--
-- Some things a photograph cannot carry. Water moving across a street, a light
-- that only fails intermittently, how long a crossing signal actually gives
-- somebody to cross: these are the reports where a still frame is the weakest
-- possible evidence, and until now they were the only kind a resident could
-- file.

-- 1. Which kind of thing is attached ------------------------------------------

-- `image_path` keeps its name. It has held the storage path since 0003 and is
-- read by name in three select lists, the data export, and the demonstration
-- seed; renaming it in place would break every one of those at the instant the
-- migration ran and before the deploy that fixes them lands. The column holds a
-- path, `media_type` says what is at the end of it, and a rename can happen on
-- a day when it is the only thing happening.
--
-- Null means image. Every row written before today is a photograph, so the
-- absence of an answer is itself the answer and no backfill is needed.
alter table public.issues add column if not exists media_type text;

alter table public.issues drop constraint if exists issues_media_type_check;
alter table public.issues add constraint issues_media_type_check
  check (media_type is null or media_type in ('image', 'video'));

-- 2. A bucket of its own -------------------------------------------------------

-- Not `issue-images` with the rules loosened. That bucket is capped at five
-- megabytes and admits three image types, and `imageFileToWebp` re-encodes
-- everything that goes into it, so a renamed file cannot smuggle anything past
-- the decoder. Raising its ceiling to fifty megabytes to make room for video
-- would hand that same ceiling to anyone posting a photograph, and the sharp
-- pass could no longer be the only door in.
--
-- So video gets its own bucket, and the photograph rules stay exactly as strict
-- as they were.
--
-- Fifty megabytes is about a minute of phone video. The composer refuses
-- anything longer before the upload starts, but that check runs in the browser
-- and a browser is not where a limit is enforced: this is.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-videos', 'issue-videos', true, 52428800,
        array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime'];

-- 3. Who may write there -------------------------------------------------------

-- The same four rules `issue-images` has carried since 0031, for the same
-- reasons: public to read because a report is public; writes confined to a
-- folder named after the uploader so nobody can overwrite anyone else's file;
-- members only, because participation is; and officials can remove anything,
-- because they are the ones who answer for what is on the forum.
--
-- One difference that matters. A photograph is uploaded by the server inside
-- `createIssue`, after the session has been re-checked. A video is uploaded by
-- the browser before the form is submitted, because fifty megabytes through a
-- server action is not something to attempt. These policies are therefore not a
-- second line of defence for video. They are the only one.

drop policy if exists "Issue videos are publicly readable" on storage.objects;
create policy "Issue videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'issue-videos');

drop policy if exists "Users can upload their own issue videos" on storage.objects;
create policy "Users can upload their own issue videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'issue-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.viewer_is_member()
  );

drop policy if exists "Users can delete their own issue videos" on storage.objects;
create policy "Users can delete their own issue videos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.viewer_is_member()
  );

drop policy if exists "Officials can delete any issue video" on storage.objects;
create policy "Officials can delete any issue video"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-videos'
    and public.is_official((select auth.uid()))
    and public.viewer_is_member()
  );
