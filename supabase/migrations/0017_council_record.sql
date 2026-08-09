-- Put the borough's own record next to the recording.
--
-- Until now the council feature knew only what YouTube's auto-captions said.
-- That made every interesting question unanswerable. "How many people raised
-- the Terrebonne bike path?" over a caption track means asking a model to
-- decide whether two garbled names are two residents or one, and to be right
-- about it every time; the honest answer was always a page of passages and a
-- shrug.
--
-- The arrondissement publishes the answer. Every sitting's proces-verbal names
-- each resident who addressed the council and the subject the clerk recorded
-- for them, in the order they spoke, and numbers every resolution. So counting
-- stops being an inference and becomes a GROUP BY over rows the borough itself
-- published, while the transcript supplies what was actually said and when.
--
-- That split is the point of this migration:
--
--   council_questions     who spoke, about what        -- from the PDF, exact
--   council_resolutions   what was decided             -- from the PDF, exact
--   council_segments      what was said, second by second  -- from Whisper
--
-- The first two are countable. The third is quotable. Alignment (0018) gives
-- rows in the first two a start_s in the third, so a count can cite the video.

-- 1. Retire the taxonomy experiment --------------------------------------
-- council_interventions was designed to hold LLM-derived "one row per thing
-- someone said", tagged against council_topics. It was emptied in 0006 and
-- never refilled: the tagging pass it needed was the part that could not be
-- made trustworthy. The two tables below replace it with a record that does
-- not need to be inferred, so the empty shell goes rather than lingering as a
-- second, contradictory answer to "where do interventions live".

drop function if exists public.council_interventions_filtered(uuid, text, date, date);
drop table if exists public.council_interventions;
drop table if exists public.council_topics;

-- 2. Meetings gain their paperwork ----------------------------------------

alter table public.council_meetings
  add column if not exists kind text,
  add column if not exists pv_url text,
  add column if not exists odj_url text,
  -- Which pass produced the transcript, so a later re-decode is visible rather
  -- than silently mixed in with an older one.
  add column if not exists transcript_model text;

-- `transcript_source` was constrained to captions|whisper when captions were
-- the only thing we had. Both remain legal; the default flips to the pass we
-- actually run now.
alter table public.council_meetings
  alter column transcript_source set default 'whisper';

-- 3. People -----------------------------------------------------------------
-- One row per human, so "three residents" is a count of people and not of
-- appearances. name_key is the join key: the clerk is consistent but not
-- perfectly so, and "Joel Coppieters" and "Joël Coppieters" are one person.

create table if not exists public.council_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  role text not null default 'resident'
    check (role in ('resident', 'councillor', 'mayor', 'staff', 'unknown')),
  district text,
  created_at timestamptz not null default now()
);

create index if not exists council_people_role_idx on public.council_people (role);

-- 4. Public questions -------------------------------------------------------
-- The countable record. One row per person per intervention, exactly as the
-- proces-verbal lists them.

create table if not exists public.council_questions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.council_meetings (id) on delete cascade,
  person_id uuid references public.council_people (id) on delete set null,

  -- Kept verbatim beside person_id: the printed spelling is what a reader will
  -- recognise, and it survives even if the identity link is later revised.
  name text not null,
  subject text not null,

  -- The borough runs two question periods and the distinction is the filter
  -- residents actually want: spoken at the microphone, or submitted in writing.
  mode text not null check (mode in ('orale', 'ecrite')),

  -- Order within the sitting. This is what makes alignment possible: the
  -- recording plays these out in exactly this sequence.
  --
  -- Not called `position`. Postgres accepts that as a table column but rejects
  -- it as a RETURNS TABLE output name, because output names are function
  -- parameters and POSITION is a reserved function name -- so the column would
  -- work and every RPC returning it would fail to compile.
  speaking_order integer not null,

  -- Filled by the alignment pass; null until then.
  start_s numeric,
  end_s numeric,
  transcript text,

  embedding vector(768),
  tsv tsvector generated always as (
    to_tsvector('french', coalesce(subject, '') || ' ' || coalesce(transcript, ''))
    || to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(transcript, ''))
  ) stored,

  -- Re-ingesting a sitting must replace its rows, never duplicate them.
  unique (meeting_id, mode, speaking_order)
);

create index if not exists council_questions_meeting_idx
  on public.council_questions (meeting_id, mode, speaking_order);
create index if not exists council_questions_person_idx
  on public.council_questions (person_id);
create index if not exists council_questions_tsv_idx
  on public.council_questions using gin (tsv);
create index if not exists council_questions_embedding_idx
  on public.council_questions using hnsw (embedding vector_cosine_ops);

-- 5. Resolutions ------------------------------------------------------------

create table if not exists public.council_resolutions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.council_meetings (id) on delete cascade,

  number text not null,          -- 'CA26 170123'
  title text not null,
  body text,
  moved_by text,
  seconded_by text,
  outcome text,                  -- 'ADOPTÉE À L'UNANIMITÉ', 'REJETÉE', ...
  agenda_code text,              -- '20.04', the ordre du jour item
  dossier text,                  -- the city's internal decision-record number
  debate boolean not null default false,
  speaking_order integer not null,

  start_s numeric,
  end_s numeric,

  embedding vector(768),
  tsv tsvector generated always as (
    to_tsvector('french', coalesce(title, '') || ' ' || coalesce(body, ''))
    || to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,

  unique (meeting_id, number)
);

create index if not exists council_resolutions_meeting_idx
  on public.council_resolutions (meeting_id, speaking_order);
create index if not exists council_resolutions_tsv_idx
  on public.council_resolutions using gin (tsv);
create index if not exists council_resolutions_embedding_idx
  on public.council_resolutions using hnsw (embedding vector_cosine_ops);

-- 6. Segments gain structure ------------------------------------------------

alter table public.council_segments
  -- Word-level timing, so a citation can open the video on the sentence rather
  -- than on the 45-second bucket that happened to contain it.
  add column if not exists words jsonb,
  add column if not exists lang text,
  -- Which part of the sitting this fell in. This is the filter the search page
  -- exposes: public questions, or agenda and resolutions.
  add column if not exists section text
    check (section in ('ouverture', 'commentaires', 'questions', 'resolutions', 'autre')),
  add column if not exists question_id uuid
    references public.council_questions (id) on delete set null,
  add column if not exists resolution_id uuid
    references public.council_resolutions (id) on delete set null,
  -- Whisper's own confidence. Low-confidence spans are still shown, but a
  -- reader deserves to be told when the machine was guessing.
  add column if not exists avg_logprob numeric;

create index if not exists council_segments_section_idx
  on public.council_segments (section);
create index if not exists council_segments_question_idx
  on public.council_segments (question_id);
create index if not exists council_segments_resolution_idx
  on public.council_segments (resolution_id);

-- 7. Public read ------------------------------------------------------------
-- Same posture as the rest of the council schema: anyone may read, writes go
-- over the direct Postgres connection used by local ingestion, which bypasses
-- RLS entirely.

alter table public.council_people enable row level security;
alter table public.council_questions enable row level security;
alter table public.council_resolutions enable row level security;

drop policy if exists "Council people are public" on public.council_people;
create policy "Council people are public"
  on public.council_people for select using (true);

drop policy if exists "Council questions are public" on public.council_questions;
create policy "Council questions are public"
  on public.council_questions for select using (true);

drop policy if exists "Council resolutions are public" on public.council_resolutions;
create policy "Council resolutions are public"
  on public.council_resolutions for select using (true);
