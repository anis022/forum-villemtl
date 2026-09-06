-- Three grants that are wider than the migrations that made them intended.
--
-- Postgres gives EXECUTE on a new function to PUBLIC unless you take it away.
-- A `grant execute … to authenticated` therefore adds nothing and removes
-- nothing: the function was already callable by everybody, including `anon`,
-- and Supabase publishes every function in `public` at /rest/v1/rpc/<name> to
-- anyone holding the anon key — which is shipped to every browser by design.
--
-- Migration 0035 did the revoke. The ones after it did not.

-- 1. purge_cleared_flags -----------------------------------------------------
--
-- The serious one. It is `security definer`, it deletes from
-- `moderation_flags`, and it checks nothing: no `auth.uid()`, no
-- `is_official`. `p_months => 0` reads as "cleared before now" and takes the
-- lot. An unauthenticated caller could erase the borough's moderation history,
-- which is the record the privacy policy promises to keep for twelve months.
--
-- Its only caller is the weekly retention cron in `app/api/cron/retention`,
-- which connects with the service key, and `service_role` keeps its grant.

revoke all on function public.purge_cleared_flags(integer) from public;
revoke all on function public.purge_cleared_flags(integer) from anon;
revoke all on function public.purge_cleared_flags(integer) from authenticated;

-- 2. create_poll_topic -------------------------------------------------------
--
-- Not exploitable: the body raises unless `auth.uid()` is a member. Narrowed
-- anyway, so the grant says what the migration meant and the next reader does
-- not have to open the body to find out.

revoke all on function public.create_poll_topic(text, text, text, text, jsonb, boolean, boolean, smallint) from public;
revoke all on function public.create_poll_topic(text, text, text, text, jsonb, boolean, boolean, smallint) from anon;
grant execute on function public.create_poll_topic(text, text, text, text, jsonb, boolean, boolean, smallint)
  to authenticated;

-- 3. create_poll -------------------------------------------------------------
--
-- Superseded by `create_poll_topic` in 0036, which also dropped
-- `polls.question` and `polls.description` out from under it. It has raised
-- `column "question" of relation "polls" does not exist` on every call since,
-- and it is still granted to `authenticated`. `scripts/db/polls-check.ts` calls
-- it, which is why that check has been failing rather than checking.

drop function if exists public.create_poll(text, text, text[], text, boolean, boolean, integer);
