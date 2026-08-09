-- Letting somebody leave.
--
-- Closing an account is the one operation on this site that a resident must be
-- able to perform and the site must not be able to refuse. It is also the one
-- that cannot go through an ordinary policy: it deletes a row in `auth.users`,
-- a schema no policy of ours governs, and doing it from the application would
-- mean holding a service key in the runtime for the sake of a button pressed
-- twice a year.
--
-- So it is a SECURITY DEFINER function that deletes exactly one row — the
-- caller's own. `auth.uid()` is read inside the function, so there is no
-- argument to forge: a caller can only ever close the account they are signed
-- in as.
--
-- What happens to the words is the part worth arguing about.
--
-- Deleting them outright would be the tidier promise, and it is the wrong one
-- here. A report carries other people's replies and other people's backing;
-- removing it takes their contributions with it and leaves a thread that no
-- longer reads. This is a public forum whose whole value is that an exchange
-- between residents and their borough stays legible afterwards.
--
-- So the identity goes and the words stay: the account, the address, the name
-- and the photograph are deleted, and every post is detached from whoever wrote
-- it. That is severance, not anonymisation in the regulatory sense — a
-- determined reader could still recognise somebody by what they described — and
-- the policy page says exactly that rather than promising more. Anyone who
-- wants their words gone as well can withdraw them first, which they have
-- always been able to do.

-- 1. An author is now optional ------------------------------------------------
--
-- Nullable rather than re-pointed at a placeholder profile. The read path
-- already tolerates it end to end: `toAuthor` maps a missing profile to empty
-- names, and `authorName` turns empty names into the dictionary's "Citoyen·ne".
-- A tombstone row would have needed the foreign key on `profiles.id` weakened
-- to let a profile exist with no user behind it, which is a worse trade than a
-- null.

alter table public.issues   alter column author_id drop not null;
alter table public.comments alter column author_id drop not null;

comment on column public.issues.author_id is
  'Null once the author has closed their account. The post stays; the person is'
  ' detached from it. See public.close_my_account().';

comment on column public.comments.author_id is
  'Null once the author has closed their account. See public.issues.author_id.';

/*
 * The INSERT policies still say `auth.uid() = author_id`, which a null can
 * never satisfy — so nothing can be posted anonymously through this loosening.
 * Only the function below ever writes a null, and it owns that write.
 */

-- 2. Closing ------------------------------------------------------------------

create or replace function public.close_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  -- Words first, while the rows still exist to be detached. Deleting the user
  -- ahead of this would cascade them away before they could be kept.
  update public.issues   set author_id = null where author_id = me;
  update public.comments set author_id = null where author_id = me;

  -- Backing is an opinion attached to a person and nothing else. There is no
  -- version of it worth keeping once the person is gone.
  delete from public.votes where user_id = me;

  -- Cascades to `profiles`, and from there to everything still pointing at it —
  -- including `edited_by` and `cleared_by`, which are ON DELETE SET NULL. That
  -- is the right outcome for both: that an edit happened stays part of the
  -- record, who made it was part of the person.
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.close_my_account() from public;
grant execute on function public.close_my_account() to authenticated;
