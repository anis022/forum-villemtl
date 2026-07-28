-- Give the application a way to tell "this query has no real answer here"
-- apart from "here are the twelve nearest vectors anyway".
--
-- Cosine similarity has no floor: the nearest neighbours always exist, so an
-- off-topic query still returns a full page of confident-looking passages.
-- Measured on this corpus, absolute similarity cannot separate the two cases —
-- "cryptomonnaie et blockchain" scored 0.833 while "déneigement", which is
-- genuinely discussed, scored 0.823. The absolute values are not comparable
-- across queries.
--
-- What does separate them is the *margin*: how far the best hit stands above
-- the corpus distribution for that same query. This returns it and lets the
-- application decide what to do with it, so the threshold can be recalibrated
-- in TypeScript as the corpus grows, without another migration.

drop function if exists public.search_council(text, vector, int, date, date);

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
  semantic_rank int,
  similarity double precision,
  margin double precision
)
language sql stable
set search_path = public
as $$
  with
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
  -- Mean and spread of similarity for THIS query, over a stable pseudo-random
  -- sample. A full scan would be exact but costs a vector op per row on every
  -- search; 600 rows estimate the distribution closely enough.
  stats as (
    select avg(sim) as mean, nullif(stddev_pop(sim), 0) as sd
      from (
        select 1 - (embedding <=> query_embedding) as sim
          from public.council_segments
         where embedding is not null
           and query_embedding is not null
         order by md5(id::text)
         limit 600
      ) t
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
         f.score, f.lexical_rank, f.semantic_rank,
         case when query_embedding is null then null
              else 1 - (seg.embedding <=> query_embedding) end as similarity,
         case when query_embedding is null or st.sd is null then null
              else ((1 - (seg.embedding <=> query_embedding)) - st.mean) / st.sd
         end as margin
    from fused f
    join public.council_segments seg on seg.id = f.id
    join public.council_meetings m on m.id = seg.meeting_id
    left join stats st on true
   order by f.score desc, seg.start_s
   limit match_count;
$$;

grant execute on function public.search_council(text, vector, int, date, date)
  to anon, authenticated;
