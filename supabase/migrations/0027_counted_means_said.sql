-- Stop counting a resident for words somebody else said in their window.
--
-- 0018 drew the line that this feature rests on: `comptes` are the rows that
-- literally contain the words asked about, and only those may be turned into a
-- number. That was sound. What was wrong was the definition of "contain".
--
-- `council_questions.tsv` is built from the subject the clerk recorded *and*
-- the `transcript` column, and that column is not this person's words. The
-- alignment pass (scripts/py/align.py) runs a window from the moment a name is
-- called to the moment the next name is called, capped at 600 s, and stores
-- everything inside it. Read against the recording, a window routinely holds:
--
--   * the chair's housekeeping before the resident reaches the microphone,
--   * the resident's question,
--   * the borough's answer, sometimes three officials deep,
--   * whatever the next person had already started saying.
--
-- One measured example, 9 March, the window filed under Georges Christianis on
-- bike paths: it opens with the mayor already answering a previous question,
-- continues through an unrelated monologue about the 2026 World Cup, and ends
-- on a councillor saying he does not know the answer. None of it is his.
--
-- So the counts the page printed were not counts of residents raising a
-- subject. Measured on this corpus, against the clerk's own record:
--
--     term              printed    in the record    inflation
--     parc                   23                5         4.6x
--     stationnement          17                6         2.8x
--     taxes                   7                1         7.0x
--     itinerance              6                2         3.0x
--     logement               11                5         2.2x
--     piste cyclable         14               13         1.1x
--
-- A number that is wrong by four is worse than no number, because it is
-- confident, quotable, and about identifiable residents.
--
-- The fix is not to throw the transcript away. It is still the only way to find
-- the sitting where somebody used a word the clerk did not write down, and that
-- is genuinely useful. It is moved to where 0018 already puts everything that
-- cannot be counted: `rapprochees`. Found, shown, never added up.
--
-- What this does NOT fix is the window itself. Separating a resident's question
-- from the answer to it needs speaker diarisation over the audio, which is a
-- pass this pipeline does not yet run. Until it does, no text in this table can
-- be attributed to the person whose row it sits in, and nothing downstream may
-- present it as a quotation. This migration makes the *arithmetic* honest; the
-- attribution is honest only once every caller stops quoting these rows.

-- 1. The clerk's own line, indexed by itself ---------------------------------
-- Generated and stored, so no ingest stage owns it and no re-run can leave it
-- stale. `tsv` is left exactly as it was: it is what the related tier searches.

alter table public.council_questions
  add column if not exists subject_tsv tsvector generated always as (
    to_tsvector('french', coalesce(subject, ''))
    || to_tsvector('english', coalesce(subject, ''))
  ) stored;

create index if not exists council_questions_subject_tsv_idx
  on public.council_questions using gin (subject_tsv);

-- 2. Three tiers instead of two ----------------------------------------------
--
--   counted   the subject the clerk wrote contains the words. Defensible: a
--             reader can open the proces-verbal and see the same line.
--   heard     the words occur in the recording around this person's turn. That
--             is a real fact about the recording and a useful way to find the
--             moment; it is not a fact about this person.
--   near      neither, but the embedding puts it close.
--
-- Only the first is `lexical`, which is the flag every caller already reads to
-- decide what may be counted, so the split lands without a client change.
--
-- Dropped rather than replaced: `heard` is a new output column, and Postgres
-- refuses to change the return type of a live function.

drop function if exists public.search_council_questions(text, vector, text, date, date, int);

create or replace function public.search_council_questions(
  query_text text,
  query_embedding vector(768) default null,
  p_mode text default null,          -- 'orale' | 'ecrite' | null for both
  p_from date default null,
  p_to date default null,
  p_related_limit int default 8
)
returns table (
  id uuid,
  meeting_id uuid,
  youtube_id text,
  meeting_title text,
  meeting_date date,
  pv_url text,
  person_id uuid,
  name text,
  subject text,
  mode text,
  speaking_order integer,
  start_s numeric,
  end_s numeric,
  transcript text,
  lexical boolean,
  -- True when the words were found in the recording rather than in the record.
  -- Callers that quote a row must use this to say so; callers that count must
  -- ignore the row entirely, which `lexical = false` already makes them do.
  heard boolean,
  similarity double precision
)
language sql
stable
-- `public` so pgvector's `<=>` resolves; fixed, and SECURITY INVOKER.
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('french', query_text)
        || websearch_to_tsquery('english', query_text) as tsq
  ),
  scoped as (
    select cq.*, m.youtube_id, m.title as meeting_title, m.meeting_date, m.pv_url
      from public.council_questions cq
      join public.council_meetings m on m.id = cq.meeting_id
     where (p_mode is null or cq.mode = p_mode)
       and (p_from is null or m.meeting_date >= p_from)
       and (p_to   is null or m.meeting_date <= p_to)
  ),
  -- The clerk wrote these words down against this person's name.
  counted as (
    select s.*, true as lexical, false as heard
      from scoped s, q
     where s.subject_tsv @@ q.tsq
  ),
  -- The words are somewhere in the window. Whose voice is unknown.
  heard_rows as (
    select s.*, false as lexical, true as heard
      from scoped s, q
     where s.tsv @@ q.tsq
       and not exists (select 1 from counted c where c.id = s.id)
  ),
  -- Nearest neighbours that contain the words nowhere at all. Capped.
  near as (
    select s.*, false as lexical, false as heard
      from scoped s
     where query_embedding is not null
       and s.embedding is not null
       and not exists (select 1 from counted c where c.id = s.id)
       and not exists (select 1 from heard_rows h where h.id = s.id)
     order by s.embedding <=> query_embedding
     limit p_related_limit
  ),
  merged as (
    select * from counted
    union all
    select * from heard_rows
    union all
    select * from near
  )
  select m.id, m.meeting_id, m.youtube_id, m.meeting_title, m.meeting_date, m.pv_url,
         m.person_id, m.name, m.subject, m.mode, m.speaking_order,
         m.start_s, m.end_s, m.transcript,
         m.lexical, m.heard,
         case when query_embedding is null or m.embedding is null then null
              else 1 - (m.embedding <=> query_embedding) end as similarity
    from merged m
   -- Counted first, then the ones heard in the room, then the neighbours.
   order by m.lexical desc, m.heard desc, m.meeting_date desc, m.speaking_order;
$$;

grant execute on function public.search_council_questions(text, vector, text, date, date, int)
  to anon, authenticated;
