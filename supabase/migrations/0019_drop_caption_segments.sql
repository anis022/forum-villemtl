-- Retire the auto-caption transcript.
--
-- Every passage in council_segments used to come from YouTube's automatic
-- captions. They are the reason this feature could not answer anything: no
-- punctuation, no casing, and proper nouns mangled past recognition --
-- "deenagement" for "deneigement", "chestinan" for "Palestinian". The notes in
-- utils/council.ts record the conclusion reached the hard way, that transcript
-- quality and not ranking was the binding constraint.
--
-- They are now being replaced, meeting by meeting, with a local Whisper pass
-- that carries punctuation, casing and word-level timing. Until this runs, both
-- generations sit in the same table, and the page shows whichever it finds
-- under a heading that reads "Ce qui a été dit". Presenting a caption-era
-- passage that way is a claim about what a named resident said, made from text
-- that cannot support it.
--
-- The distinction is not a matter of taste, and it is recorded in the row
-- itself: the new pass writes word-level timestamps, the old one never could.
-- A segment with no `words` cannot place a citation at the second it promises,
-- so it has no business backing one.
--
-- Deleting rather than hiding: the transcription pass rewrites each meeting's
-- segments wholesale, so anything removed here comes back better within hours,
-- and a filter left in the query layer would outlive the reason for it.

delete from public.council_segments where words is null;

-- `transcript_source` defaulted to 'whisper' from migration 0017, which meant a
-- sitting registered before it had been transcribed claimed a transcript it did
-- not have -- the 9 March recording sat there as 'whisper' with zero segments.
-- The ingest that writes the transcript is the only thing that can honestly set
-- this, so the resting state goes back to the truth for a row nobody has
-- transcribed yet.
alter table public.council_meetings
  alter column transcript_source set default 'captions';

update public.council_meetings m
   set transcript_source = 'captions',
       transcript_model = null
 where transcript_model is null
   and not exists (
     select 1 from public.council_segments s where s.meeting_id = m.id
   );
