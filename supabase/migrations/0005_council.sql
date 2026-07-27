-- Search & analytics over CDN-NDG council-meeting recordings.
--
-- All AI (transcription, tagging, embeddings) runs once during LOCAL ingestion;
-- the deployed app only reads these tables via SQL + pgvector similarity.
-- Embeddings are 384-d (multilingual-e5-small), populated by the ingestion
-- pipeline. RLS is public-read; writes happen over the pooler/superuser
-- connection used by the local ingest scripts, which bypasses RLS.

create extension if not exists vector;

-- 1. Meetings --------------------------------------------------------------

create table if not exists public.council_meetings (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique,
  title text not null,
  meeting_date date not null,
  url text not null,
  duration_s integer,
  transcript_source text not null default 'captions'
    check (transcript_source in ('captions', 'whisper')),
  created_at timestamptz not null default now()
);

create index if not exists council_meetings_date_idx
  on public.council_meetings (meeting_date desc);

-- 2. Topic taxonomy --------------------------------------------------------
-- Interventions link to these so counting is exact ("bike lanes" == one slug,
-- not a fuzzy text match). Embeddings let free-text queries map onto a topic.

create table if not exists public.council_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_fr text not null,
  label_en text not null,
  embedding vector(384)
);

-- 3. Transcript segments (retrieval layer) ---------------------------------

create table if not exists public.council_segments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.council_meetings (id) on delete cascade,
  start_s numeric not null,
  end_s numeric not null,
  speaker text,
  text text not null,
  embedding vector(384)
);

create index if not exists council_segments_meeting_idx
  on public.council_segments (meeting_id, start_s);

create index if not exists council_segments_embedding_idx
  on public.council_segments using hnsw (embedding vector_cosine_ops);

-- 4. Interventions (analytics layer) ---------------------------------------
-- One row per distinct thing someone said in the question period / debate.
-- speaker_label comes from diarization; topic_ids makes counting a real query.

create table if not exists public.council_interventions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.council_meetings (id) on delete cascade,
  start_s numeric not null,
  end_s numeric not null,
  speaker_label text,
  speaker_role text
    check (speaker_role in ('resident', 'councillor', 'mayor', 'staff', 'unknown')),
  topic_ids uuid[] not null default '{}',
  type text check (type in ('question', 'complaint', 'support', 'info', 'response')),
  sentiment text check (sentiment in ('neg', 'neutral', 'pos')),
  summary text,
  embedding vector(384)
);

create index if not exists council_interventions_meeting_idx
  on public.council_interventions (meeting_id, start_s);

create index if not exists council_interventions_type_idx
  on public.council_interventions (type);

-- Array membership index so topic filters are fast.
create index if not exists council_interventions_topics_idx
  on public.council_interventions using gin (topic_ids);

create index if not exists council_interventions_embedding_idx
  on public.council_interventions using hnsw (embedding vector_cosine_ops);

-- 5. RLS: public read only -------------------------------------------------

alter table public.council_meetings enable row level security;
alter table public.council_topics enable row level security;
alter table public.council_segments enable row level security;
alter table public.council_interventions enable row level security;

drop policy if exists "Council meetings are public" on public.council_meetings;
create policy "Council meetings are public"
  on public.council_meetings for select using (true);

drop policy if exists "Council topics are public" on public.council_topics;
create policy "Council topics are public"
  on public.council_topics for select using (true);

drop policy if exists "Council segments are public" on public.council_segments;
create policy "Council segments are public"
  on public.council_segments for select using (true);

drop policy if exists "Council interventions are public" on public.council_interventions;
create policy "Council interventions are public"
  on public.council_interventions for select using (true);

-- 6. Semantic search RPC ---------------------------------------------------
-- Cosine similarity over segments, with optional date filtering, joined back
-- to the meeting so the app can build a YouTube deep-link.

create or replace function public.match_council_segments(
  query_embedding vector(384),
  match_count int default 10,
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
  speaker text,
  text text,
  similarity float
)
language sql stable
-- `public` (not '') so pgvector's `<=>` operator, which lives in public,
-- resolves. Fixed (not mutable), and the function is SECURITY INVOKER.
set search_path = public
as $$
  select s.id, s.meeting_id, m.youtube_id, m.title, m.meeting_date,
         s.start_s, s.end_s, s.speaker, s.text,
         1 - (s.embedding <=> query_embedding) as similarity
  from public.council_segments s
  join public.council_meetings m on m.id = s.meeting_id
  where s.embedding is not null
    and (date_from is null or m.meeting_date >= date_from)
    and (date_to is null or m.meeting_date <= date_to)
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_council_segments(vector, int, date, date)
  to anon, authenticated;

-- Analytics query: interventions joined to their meeting, with optional topic /
-- type / date-range filters. This is what powers the guided "how many X in the
-- last N months" view — a real aggregate, no LLM at runtime.

create or replace function public.council_interventions_filtered(
  p_topic uuid default null,
  p_type text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  meeting_title text,
  meeting_date date,
  youtube_id text,
  start_s numeric,
  speaker_role text,
  type text,
  sentiment text,
  summary text,
  topic_ids uuid[]
)
language sql stable
set search_path = public
as $$
  select i.id, m.title, m.meeting_date, m.youtube_id, i.start_s,
         i.speaker_role, i.type, i.sentiment, i.summary, i.topic_ids
  from public.council_interventions i
  join public.council_meetings m on m.id = i.meeting_id
  where (p_topic is null or p_topic = any (i.topic_ids))
    and (p_type is null or i.type = p_type)
    and (p_from is null or m.meeting_date >= p_from)
    and (p_to is null or m.meeting_date <= p_to)
  order by m.meeting_date desc, i.start_s;
$$;

grant execute on function public.council_interventions_filtered(uuid, text, date, date)
  to anon, authenticated;

-- 7. Starter topic taxonomy ------------------------------------------------
-- Embeddings filled in by the ingestion pipeline.

insert into public.council_topics (slug, label_fr, label_en) values
  ('pistes-cyclables', 'Pistes cyclables', 'Bike lanes'),
  ('circulation', 'Circulation et stationnement', 'Traffic and parking'),
  ('proprete', 'Propreté', 'Cleanliness'),
  ('securite', 'Sécurité', 'Safety'),
  ('deneigement', 'Déneigement', 'Snow removal'),
  ('parcs', 'Parcs et espaces verts', 'Parks and green spaces'),
  ('logement', 'Logement', 'Housing'),
  ('urbanisme', 'Urbanisme et zonage', 'Urban planning and zoning'),
  ('bruit', 'Bruit', 'Noise'),
  ('itinerance', 'Itinérance', 'Homelessness'),
  ('transport', 'Transport collectif', 'Public transit'),
  ('taxes', 'Taxes et budget', 'Taxes and budget'),
  ('arbres', 'Arbres et verdissement', 'Trees and greening'),
  ('animaux', 'Animaux', 'Animals')
on conflict (slug) do nothing;
