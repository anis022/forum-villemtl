-- Which borough a resident is here about.
--
-- The forum was written for one borough and said so in its map bounds, its
-- copy and its officials list. This column is the first half of undoing that:
-- the site can now record that a choice exists and belongs to a person, before
-- any page changes behaviour because of it.
--
-- Deliberately a plain text column with a check rather than an enum or a
-- boroughs table. A Postgres enum cannot have a value removed, and a lookup
-- table would have to be seeded and joined for a list that is nineteen rows
-- long and changes when the city amalgamates something, which is to say almost
-- never. The application holds the same list in utils/boroughs.ts and is the
-- side that renders names in two languages; this constraint only stops a typo
-- from reaching the table.
--
-- Only the borough that has data is allowed. Widening the check is the
-- migration that goes with adding a borough to utils/boroughs.ts.

alter table public.profiles
  add column if not exists borough text not null default 'cdn-ndg';

alter table public.profiles
  drop constraint if exists profiles_borough_known;

alter table public.profiles
  add constraint profiles_borough_known check (borough in ('cdn-ndg'));

-- The existing "users can update their own profile" policy already covers
-- writes to this column: it is scoped to the row, not to a column list.
