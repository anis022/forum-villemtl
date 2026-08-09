-- Destroying what no longer has a reason to exist.
--
-- This migration deliberately covers one thing and not the others, and the
-- boundary is worth stating because it looks like an omission.
--
-- The borough is a *public body*. Destroying its records is not a decision the
-- application gets to make: it is governed by an approved calendrier de
-- conservation under the Loi sur les archives, and a cron job quietly deleting
-- reports would be a breach of that rather than compliance with anything.
-- Reports, replies and the council record therefore stay until somebody with
-- the authority to write that schedule has written it.
--
-- What this covers is the one class the forum created for itself, that serves a
-- purpose which visibly ends, and that no archival schedule speaks to: a
-- suspicion raised by the matcher in migration 0020 and then dismissed by an
-- elected official.
--
-- Once a person has read a message and decided it was fine, the record that a
-- program once doubted it has done its work. Keeping it is keeping a note about
-- a resident's conduct that says only "someone checked, and it was nothing".
-- Twelve months is enough for a pattern of dismissals to be reviewable and short
-- enough that it does not become a file on anybody.
--
-- Open flags are never touched. A queue that empties itself is a queue that
-- launders the work of not reading it.

create or replace function public.purge_cleared_flags(p_months int default 12)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.moderation_flags
   where cleared_at is not null
     and cleared_at < now() - make_interval(months => p_months);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.purge_cleared_flags(int) is
  'Deletes dismissed moderation flags older than N months. Open flags are never'
  ' touched. Called by /api/cron/retention; see migration 0022 for why this is'
  ' the only class the application destroys on its own.';

revoke all on function public.purge_cleared_flags(int) from public;
