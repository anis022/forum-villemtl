-- The staff roster on the platform must match `staff emails.txt`.
--
-- Three office members now use personal addresses instead of the municipal
-- addresses introduced in 0026. The other six addresses already match. The
-- public.staff row is the actual authorization: it lets the address sign in,
-- and a confirmed account on that row receives role = 'official' (the app's
-- administrator role) from the existing auth triggers.

-- 1. Refuse an ambiguous account merge ----------------------------------------

-- Moving an existing account is safe only while the destination address does
-- not already belong to a different account. Fail before changing anything if
-- that ever stops being true; the migration runner wraps this file in a
-- transaction, so a failure leaves the roster untouched.
do $$
begin
  if exists (
    with moves (old_email, new_email) as (
      values
        ('guillaume.pelletier@montreal.ca',        'guillaume.pelletier50@gmail.com'),
        ('alexandre.degardin-sagnier@montreal.ca', 'alex1dega@gmail.com'),
        ('zakaria.sabek@montreal.ca',              'zakariasabek444@gmail.com')
    )
    select 1
      from moves m
      join auth.users old_user on lower(trim(old_user.email)) = m.old_email
      join auth.users new_user on lower(trim(new_user.email)) = m.new_email
     where old_user.id <> new_user.id
  ) then
    raise exception 'staff email move would merge two different auth accounts';
  end if;
end;
$$;

-- 2. The exact nine-address authorization list -------------------------------

insert into public.staff (email, first_name, last_name, elected) values
  ('guillaume.pelletier50@gmail.com',      'Guillaume',  'Pelletier',        false),
  ('alex1dega@gmail.com',                  'Alexandre',   'Degardin-Sagnier', false),
  ('zakariasabek444@gmail.com',            'Zakaria',     'Sabek',            false),
  ('anis.benabdallah@etud.polymtl.ca',     'Anis',        'Benabdallah',       false),
  ('alexandra@ensemblemtl.org',            'Alexandra',   null,                false),
  ('sonny.moroz@ensemblemtl.org',          'Sonny',       'Moroz',             true),
  ('stephanie.valenzuela@ensemblemtl.org', 'Stéphanie',   'Valenzuela',        true),
  ('alexandre.teodoresco@ensemblemtl.org', 'Alexandre',   'Teodoresco',        true),
  ('milany.thiagarajah@ensemblemtl.org',   'Milany',      'Thiagarajah',       true)
on conflict (email) do update set
  first_name = excluded.first_name,
  last_name  = excluded.last_name,
  elected    = excluded.elected,
  seeded     = false;

-- 3. Keep an existing account when its address changes ------------------------

-- GoTrue reads the address from both auth.users and the identity payload. The
-- identity goes first while the old auth.users address can still identify the
-- account, matching the safe order used in migrations 0029 and 0030.
with moves (old_email, new_email) as (
  values
    ('guillaume.pelletier@montreal.ca',        'guillaume.pelletier50@gmail.com'),
    ('alexandre.degardin-sagnier@montreal.ca', 'alex1dega@gmail.com'),
    ('zakaria.sabek@montreal.ca',              'zakariasabek444@gmail.com')
)
update auth.identities i
   set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(m.new_email)),
       updated_at = now()
  from moves m, auth.users u
 where lower(trim(u.email)) = m.old_email
   and i.user_id = u.id;

with moves (old_email, new_email) as (
  values
    ('guillaume.pelletier@montreal.ca',        'guillaume.pelletier50@gmail.com'),
    ('alexandre.degardin-sagnier@montreal.ca', 'alex1dega@gmail.com'),
    ('zakaria.sabek@montreal.ca',              'zakariasabek444@gmail.com')
)
update auth.users u
   set email = m.new_email,
       updated_at = now()
  from moves m
 where lower(trim(u.email)) = m.old_email;

-- The old aliases must not remain parallel administrator credentials. Their
-- accounts, where they existed, have just moved to the requested addresses.
delete from public.staff
 where email in (
   'guillaume.pelletier@montreal.ca',
   'alexandre.degardin-sagnier@montreal.ca',
   'zakaria.sabek@montreal.ca'
 );

-- 4. Recompute every existing account -----------------------------------------

-- Future accounts are handled by handle_new_user/sync_profile_role. Existing
-- ones are recomputed now so the database is correct immediately after this
-- migration, including the account whose email moved above.
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
