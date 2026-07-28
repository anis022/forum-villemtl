-- Turn the council feature from a guided-filter view into a search engine.
--
-- What changed and why:
--   * The taxonomy-first design could only answer questions someone had
--     anticipated. Retrieval over the transcript answers arbitrary ones.
--   * Embeddings move to 768-d (multilingual-e5-base), which runs locally at
--     ingestion and inside the function at query time. No paid API is required
--     for search; only answer synthesis would need one.
--   * Search is hybrid. Council transcripts are dense with proper nouns
--     (streets, councillors, projects) that auto-captions frequently mangle,
--     and vector similarity alone misses them. Lexical matching catches what
--     survives; the two are fused with RRF.

-- 1. Drop the seeded demo data ---------------------------------------------
-- Four of the five meetings were placeholders ('SAMPLE-2026-*') and the 18
-- interventions were written by hand, so every "watch the video" link on them
-- pointed nowhere. Cascade clears their interventions.

delete from public.council_meetings where youtube_id like 'SAMPLE-%';

-- The one real meeting (1mrzTSSarbw) carried an invented date: it is the
-- 11 March 2024 sitting, not May 2026.
update public.council_meetings
   set meeting_date = date '2024-03-11',
       title = 'Séance ordinaire du conseil d''arrondissement — 11 mars 2024',
       transcript_source = 'captions'
 where youtube_id = '1mrzTSSarbw';

-- Interventions are re-derived from the transcript by the ingestion pipeline.
delete from public.council_interventions;

-- 2. Re-dimension the embeddings -------------------------------------------
-- council_segments is empty, so this costs nothing today. Doing it after
-- ingestion would mean re-embedding the entire corpus.

drop index if exists public.council_segments_embedding_idx;
drop index if exists public.council_interventions_embedding_idx;

alter table public.council_segments
  drop column if exists embedding,
  add column embedding vector(768);

alter table public.council_interventions
  drop column if exists embedding,
  add column embedding vector(768);

alter table public.council_topics
  drop column if exists embedding,
  add column embedding vector(768);

create index council_segments_embedding_idx
  on public.council_segments using hnsw (embedding vector_cosine_ops);

create index council_interventions_embedding_idx
  on public.council_interventions using hnsw (embedding vector_cosine_ops);

-- 3. Lexical index ----------------------------------------------------------
-- Speakers switch language mid-sentence ("...like to wish j'aimerais bien sûr
-- dire ramadan barak à toute notre communauté musulmane..."), so a single
-- language configuration would stem half the corpus wrongly. Indexing under
-- both configurations costs disk and buys recall in both languages.

alter table public.council_segments
  add column if not exists tsv tsvector
  generated always as (
    to_tsvector('french', text) || to_tsvector('english', text)
  ) stored;

create index if not exists council_segments_tsv_idx
  on public.council_segments using gin (tsv);

-- 4. Hybrid search ----------------------------------------------------------
-- Reciprocal Rank Fusion: each half contributes 1/(k + rank). It needs no
-- score calibration between cosine distance and ts_rank, which are not
-- comparable quantities — only their orderings are used.
--
-- query_embedding is nullable on purpose. Before embeddings are populated the
-- function degrades to pure lexical search, so the app ships and works while
-- ingestion catches up.

create or replace function public.search_council(
  query_text text,
  query_embedding vector(768) default null,
  match_count int default 12,
  date_from date default null,
  date_to date default null
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
  score double precision,
  lexical_rank int,
  semantic_rank int
)
language sql stable
-- `public` so pgvector's `<=>` resolves; fixed, and SECURITY INVOKER.
set search_path = public
as $$
  with
  -- Candidate pool per half. Deeper than match_count so fusion has room to
  -- promote a result that only one half ranked well.
  pool as (select greatest(match_count * 4, 40) as n),
  q as (
    select websearch_to_tsquery('french', query_text)
        || websearch_to_tsquery('english', query_text) as tsq
  ),
  filtered as (
    select s.id, s.meeting_id, s.start_s, s.end_s, s.text, s.tsv, s.embedding
      from public.council_segments s
      join public.council_meetings m on m.id = s.meeting_id
     where (date_from is null or m.meeting_date >= date_from)
       and (date_to   is null or m.meeting_date <= date_to)
  ),
  lexical as (
    select f.id,
           row_number() over (
             order by ts_rank_cd(f.tsv, q.tsq) desc, f.id
           )::int as rnk
      from filtered f, q, pool
     where f.tsv @@ q.tsq
     limit (select n from pool)
  ),
  semantic as (
    select f.id,
           row_number() over (
             order by f.embedding <=> query_embedding, f.id
           )::int as rnk
      from filtered f, pool
     where query_embedding is not null
       and f.embedding is not null
     limit (select n from pool)
  ),
  fused as (
    select coalesce(l.id, s.id) as id,
           coalesce(1.0 / (60 + l.rnk), 0) + coalesce(1.0 / (60 + s.rnk), 0) as score,
           l.rnk as lexical_rank,
           s.rnk as semantic_rank
      from lexical l
      full outer join semantic s on s.id = l.id
  )
  select f.id, seg.meeting_id, m.youtube_id, m.title, m.meeting_date,
         seg.start_s, seg.end_s, seg.text,
         f.score, f.lexical_rank, f.semantic_rank
    from fused f
    join public.council_segments seg on seg.id = f.id
    join public.council_meetings m on m.id = seg.meeting_id
   order by f.score desc, seg.start_s
   limit match_count;
$$;

grant execute on function public.search_council(text, vector, int, date, date)
  to anon, authenticated;

-- The old semantic-only RPC is superseded by search_council and was never
-- called by the app.
drop function if exists public.match_council_segments(vector, int, date, date);
