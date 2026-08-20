-- One more address leaves the city domain.
--
-- Same move as 0029 and for the same reason, one row further down the list:
-- anis.benabdallah@montreal.ca becomes anis.benabdallah@etud.polymtl.ca.
--
-- The account matters here in a way it did not for Alexandra, who has none.
-- This address has one, it carries the 'official' role, and dropping the old
-- address from the list without moving the account would do two things at
-- once: demote the profile to 'citizen' on the next email change, and leave
-- the person unable to get back in under either address. The old one would no
-- longer be on the list, and the new one would be a stranger to it, so
-- membership_status() would answer 'unknown' both ways. Moving the address
-- keeps the account, the role, and the id.
--
-- The three who remain on @montreal.ca are city staff and stay there.

-- 1. The list -----------------------------------------------------------------

update public.staff
   set email = 'anis.benabdallah@etud.polymtl.ca'
 where email = 'anis.benabdallah@montreal.ca'
   and not exists (
     select 1 from public.staff t where t.email = 'anis.benabdallah@etud.polymtl.ca'
   );

-- 2. The account ---------------------------------------------------------------

-- Identity first, while auth.users still holds the old address to join on.
-- Without this row GoTrue does not accept the new address as belonging to the
-- account and the sign-in code is never sent.
update auth.identities i
   set identity_data = jsonb_set(
         i.identity_data, '{email}', to_jsonb('anis.benabdallah@etud.polymtl.ca'::text)
       ),
       updated_at = now()
  from auth.users u
 where u.email = 'anis.benabdallah@montreal.ca'
   and i.user_id = u.id;

update auth.users u
   set email = 'anis.benabdallah@etud.polymtl.ca',
       updated_at = now()
 where u.email = 'anis.benabdallah@montreal.ca'
   and not exists (
     select 1 from auth.users x where x.email = 'anis.benabdallah@etud.polymtl.ca'
   );

-- 3. Role and seat, recomputed --------------------------------------------------

-- The trigger on the email change has already done this, given step 1 ran
-- first. Repeated for the same reason 0029 repeats it: the order of the two is
-- what stands between 'official' and a profile quietly demoted, and one scan is
-- cheaper than trusting it.
update public.profiles p
   set role = case when o.on_staff then 'official' else 'citizen' end,
       elected = o.on_staff and o.is_elected
  from (
    select u.id,
           u.email_confirmed_at is not null and s.email is not null as on_staff,
           coalesce(s.elected, false) as is_elected
      from auth.users u
      left join public.staff s on s.email = lower(trim(coalesce(u.email, '')))
  ) o
 where o.id = p.id;
