-- Codex on #348: an application and a unit move cannot race.
--
-- 20261014010000 checks that an application's payment and charge are on the
-- same unit; 20261014020000 refuses moving an applied payment or charge.
-- Run at the same time, each check could miss the other's uncommitted row
-- and both commit, leaving a cross-unit link (the foreign key's key-share
-- lock does not conflict with updating unit_id). The application check now
-- reads the payment and the charge FOR SHARE, which conflicts with any
-- update of those rows: a unit move started first makes the application
-- wait and then see the new unit (refused); an application started first
-- makes the move wait, and the move's check then sees the committed
-- application (refused). Same messages as before.

create or replace function public.enforce_payment_application_same_unit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment_unit uuid;
  v_charge_unit uuid;
begin
  select p.unit_id into v_payment_unit from public.payments p where p.id = new.payment_id for share;
  select c.unit_id into v_charge_unit from public.charges c where c.id = new.charge_id for share;
  if v_payment_unit is null or v_charge_unit is null or v_payment_unit <> v_charge_unit then
    raise exception 'A payment can only be applied to a charge on the same unit'
      using errcode = '23514';
  end if;
  return new;
end
$$;
