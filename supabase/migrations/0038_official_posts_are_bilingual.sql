-- What the borough office publishes is published in both languages.
--
-- The forum shows a post in the language it was written in, and a reader who
-- wants it in theirs presses Traduire. That is right for a resident: a
-- neighbour's words are a neighbour's words, and a machine's rendering of them
-- shown by default would be the site putting sentences in somebody's mouth.
--
-- It is wrong for the office. An arrondissement in Montréal owes its residents
-- both languages, and "press this button and wait" is not owing them both
-- languages — it is a translation the reader has to go and ask for, on a page
-- that already knows which language they are reading in.
--
-- So an official post carries its translation in the row, filled when it is
-- published and rewritten when it is edited, and the reader is simply served
-- the language they are in. The button stays for everything else: residents'
-- posts, and official posts from before this migration or whose translation the
-- endpoint refused.
--
-- One translation, not two. A post is written in one language and needs the
-- other, so `translated_to` says which one is stored and the reader is given it
-- only when it matches. Two columns per language would leave one of them
-- holding a copy of the original.

alter table public.issues
  add column if not exists translated_title text,
  add column if not exists translated_body text,
  -- The locale the stored translation is *in*. Null means there is none, which
  -- is the state of every resident post and every official post that predates
  -- this, and which the interface reads as "offer the button".
  add column if not exists translated_to text
    check (translated_to is null or translated_to in ('fr', 'en'));

-- Mirrors `body_preview` from 0013 for the same reason: the feed clamps to
-- three lines, so shipping five thousand characters of translation to a card
-- that shows three hundred is bandwidth spent on text nobody will see.
alter table public.issues
  add column if not exists translated_body_preview text
  generated always as (left(translated_body, 300)) stored;

-- Filled by the server actions rather than by a trigger. A trigger cannot make
-- an outbound HTTP call, and the translation comes from an endpoint reached
-- from Node, so the write belongs where that call already happens.
--
-- Nothing in RLS changes: the columns ride on `public.issues`, which already
-- decides that anybody may read a post and only its author or the office may
-- write one.
