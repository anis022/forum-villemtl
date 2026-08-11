-- What the elected members themselves raised.
--
-- Every sitting has two periods that belong to the council rather than to the
-- public, and until now neither was read at all:
--
--   10.04  PÉRIODE DE COMMENTAIRES DES MEMBRES DU CONSEIL
--   10.07  PÉRIODE DE QUESTIONS DES MEMBRES DU CONSEIL
--
-- An extraction audit put a number on the omission: 4.9% of the words on the
-- page reached no field in this database, and almost all of that was these two
-- sections. Reading them takes coverage to 2.9%, and what remains is either
-- information stored in restructured form or names inside nomination tables.
--
-- The content is the kind a resident actually goes looking for -- "Marquage de
-- la piste cyclable Notre-Dame-de-Grâce", "Nids-de-poule", "Corvée de nettoyage
-- de la Falaise Saint-Jacques" -- each attributed to a named councillor.
--
-- One row per item, not per councillor. A member raises six things in an
-- evening, and "what did McQueen say about bike lanes" has to match the one
-- bullet without dragging in the other five.

create table if not exists public.council_remarks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.council_meetings (id) on delete cascade,
  person_id uuid references public.council_people (id) on delete set null,

  name text not null,
  topic text not null,

  -- Which of the two periods. Kept apart because they are different acts: one
  -- is a member reporting to the room, the other is a member putting a question
  -- to the administration and expecting an answer.
  kind text not null check (kind in ('commentaire', 'question')),

  speaking_order integer not null,

  -- Reserved for the alignment pass, which does not cover these yet: the chair
  -- does not announce councillors by name the way it announces residents, so
  -- locating them needs different evidence than the public question period.
  start_s numeric,
  end_s numeric,

  embedding vector(768),
  tsv tsvector generated always as (
    to_tsvector('french', coalesce(name, '') || ' ' || coalesce(topic, ''))
    || to_tsvector('english', coalesce(name, '') || ' ' || coalesce(topic, ''))
  ) stored,

  unique (meeting_id, kind, speaking_order)
);

create index if not exists council_remarks_meeting_idx
  on public.council_remarks (meeting_id, kind, speaking_order);
create index if not exists council_remarks_person_idx
  on public.council_remarks (person_id);
create index if not exists council_remarks_tsv_idx
  on public.council_remarks using gin (tsv);
create index if not exists council_remarks_embedding_idx
  on public.council_remarks using hnsw (embedding vector_cosine_ops);

alter table public.council_remarks enable row level security;

drop policy if exists "Council remarks are public" on public.council_remarks;
create policy "Council remarks are public"
  on public.council_remarks for select using (true);

-- Search, same shape as the other two: everything containing the words, then a
-- capped tail of nearest neighbours that do not, flagged so the page can keep
-- them out of any number it states.

create or replace function public.search_council_remarks(
  query_text text,
  query_embedding vector(768) default null,
  p_kind text default null,          -- 'commentaire' | 'question' | null
  p_from date default null,
  p_to date default null,
  p_related_limit int default 6
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
  topic text,
  kind text,
  speaking_order integer,
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
    select cr.*, m.youtube_id, m.title as meeting_title, m.meeting_date, m.pv_url
      from public.council_remarks cr
      join public.council_meetings m on m.id = cr.meeting_id
     where (p_kind is null or cr.kind = p_kind)
       and (p_from is null or m.meeting_date >= p_from)
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
  select m.id, m.meeting_id, m.youtube_id, m.meeting_title, m.meeting_date, m.pv_url,
         m.person_id, m.name, m.topic, m.kind, m.speaking_order, m.start_s,
         m.lexical,
         case when query_embedding is null or m.embedding is null then null
              else 1 - (m.embedding <=> query_embedding) end as similarity
    from merged m
   order by m.lexical desc, m.meeting_date desc, m.speaking_order;
$$;

grant execute on function public.search_council_remarks(text, vector, text, date, date, int)
  to anon, authenticated;
