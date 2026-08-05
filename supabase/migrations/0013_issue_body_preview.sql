-- Stop shipping every report's full text to render three clamped lines.
--
-- The feed card renders `body` under `line-clamp-3` — about 270 characters at
-- the widest, fewer on a phone. The query behind it was fetching the whole
-- column, which the form allows up to 5000 characters, for fifty reports at a
-- time. On a free Supabase project that egress is the scarcest resource there
-- is, and most of it was being spent on text no one could see.
--
-- A stored generated column rather than `left()` at query time: PostgREST
-- cannot express a function call in a select, and computing it on write costs
-- nothing on a table that is read far more often than it is written.
--
-- 300 characters, not 270: the clamp depends on viewport width and font
-- metrics, and a preview that runs slightly past the fold is invisible, while
-- one that stops short leaves a card ending mid-sentence with room to spare.

alter table public.issues
  add column if not exists body_preview text
  generated always as (left(body, 300)) stored;
