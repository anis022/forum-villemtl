-- Reading what gets posted, and deciding what an elected official should look at.
--
-- The whole thing lives in Postgres rather than in the server action, for one
-- reason: the action is not the only way in. Every insert on this site goes
-- through PostgREST with the poster's own token, which the code already says
-- out loud in `addComment` — "this insert goes through the same API a signed-in
-- browser can call directly". A filter that only runs in `app/actions` is a
-- filter that anybody can skip with one fetch call. A trigger cannot be skipped.
--
-- The action still calls the same function before it writes, so somebody whose
-- message is refused gets a sentence explaining it instead of a failed insert.
-- One implementation, two callers.
--
-- The lexicon is a table, not a constant in a function. Which words matter here
-- is a judgement about this borough and this moment, and it should be revisable
-- with an INSERT at two in the morning rather than a deploy.

-- 1. Folding ----------------------------------------------------------------

/*
 * Text as the matcher sees it: lowercased, unaccented, with the usual digit
 * substitutions undone, and runs of three or more identical letters cut back to
 * two.
 *
 * Three and not two. Collapsing doubles turns "cool" into "col" and "bonne"
 * into "bone", which is a lot of damage to catch nothing — the letters people
 * actually stretch, they stretch a long way. "Connnnnard" folds to "connard";
 * "connard" was already there.
 *
 * Separators pushed between letters — c.o.n.n.a.r.d — are deliberately not
 * chased. Stripping them would join adjacent words into strings that match
 * things nobody wrote, and once the matcher starts inventing words the false
 * positives are silent while the misses are merely late. What gets through goes
 * in the queue instead.
 */
create or replace function public.moderation_fold(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           translate(
             replace(replace(lower(coalesce(p_text, '')), 'œ', 'oe'), 'æ', 'ae'),
             'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ01345$@',
             'aaaaaaceeeeiiiinooooouuuuyyoieassa'
           ),
           '(.)\1{2,}', '\1\1', 'g'
         );
$$;

-- 2. The lexicon -------------------------------------------------------------

create table if not exists public.moderation_terms (
  term    text primary key,
  weight  numeric not null check (weight > 0 and weight <= 1),
  kind    text not null check (kind in ('slur', 'threat', 'harassment', 'insult', 'vulgarity')),
  note    text,
  -- Stored already folded, because that is what it is compared against, and
  -- limited to letters, digits and spaces so a term can be dropped straight
  -- into a regex without escaping.
  constraint moderation_terms_folded check (term ~ '^[a-z0-9 ]+$')
);

comment on table public.moderation_terms is
  'The words the matcher looks for, already folded by public.moderation_fold. Tune weights here rather than in code; nothing needs redeploying.';

alter table public.moderation_terms enable row level security;

drop policy if exists "Officials can read the lexicon" on public.moderation_terms;
create policy "Officials can read the lexicon"
  on public.moderation_terms for select to authenticated
  using (public.is_official((select auth.uid())));

/*
 * Weights are set so that the arithmetic says something readable:
 *
 *   a slur or a threat, on its own                        → refused
 *   two insults in one message                            → refused
 *   one insult                                            → queued
 *   swearing, however much of it                          → nothing
 *
 * The last line is the one that matters most here. A resident calling a
 * situation "de la merde" is describing a lane full of potholes in the register
 * people actually use, and a forum that flags them for it will be a forum of
 * people writing carefully to a machine. Sacres are weighted so they can only
 * ever sharpen a message that was already going to be looked at.
 *
 * Words absent on purpose: "retard", which is an insult in English and means a
 * delay in French — the single most common noun on a page about municipal
 * works; and "con", which is a word but also the first syllable of conseil,
 * contrat and connaître. The matcher only ever compares whole words, but a list
 * is easier to reason about when nothing on it is a trap.
 */
insert into public.moderation_terms (term, weight, kind, note) values
  -- Slurs. On their own, enough to refuse the message.
  ('negre',            1.0, 'slur',       null),
  ('bougnoule',        1.0, 'slur',       null),
  ('youpin',           1.0, 'slur',       null),
  ('pede',             1.0, 'slur',       null),
  ('nigger',           1.0, 'slur',       null),
  ('faggot',           1.0, 'slur',       null),
  ('tranny',           1.0, 'slur',       null),
  ('retarded',         1.0, 'slur',       'English only; the French "retard" is a delay and is not on this list.'),

  -- Threats.
  ('je vais te tuer',  0.9, 'threat',     null),
  ('tu vas mourir',    0.9, 'threat',     null),
  ('va crever',        0.9, 'threat',     null),
  ('je te retrouverai',0.9, 'threat',     null),
  ('je vais te casser la gueule', 0.9, 'threat', null),
  ('kill yourself',    0.9, 'threat',     null),
  ('i will kill you',  0.9, 'threat',     null),
  ('kys',              0.9, 'threat',     null),

  -- Told to leave. Queued rather than refused: the wording varies enough that
  -- the matcher should not be the one deciding.
  ('retourne dans ton pays', 0.6, 'harassment', null),
  ('rentre chez toi',        0.6, 'harassment', null),
  ('sale race',              0.6, 'harassment', null),
  ('go back to your country',0.6, 'harassment', null),

  -- Aimed at a person. One queues the message, two refuse it.
  ('connard',          0.45, 'insult',    null),
  ('connasse',         0.45, 'insult',    null),
  ('conne',            0.45, 'insult',    null),
  ('salope',           0.45, 'insult',    null),
  ('salaud',           0.45, 'insult',    null),
  ('encule',           0.45, 'insult',    null),
  ('enfoire',          0.45, 'insult',    null),
  ('abruti',           0.45, 'insult',    null),
  ('cretin',           0.45, 'insult',    null),
  ('debile',           0.45, 'insult',    null),
  ('imbecile',         0.45, 'insult',    null),
  ('trou de cul',      0.45, 'insult',    null),
  ('ta gueule',        0.45, 'insult',    null),
  ('tapette',          0.45, 'insult',    'Also a flyswatter. Weighted as an insult rather than a slur for that reason.'),
  ('asshole',          0.45, 'insult',    null),
  ('bitch',            0.45, 'insult',    null),
  ('bastard',          0.45, 'insult',    null),
  ('moron',            0.45, 'insult',    null),
  ('dumbass',          0.45, 'insult',    null),
  ('scumbag',          0.45, 'insult',    null),

  -- Insulting about a thing more often than about a person. Never enough alone.
  ('idiot',            0.25, 'insult',    'Commonly "c''est idiot" about a rule rather than about a person.'),
  ('stupide',          0.25, 'insult',    null),
  ('stupid',           0.25, 'insult',    null),

  -- Register, not aggression. Cannot reach either threshold on its own.
  ('merde',            0.1,  'vulgarity', null),
  ('putain',           0.1,  'vulgarity', null),
  ('crisse',           0.1,  'vulgarity', null),
  ('tabarnak',         0.1,  'vulgarity', null),
  ('osti',             0.1,  'vulgarity', null),
  ('calice',           0.1,  'vulgarity', null),
  ('fuck',             0.1,  'vulgarity', null),
  ('shit',             0.1,  'vulgarity', null)
on conflict (term) do nothing;

-- 3. Scoring -----------------------------------------------------------------

/*
 * One row out: a score, a verdict, and the words that produced it.
 *
 * The verdict rather than the number is what callers read, so the two
 * thresholds live here and nowhere else. Putting them in the TypeScript as well
 * would mean two places to change and one of them eventually forgotten.
 *
 * SECURITY DEFINER because the lexicon is readable by officials only and this
 * has to run for everybody.
 */
create or replace function public.moderation_score(p_text text)
returns table (score numeric, verdict text, terms text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folded  text := public.moderation_fold(p_text);
  raw     numeric := 0;
  matched text[] := '{}';
  letters int;
  shouted int;
  loud    boolean;
begin
  select coalesce(sum(t.weight), 0),
         coalesce(array_agg(t.term order by t.weight desc, t.term), '{}')
    into raw, matched
    from public.moderation_terms t
   where folded ~ ('\m' || t.term || '\M');

  /*
   * Shouting multiplies; it never adds. A message in capitals with nothing else
   * wrong scores zero and stays zero — plenty of people write that way, and
   * some of them are shouting at a pothole. What it does do is sharpen a
   * message that was already scoring: the same insult screamed is the one more
   * likely to have been aimed at somebody.
   */
  letters := length(regexp_replace(coalesce(p_text, ''), '[^[:alpha:]]', '', 'g'));
  shouted := length(regexp_replace(coalesce(p_text, ''), '[^[:upper:]]', '', 'g'));
  loud := letters >= 30 and shouted::numeric / greatest(letters, 1) > 0.7;

  score := least(round(raw * (case when loud then 1.2 else 1 end), 3), 1);
  verdict := case
    when score >= 0.85 then 'block'
    when score >= 0.40 then 'flag'
    else 'clear'
  end;
  -- Nothing to report on a message nobody will look at.
  terms := case when verdict = 'clear' then '{}'::text[] else matched end;

  return next;
end;
$$;

grant execute on function public.moderation_score(text) to authenticated;

-- 4. The queue ---------------------------------------------------------------

/*
 * A table of its own rather than columns on `issues` and `comments`.
 *
 * RLS grants rows, not columns, and both of those tables are readable by
 * everyone — so a score and the list of words that produced it, stored there,
 * would be published alongside the post. Which words trip the matcher is not
 * something to hand out: it is the instructions for getting around it.
 */
create table if not exists public.moderation_flags (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid references public.issues (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  score      numeric not null,
  terms      text[] not null default '{}',
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references public.profiles (id) on delete set null,
  -- Exactly one of the two, always.
  constraint moderation_flags_one_target check (num_nonnulls(issue_id, comment_id) = 1)
);

comment on table public.moderation_flags is
  'What the matcher wants a human to look at. Cleared, not deleted: a flag an official has read and dismissed is the record that they did.';

create unique index if not exists moderation_flags_issue_key
  on public.moderation_flags (issue_id) where issue_id is not null;
create unique index if not exists moderation_flags_comment_key
  on public.moderation_flags (comment_id) where comment_id is not null;
create index if not exists moderation_flags_open_idx
  on public.moderation_flags (created_at desc) where cleared_at is null;

alter table public.moderation_flags enable row level security;

drop policy if exists "Officials can read the moderation queue" on public.moderation_flags;
create policy "Officials can read the moderation queue"
  on public.moderation_flags for select to authenticated
  using (public.is_official((select auth.uid())));

drop policy if exists "Officials can clear flags" on public.moderation_flags;
create policy "Officials can clear flags"
  on public.moderation_flags for update to authenticated
  using (public.is_official((select auth.uid())))
  with check (public.is_official((select auth.uid())));

-- No INSERT policy on purpose: the trigger below is the only thing that writes
-- here, and it owns its writes as SECURITY DEFINER.

-- 5. The trigger -------------------------------------------------------------

/*
 * Runs AFTER INSERT, on both tables.
 *
 * After rather than before because a flag needs the row's id to point at, and
 * raising from an AFTER trigger rolls the insert back just as well — the whole
 * statement goes, and the refused message was never stored.
 *
 * The two tables are handled in separate IF branches rather than one CASE
 * expression. PL/pgSQL prepares a statement the first time it runs, so a branch
 * naming `new.title` is never prepared while the trigger is firing on
 * `comments`, where that column does not exist. Folded into a single expression
 * it would be prepared either way, and every comment on the site would fail.
 */
create or replace function public.moderate_new_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject text;
  v       record;
begin
  if tg_table_name = 'issues' then
    subject := coalesce(new.title, '') || ' ' || coalesce(new.body, '');
  else
    subject := coalesce(new.body, '');
  end if;

  select * into v from public.moderation_score(subject);

  if v.verdict = 'block' then
    -- The message is what the server action matches on to tell the poster why,
    -- so it is a stable token rather than a sentence in one language.
    raise exception 'moderation_blocked'
      using errcode = 'check_violation',
            detail  = array_to_string(v.terms, ',');
  end if;

  if v.verdict = 'flag' then
    if tg_table_name = 'issues' then
      insert into public.moderation_flags (issue_id, score, terms)
      values (new.id, v.score, v.terms)
      on conflict do nothing;
    else
      insert into public.moderation_flags (comment_id, score, terms)
      values (new.id, v.score, v.terms)
      on conflict do nothing;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists issues_moderate on public.issues;
create trigger issues_moderate
  after insert on public.issues
  for each row execute function public.moderate_new_post();

drop trigger if exists comments_moderate on public.comments;
create trigger comments_moderate
  after insert on public.comments
  for each row execute function public.moderate_new_post();
