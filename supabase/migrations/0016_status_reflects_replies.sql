-- Reopening a report forgot that it had already been answered.
--
-- The three states were only ever set forwards: an official reply flipped
-- `open` to `answered`, closing set `resolved`, and reopening wrote back a
-- hardcoded `open`. So a thread that had been answered, closed, then reopened
-- came back claiming nobody had replied — while the official's answer sat right
-- there in the comments contradicting it.
--
-- The same assumption breaks in the other direction now that officials can
-- delete comments: removing the only official reply left the report still
-- badged "Répondu", because the delete branch of the counter trigger only ever
-- adjusted the number.
--
-- Both come from storing a fact that is really a derivation. `status` has to
-- stay a column — the feed sorts and filters on it, and recomputing it per row
-- on every read would be a join against the comments table for the whole page —
-- so instead the derivation gets a name, and everything that can invalidate it
-- calls that name rather than guessing.

/**
 * What an unresolved report's status should be, from the replies it actually
 * has. Deliberately not aware of `resolved`: closing is a judgement an official
 * makes, not something the comments can tell you.
 */
create or replace function public.unresolved_status(p_issue_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.comments
      where issue_id = p_issue_id and is_official
    ) then 'answered'
    else 'open'
  end
$$;

/*
 * Reopening asks for `open`; what it means is "no longer resolved". Those are
 * the same thing only when nobody has answered, so the request is normalised
 * here rather than trusted. Setting `answered` or `resolved` explicitly is
 * untouched — an official may still mark either.
 */
create or replace function public.set_issue_status(p_issue_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target text;
begin
  if not public.is_official(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('open', 'answered', 'resolved') then
    raise exception 'invalid status';
  end if;

  target := case
    when p_status = 'open' then public.unresolved_status(p_issue_id)
    else p_status
  end;

  update public.issues set status = target where id = p_issue_id;
end;
$$;

/*
 * The counter trigger, taught the same rule. On insert it still only ever
 * promotes `open` to `answered`; on delete it recomputes, so pulling the last
 * official reply drops the badge with it.
 *
 * A resolved report is left alone in both directions: an official decided it
 * was settled, and deleting a comment is not a reversal of that.
 */
create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.issues
       set comment_count = comment_count + 1,
           -- An official reply flips the issue into the "answered" state.
           status = case when new.is_official and status = 'open' then 'answered' else status end
     where id = new.issue_id;
  elsif tg_op = 'DELETE' then
    update public.issues
       set comment_count = greatest(comment_count - 1, 0),
           status = case
             when status = 'resolved' then status
             else public.unresolved_status(old.issue_id)
           end
     where id = old.issue_id;
  end if;
  return null;
end;
$$;

/*
 * Repair what the old behaviour already wrote. Reports sitting at `open` with
 * an official reply on them were reopened at some point and lost the badge;
 * ones at `answered` with no official reply had it deleted out from under them.
 */
update public.issues i
   set status = public.unresolved_status(i.id)
 where i.status <> 'resolved'
   and i.status <> public.unresolved_status(i.id);
