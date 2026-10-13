-- Codex on #347: keep a payment and the charges it paid on the same unit when
-- either one's unit changes.
--
-- 20261014010000 checks the pair when an application is written, but a
-- finance user could then move the payment or the charge to another unit
-- (both tables allow finance updates), leaving the application linked across
-- units and the two ledgers wrong. Nothing in the app or in the database
-- functions moves a payment or charge to another unit, so the unit is now
-- fixed once the row has applications: un-apply first (reallocate or reverse)
-- to move it. Every caller, the service role included.

create or replace function public.enforce_applied_row_unit_fixed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_applied boolean;
begin
  if new.unit_id is not distinct from old.unit_id then
    return new;
  end if;
  if tg_table_name = 'payments' then
    v_applied := exists (select 1 from public.payment_applications pa where pa.payment_id = old.id);
  else
    v_applied := exists (select 1 from public.payment_applications pa where pa.charge_id = old.id);
  end if;
  if v_applied then
    raise exception 'This % is applied, so its unit cannot change. Remove the application first.',
      case when tg_table_name = 'payments' then 'payment' else 'charge' end
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.enforce_applied_row_unit_fixed() from public, anon, authenticated;

create or replace trigger trg_payments_applied_unit_fixed
  before update of unit_id on public.payments
  for each row execute function public.enforce_applied_row_unit_fixed();

create or replace trigger trg_charges_applied_unit_fixed
  before update of unit_id on public.charges
  for each row execute function public.enforce_applied_row_unit_fixed();
