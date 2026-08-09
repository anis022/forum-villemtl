-- What is published stays as it was written.
--
-- Editing was built in two halves — migration 0011 for reports, 0015 for
-- comments — and both carried the same worry in their comments: an edit nobody
-- can see is indistinguishable from censorship, so the row recorded who changed
-- it and the page said so out loud. That machinery was the mitigation for a
-- power the forum did not have to hand out in the first place.
--
-- A thread where the words can change under a reply is a thread nobody can hold
-- anyone to. Someone answers "je ne suis pas d'accord avec ça", the sentence
-- they disagreed with is rewritten, and the reply now reads as an attack on a
-- position nobody took. Voting makes it worse: a report can be backed by two
-- hundred residents and then say something else entirely, carrying their
-- support with it. The trace explained who did that; it never stopped it.
--
-- So the answer to a mistake is now the same for everyone: withdraw it and file
-- again. That costs the author their votes and their replies, which is exactly
-- the point — it is a new statement, and it starts from nothing.
--
-- Deleting is untouched. An author may still withdraw their own words and an
-- official may still remove anything, because taking a whole message away is
-- visible in a way that changing its words is not: the reply that answered it
-- is left standing, and the gap is legible.

-- 1. Reports ----------------------------------------------------------------

drop policy if exists "Authors can update their own issues" on public.issues;
drop policy if exists "Officials can update any issue" on public.issues;

-- 2. Comments ---------------------------------------------------------------

drop policy if exists "Authors can edit their own comments" on public.comments;
drop policy if exists "Officials can moderate comments" on public.comments;

/*
 * `public.freeze_comment_position` (migration 0015) is deliberately left in
 * place. With no UPDATE policy on the table nothing routed through PostgREST
 * can fire it, but `set_issue_status` and the counter triggers are SECURITY
 * DEFINER and run past RLS — and the next such function somebody writes will
 * too. A trigger that pins a comment to its thread is worth keeping for the
 * paths that do not go through a policy at all.
 *
 * Status changes and the vote and comment counters are unaffected by this
 * migration for the same reason: `set_issue_status`, `sync_vote_count` and
 * `sync_comment_count` all own their writes as SECURITY DEFINER and never
 * relied on an UPDATE policy being present.
 */

-- 3. What the old columns mean now -------------------------------------------
-- Kept, not dropped: rows edited before today still carry these, and the pages
-- still say "modifié le …" where they do. Dropping them would quietly rewrite
-- the history of every post that had been corrected, which is the exact thing
-- this migration exists to prevent.

comment on column public.issues.edited_at is
  'Historical. Editing was removed in migration 0019; no new row will ever set this. Rows that carry it were edited while that was possible, and the page still says so.';

comment on column public.comments.edited_at is
  'Historical. See public.issues.edited_at — editing was removed in migration 0019.';
