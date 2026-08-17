-- The forum is for members, and the membership list is the party's own.
--
-- Until now anyone with an email address could make an account and post. That
-- was the right shape for a public borough forum and it is not the shape this
-- one has any more: the roster of Ensemble Montréal members in
-- Côte-des-Neiges–Notre-Dame-de-Grâce decides who may speak, and the roster
-- lives outside this codebase, exported as a CSV.
--
-- Reading is untouched. Every select policy on the site still says "viewable by
-- everyone" and this migration does not narrow one of them: the topics, the
-- projects and the council record stay public and stay linkable. What is gated
-- is taking part — signing in at all, and the three writes that put a person's
-- name on the site.
--
-- Three layers, because the first two are convenience and only the third is a
-- rule:
--
--   1. `membership_status()` lets the sign-in dialog say *why* an address was
--      refused before a code is ever sent.
--   2. `handle_new_user()` refuses to create the account at all, so a request
--      made straight to the auth API rather than through the dialog gets
--      nowhere.
--   3. `viewer_is_member()` on the insert policies re-checks on every post,
--      every reply and every backing — so a membership that lapses, or a row
--      pulled from the roster, stops the account from writing on the next
--      request rather than at its next sign-in.
--
-- Only 3 survives a determined person. 1 and 2 exist so the other 99% get a
-- sentence instead of a mystery.

-- 1. The roster ---------------------------------------------------------------

-- A copy of the membership export, and nothing more. It is not a user table:
-- no row here grants a session on its own, nothing joins to it for display, and
-- an account may exist for an address that has since left the list.
--
-- Only the columns the forum actually decides with are kept. The export also
-- carries civic address, apartment number, postal code, two phone numbers, the
-- amount paid, the payment method and who recruited the person; none of that
-- has any bearing on whether someone may post, so none of it is loaded. The
-- table is the narrowest thing that can answer "may this address sign in, and
-- what is this person called".
create table if not exists public.members (
  -- Trimmed and lower-cased at the door. Every lookup normalizes the same way,
  -- and the constraint is here so a hand-written insert cannot create a row
  -- that no lookup will ever match.
  email text primary key check (email = lower(email) and email <> ''),
  -- The number the export keys on. Carried so a row can be traced back to the
  -- membership system when someone disputes being on or off the list.
  member_id text,
  first_name text not null default '',
  last_name text not null default '',
  -- Which of the borough's five districts they joined under. Recorded, not yet
  -- used: the forum covers the whole borough.
  district text,
  joined_on date,
  -- Null means a membership with no end date. A date in the past closes the
  -- account out — see `membership_status`.
  expires_on date,
  synced_at timestamptz not null default now()
);

-- Twenty invented residents, so the demo community can still post.
--
-- `supabase/demo-seed.sql` builds a forum with people in it, and every one of
-- them is now a non-member who would be refused at the door — the seed would
-- fail on its first insert into auth.users. It writes its residents onto the
-- roster instead, marked here, and the marker is what keeps `npm run members`
-- from deleting them the next time the real export is loaded. Nothing else
-- reads this column: a seeded row grants exactly what a real one does, which is
-- the point of seeding it.
alter table public.members
  add column if not exists seeded boolean not null default false;

alter table public.members enable row level security;

-- Deliberately no policies. RLS with no policy denies everything, which is the
-- intent: the roster is a list of named people who paid a political party, and
-- nothing signed in or anonymous may read a row of it. The two functions below
-- are `security definer` and are the only way to ask it a question — and each
-- answers about one address at a time, never with a list.
--
-- Loading it is `npm run members`, which connects as the database owner and so
-- passes over RLS entirely.

-- 2. Asking the roster a question ---------------------------------------------

/*
 * One of 'ok', 'expired' or 'unknown', for an address that may not exist.
 *
 * Officials pass without being on the roster. Their accounts are recognised by
 * the @montreal.ca domain (see `is_official_email` in 0003) and they are the
 * people the forum exists to reach — a borough councillor is not required to
 * hold a party card, and gating sign-in on the roster alone would have quietly
 * locked every official answer and the whole moderation queue out of the site.
 *
 * This is an oracle: anyone may ask it whether a given address is a member, and
 * get a straight answer. That is a real disclosure and it is a wider one than
 * the sign-in dialog already made — "no account for that address" leaked who
 * had signed up, this leaks who paid a party. It is accepted for the same
 * reason as before: the alternative is a person mistyping their address, being
 * told nothing, and waiting for a code that is never coming. Supabase's own
 * rate limit on the sign-in endpoint is what stands between this and a scraper.
 */
create or replace function public.membership_status(addr text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  normalized text := lower(trim(coalesce(addr, '')));
  expiry date;
begin
  if normalized = '' then
    return 'unknown';
  end if;

  if public.is_official_email(normalized) then
    return 'ok';
  end if;

  select m.expires_on into expiry from public.members m where m.email = normalized;

  -- `found` is plpgsql's, set by the select above; there is no local by that
  -- name shadowing it.
  if not found then
    return 'unknown';
  end if;

  if expiry is not null and expiry < current_date then
    return 'expired';
  end if;

  return 'ok';
end;
$$;

grant execute on function public.membership_status(text) to anon, authenticated;

/*
 * The same question about whoever is making the current request.
 *
 * Reads the address out of the verified JWT rather than out of auth.users: the
 * token is signed by the auth server and this runs on every insert covered by
 * the policies below, where a second table read per row is a cost with nothing
 * to show for it.
 */
create or replace function public.viewer_is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.membership_status((select auth.jwt() ->> 'email')) = 'ok'
$$;

grant execute on function public.viewer_is_member() to authenticated;

-- 3. No account for a non-member ----------------------------------------------

/*
 * Replaces the version in 0001, which took the name from the metadata the
 * sign-up form sent along.
 *
 * Raising here aborts the insert into auth.users, so the account is never made.
 * The caller sees a generic "database error saving new user"; the readable
 * refusal is `membership_status`, checked by the dialog before a code is sent.
 * This is the backstop for the request that skipped the dialog.
 *
 * The name comes from the roster first. There is no sign-up form any more, so
 * for a member there is no other source and nothing to argue with — which is
 * also why nobody can post under a name they invented at the door.
 *
 * Officials have no roster row, so the two fallbacks are for them. Metadata
 * next, which is how the demo seed gives the four councillors their real names,
 * and how an official signing in from a client that sends one still gets to
 * spell their own. Then the local part of the address, because city addresses
 * are firstname.lastname@montreal.ca and a guess at the name beats the two
 * empty strings that would otherwise sit above their first answer.
 */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(trim(coalesce(new.email, '')));
  status text := public.membership_status(normalized);
  given text;
  family text;
  parts text[];
begin
  if status <> 'ok' then
    raise exception 'address % is not an active membership (%)', normalized, status
      using errcode = '42501';
  end if;

  select nullif(m.first_name, ''), nullif(m.last_name, '') into given, family
  from public.members m where m.email = normalized;

  given := coalesce(given, nullif(new.raw_user_meta_data ->> 'first_name', ''));
  family := coalesce(family, nullif(new.raw_user_meta_data ->> 'last_name', ''));

  if given is null and family is null then
    parts := string_to_array(split_part(normalized, '@', 1), '.');
    given := initcap(coalesce(parts[1], ''));
    family := initcap(coalesce(array_to_string(parts[2:], ' '), ''));
  end if;

  insert into public.profiles (id, first_name, last_name)
  values (new.id, coalesce(given, ''), coalesce(family, ''));

  return new;
end;
$$;

-- 4. No posting by a non-member ------------------------------------------------

-- Each of these is the existing policy with one more conjunct. The author check
-- is unchanged and still does its own job; membership is added beside it rather
-- than in place of it.

drop policy if exists "Authenticated users can create issues" on public.issues;
create policy "Authenticated users can create issues"
  on public.issues for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and public.viewer_is_member()
  );

drop policy if exists "Authenticated users can comment" on public.comments;
create policy "Authenticated users can comment"
  on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (is_official = false or public.is_official((select auth.uid())))
    and public.viewer_is_member()
  );

drop policy if exists "Users can cast their own vote" on public.votes;
create policy "Users can cast their own vote"
  on public.votes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.viewer_is_member()
  );

-- Retracting a backing is deliberately left alone. Someone whose membership has
-- lapsed should still be able to take their name off a topic they backed; the
-- gate is on adding your name to the site, not on removing it.
