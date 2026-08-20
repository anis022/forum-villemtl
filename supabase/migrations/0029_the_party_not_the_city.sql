-- The office writes from the party's domain, not the city's.
--
-- Migration 0026 built the staff list out of @montreal.ca addresses, on the
-- reasonable assumption that people who sit on a borough council are reachable
-- at the borough. For the four who were elected, and for one of the staffers,
-- that is not the address they actually use: they write from ensemblemtl.org.
--
-- This is not cosmetic. `is_official_email()` reads this table and nothing
-- else, `membership_status()` calls it, and `handle_new_user()` refuses to
-- create an account for an address it does not recognise. An address that is
-- wrong here is a locked door: the person asks for a code at the address that
-- is really theirs, the list says no, and they are turned away from a forum
-- built for them to answer on.
--
-- The five who stay on @montreal.ca stay. They are city staff and that is
-- where they work; only the elected four and Alexandra move.

-- 1. The list -----------------------------------------------------------------

-- Updated in place rather than deleted and re-inserted, so `added_at`, the
-- `elected` flag and the spelling of each name survive the move. The guard on
-- the target address makes a second run a no-op instead of a primary key
-- violation.
with moves (old_email, new_email) as (
  values
    ('stephanie.valenzuela@montreal.ca', 'stephanie.valenzuela@ensemblemtl.org'),
    ('milany.thiagarajah@montreal.ca',   'milany.thiagarajah@ensemblemtl.org'),
    ('alexandre.teodoresco@montreal.ca', 'alexandre.teodoresco@ensemblemtl.org'),
    ('sonny.moroz@montreal.ca',          'sonny.moroz@ensemblemtl.org'),
    -- Her address carries no surname, so the fallback in `handle_new_user()`
    -- will call her "Alexandra" and stop there rather than deriving "Damours"
    -- off the old address. Left null here for the same reason 0026 left it
    -- null: a name in this table wins, and it should be written by someone who
    -- knows how she spells it, not guessed from a mailbox.
    ('alexandra.damours@montreal.ca',    'alexandra@ensemblemtl.org')
)
update public.staff s
   set email = m.new_email
  from moves m
 where s.email = m.old_email
   and not exists (select 1 from public.staff t where t.email = m.new_email);

-- 2. The accounts that already exist -------------------------------------------

-- The four elected have accounts, created when the demonstration community was
-- cleared out, and their ids are written into utils/officials.ts so the /elus
-- page can link to a profile without a round trip. Moving the address rather
-- than making new accounts is what keeps those ids, and with them every link
-- on that page.
--
-- The identity row goes first, while auth.users still holds the old address to
-- join on. Without it GoTrue does not recognise the new address as belonging to
-- the account and the sign-in code never leaves.
with moves (old_email, new_email) as (
  values
    ('stephanie.valenzuela@montreal.ca', 'stephanie.valenzuela@ensemblemtl.org'),
    ('milany.thiagarajah@montreal.ca',   'milany.thiagarajah@ensemblemtl.org'),
    ('alexandre.teodoresco@montreal.ca', 'alexandre.teodoresco@ensemblemtl.org'),
    ('sonny.moroz@montreal.ca',          'sonny.moroz@ensemblemtl.org')
)
update auth.identities i
   set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(m.new_email)),
       updated_at = now()
  from moves m, auth.users u
 where u.email = m.old_email
   and i.user_id = u.id;

with moves (old_email, new_email) as (
  values
    ('stephanie.valenzuela@montreal.ca', 'stephanie.valenzuela@ensemblemtl.org'),
    ('milany.thiagarajah@montreal.ca',   'milany.thiagarajah@ensemblemtl.org'),
    ('alexandre.teodoresco@montreal.ca', 'alexandre.teodoresco@ensemblemtl.org'),
    ('sonny.moroz@montreal.ca',          'sonny.moroz@ensemblemtl.org')
)
update auth.users u
   set email = m.new_email,
       updated_at = now()
  from moves m
 where u.email = m.old_email
   and not exists (select 1 from auth.users x where x.email = m.new_email);

-- 3. Role and seat, recomputed -------------------------------------------------

-- `sync_profile_role` fires on an email change and reads the list, so step 2
-- has already set these correctly given step 1 ran first. This repeats the work
-- anyway, exactly as 0026 does, because the order of the two is the only thing
-- standing between "official" and a profile quietly demoted to "citizen", and a
-- statement that costs one scan is cheaper than trusting that.
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
