-- security-reviewer on this PR: a payment can only be applied to a charge on
-- its own unit.
--
-- payment_apps_finance and payment_apps_resident_read check the payment
-- side only; charge_id was never checked for callers who are not limited to
-- some associations, and nothing tied the charge to the payment's unit. A
-- finance user with another company's charge id could link one of their own
-- payments to it. Every writer already pairs a payment with a charge on the
-- same unit (apply_payment, auto_apply_new_payment, auto_apply_credit_on_new_charge,
-- reallocate_payment, reverse_homeowner_payment); the database now enforces
-- it for every caller, including the service role. Production had no
-- payment_applications rows when this was added.

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
  select p.unit_id into v_payment_unit from public.payments p where p.id = new.payment_id;
  select c.unit_id into v_charge_unit from public.charges c where c.id = new.charge_id;
  if v_payment_unit is null or v_charge_unit is null or v_payment_unit <> v_charge_unit then
    raise exception 'A payment can only be applied to a charge on the same unit'
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.enforce_payment_application_same_unit() from public, anon, authenticated;

create or replace trigger trg_payment_application_same_unit
  before insert or update of payment_id, charge_id on public.payment_applications
  for each row execute function public.enforce_payment_application_same_unit();
