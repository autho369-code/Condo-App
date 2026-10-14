-- A removed late fee reads "removed", not "paid".
--
-- remove_late_fee credits the open amount of a late fee with a payments row
-- (method 'credit', reference 'Late fee removed', charge_id = the fee) and
-- applies it to the fee, so v_charge_balances showed the fee as "paid" on
-- the owner's ledger and the unit page. Balances, applications and journal
-- entries are unchanged; only the status label is.
--
-- Rule: payment_status = 'removed' when the late fee's balance is zero or
-- less and a removal credit (not reversed) is applied to it. A fee partly
-- paid and the rest removed also reads 'removed' (the ledger lines show the
-- payment and the removal). Every other charge keeps paid / outstanding /
-- partial.
--
-- is_past_due now uses the association's local date (Product Rules), not the
-- database's UTC date. Only charges with an open balance due on or before
-- the UTC date look the date up (a local date is at most one day ahead of
-- UTC, so no past-due charge is missed). If the caller can't read the
-- association, the UTC date is used.
--
-- Same columns, types and order; still security_invoker (the caller's access
-- rules apply); still one LATERAL sum per charge (20261014060000).

create or replace view public.v_charge_balances
with (security_invoker = true) as
select c.id as charge_id,
       c.unit_id,
       c.assessment_period_id,
       c.charge_type,
       c.description,
       c.amount as charged_amount,
       coalesce(pa.paid, 0::numeric) as applied_amount,
       c.amount - coalesce(pa.paid, 0::numeric) as balance_due,
       c.due_date,
       case
         when c.amount - coalesce(pa.paid, 0::numeric) <= 0::numeric
              and c.charge_type = 'late_fee'
              and exists (
                select 1
                  from public.payment_applications ra
                  join public.payments rp on rp.id = ra.payment_id
                 where ra.charge_id = c.id
                   and rp.method = 'credit'
                   and rp.reference = 'Late fee removed'
                   and rp.reversed_at is null
              ) then 'removed'::text
         when c.amount - coalesce(pa.paid, 0::numeric) <= 0::numeric then 'paid'::text
         when coalesce(pa.paid, 0::numeric) = 0::numeric then 'outstanding'::text
         else 'partial'::text
       end as payment_status,
       case
         when c.amount - coalesce(pa.paid, 0::numeric) > 0::numeric
              and c.due_date <= (pg_catalog.now() at time zone 'UTC')::date
              and c.due_date < coalesce((
                select (pg_catalog.now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date
                  from public.units u
                  join public.buildings b on b.id = u.building_id
                  join public.associations a on a.id = b.association_id
                 where u.id = c.unit_id
              ), (pg_catalog.now() at time zone 'UTC')::date) then true
         else false
       end as is_past_due
  from public.charges c
  left join lateral (
    select sum(p.amount_applied) as paid
      from public.payment_applications p
     where p.charge_id = c.id
  ) pa on true;

-- Only remove_late_fee (a database function) marks a credit as a removed
-- late fee: signed-in users can't write that reference on a payment, change
-- it on one that has it, or change such a credit's method.
create or replace function public.payments_late_fee_removed_marker()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.reference = 'Late fee removed')
       or (tg_op = 'UPDATE' and new.reference is distinct from old.reference
           and (new.reference = 'Late fee removed' or old.reference = 'Late fee removed'))
       or (tg_op = 'UPDATE' and old.reference = 'Late fee removed' and new.method is distinct from old.method) then
      raise exception 'Late fees are removed from the unit page' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.payments_late_fee_removed_marker() from public, anon, authenticated;

create or replace trigger trg_payments_late_fee_removed_marker
  before insert or update of reference, method on public.payments
  for each row execute function public.payments_late_fee_removed_marker();
