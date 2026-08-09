-- Turn the council search from "here are twelve passages" into an answer.
--
-- The question this feature exists to answer is countable: "how many people
-- raised the Terrebonne bike path?". 0017 made the record countable; this
-- makes it queryable, and draws a hard line down the middle of the result:
--
--   COUNTED    rows whose text literally contains the words asked about.
--              Exact, explainable, and defensible -- a reader can see the words
--              in the quote. This is what any number on the page is computed
--              from.
--
--   RELATED    rows the embedding puts nearby but that contain none of the
--              words. Useful for reading, useless for counting, and shown as
--              such.
--
-- That split is the whole design. Cosine similarity has no floor -- 0007 went
-- looking for one and 0016's notes in utils/council.ts record how it failed:
-- on this corpus "recette de tarte aux pommes" outscored "deneigement". A
-- number derived from nearest-neighbour ranking would be confident and wrong.
-- A number derived from "these four residents said this word" is neither.
--
-- Callers pass an already-expanded query string (see utils/council-terms.ts),
-- so "sidewalk" reaches "trottoir" without this file holding a dictionary that
-- needs a migration to correct.

-- 1. Public questions -------------------------------------------------------
-- The countable table. Returns every match rather than a page of them: the
-- corpus is one year of sittings, so an exhaustive answer costs nothing and a
-- truncated one would silently under-count.

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
  -- Everything that actually contains the words.
  hits as (
    select s.*, true as lexical
      from scoped s, q
     where s.tsv @@ q.tsq
  ),
  -- Nearest neighbours that did not. Capped, and never counted.
  near as (
    select s.*, false as lexical
      from scoped s
     where query_embedding is not null
       and s.embedding is not null
       and not exists (select 1 from hits h where h.id = s.id)
     order by s.embedding <=> query_embedding
     limit p_related_limit
  ),
  merged as (
    select * from hits
    union all
    select * from near
  )
  select m.id, m.meeting_id, m.youtube_id, m.meeting_title, m.meeting_date, m.pv_url,
         m.person_id, m.name, m.subject, m.mode, m.speaking_order,
         m.start_s, m.end_s, m.transcript,
         m.lexical,
         case when query_embedding is null or m.embedding is null then null
              else 1 - (m.embedding <=> query_embedding) end as similarity
    from merged m
   -- Counted rows first, then most recent, then the order they spoke in.
   order by m.lexical desc, m.meeting_date desc, m.speaking_order;
$$;

grant execute on function public.search_council_questions(text, vector, text, date, date, int)
  to anon, authenticated;

-- 2. Resolutions ------------------------------------------------------------
-- The other half of the filter the page offers: what the council decided,
-- rather than what residents asked.

create or replace function public.search_council_resolutions(
  query_text text,
  query_embedding vector(768) default null,
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
  odj_url text,
  number text,
  title text,
  body text,
  outcome text,
  agenda_code text,
  moved_by text,
  seconded_by text,
  debate boolean,
  start_s numeric,
  lexical boolean,
  similarity double precision
)
language sql
stable
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('french', query_text)
        || websearch_to_tsquery('english', query_text) as tsq
  ),
  scoped as (
    select cr.*, m.youtube_id, m.title as meeting_title, m.meeting_date,
           m.pv_url, m.odj_url
      from public.council_resolutions cr
      join public.council_meetings m on m.id = cr.meeting_id
     where (p_from is null or m.meeting_date >= p_from)
       and (p_to   is null or m.meeting_date <= p_to)
  ),
  hits as (
    select s.*, true as lexical from scoped s, q where s.tsv @@ q.tsq
  ),
  near as (
    select s.*, false as lexical
      from scoped s
     where query_embedding is not null
       and s.embedding is not null
       and not exists (select 1 from hits h where h.id = s.id)
     order by s.embedding <=> query_embedding
     limit p_related_limit
  ),
  merged as (select * from hits union all select * from near)
  select m.id, m.meeting_id, m.youtube_id, m.meeting_title, m.meeting_date,
         m.pv_url, m.odj_url,
         m.number, m.title, m.body, m.outcome, m.agenda_code,
         m.moved_by, m.seconded_by, m.debate, m.start_s,
         m.lexical,
         case when query_embedding is null or m.embedding is null then null
              else 1 - (m.embedding <=> query_embedding) end as similarity
    from merged m
   order by m.lexical desc, m.meeting_date desc, m.speaking_order;
$$;

grant execute on function public.search_council_resolutions(text, vector, date, date, int)
  to anon, authenticated;

-- 3. Transcript passages ----------------------------------------------------
-- 0007's search_council, plus the section filter the page now exposes and the
-- attribution that alignment provides. Kept because a resident often wants the
-- words themselves rather than the count.

drop function if exists public.search_council(text, vector, int, date, date);

create or replace function public.search_council(
  query_text text,
  query_embedding vector(768) default null,
  match_count int default 12,
  date_from date default null,
  date_to date default null,
  p_section text default null
)
returns table (
  id uuid,
  meeting_id uuid,
  youtube_id text,
  meeting_title text,
  meeting_date date,
  start_s numeric,
  end_s numeric,
  text text,
  section text,
  speaker text,
  score double precision,
  lexical_rank int,
  semantic_rank int
)
language sql
stable
set search_path = public
as $$
  with
  pool as (select greatest(match_count * 4, 40) as n),
  q as (
    select websearch_to_tsquery('french', query_text)
        || websearch_to_tsquery('english', query_text) as tsq
  ),
  filtered as (
    select s.id, s.meeting_id, s.start_s, s.end_s, s.text, s.tsv, s.embedding,
           s.section, cq.name as speaker
      from public.council_segments s
      join public.council_meetings m on m.id = s.meeting_id
      left join public.council_questions cq on cq.id = s.question_id
     where (date_from is null or m.meeting_date >= date_from)
       and (date_to   is null or m.meeting_date <= date_to)
       and (p_section is null or s.section = p_section)
  ),
  lexical as (
    select f.id,
           row_number() over (order by ts_rank_cd(f.tsv, q.tsq) desc, f.id)::int as rnk
      from filtered f, q, pool
     where f.tsv @@ q.tsq
     limit (select n from pool)
  ),
  semantic as (
    select f.id,
           row_number() over (order by f.embedding <=> query_embedding, f.id)::int as rnk
      from filtered f, pool
     where query_embedding is not null
       and f.embedding is not null
     limit (select n from pool)
  ),
  -- Reciprocal Rank Fusion: each half contributes 1/(k + rank), which needs no
  -- score calibration between cosine distance and ts_rank -- quantities that
  -- are not comparable, and whose orderings are all this uses.
  fused as (
    select coalesce(l.id, s.id) as id,
           coalesce(1.0 / (60 + l.rnk), 0) + coalesce(1.0 / (60 + s.rnk), 0) as score,
           l.rnk as lexical_rank,
           s.rnk as semantic_rank
      from lexical l
      full outer join semantic s on s.id = l.id
  )
  select f.id, seg.meeting_id, m.youtube_id, m.title, m.meeting_date,
         seg.start_s, seg.end_s, seg.text, seg.section, seg.speaker,
         f.score, f.lexical_rank, f.semantic_rank
    from fused f
    join filtered seg on seg.id = f.id
    join public.council_meetings m on m.id = seg.meeting_id
   order by f.score desc, seg.start_s
   limit match_count;
$$;

grant execute on function public.search_council(text, vector, int, date, date, text)
  to anon, authenticated;
