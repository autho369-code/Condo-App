-- Codex on #383 (P1): the "removed" label trusted payment_applications,
-- which finance staff can write directly (payment_apps_finance). Copying or
-- moving a removal credit's application onto another late fee would have
-- labelled that fee "removed" without remove_late_fee, its journal entry or
-- its audit record.
--
-- 1. The label also requires the removal credit to name this very fee
--    (payments.charge_id, set by remove_late_fee), and signed-in users can't
--    change charge_id on a removal credit.
-- 2. Signed-in users can't add or change applications of a removal credit.
--    Deleting one stays allowed (unapply_payment): the fee then honestly
--    reads outstanding again.
-- Only database functions (remove_late_fee, apply/reverse functions, all
-- security definer) write them. Production has no removal credits yet.

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
                   and rp.charge_id = c.id
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
       or (tg_op = 'UPDATE' and old.reference = 'Late fee removed'
           and (new.method is distinct from old.method or new.charge_id is distinct from old.charge_id)) then
      raise exception 'The reference "Late fee removed" is reserved. Remove late fees from the unit page' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.payments_late_fee_removed_marker() from public, anon, authenticated;

create or replace trigger trg_payments_late_fee_removed_marker
  before insert or update of reference, method, charge_id on public.payments
  for each row execute function public.payments_late_fee_removed_marker();

-- Applications of a removal credit: only database functions add or change
-- them. The trigger runs as the caller (so current_user tells a signed-in
-- user from a database function); the lookup is a security definer helper
-- so it sees the payment whatever the caller's row access.
create or replace function public.is_late_fee_removal_credit(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1 from public.payments p
     where p.id = p_payment_id and p.method = 'credit' and p.reference = 'Late fee removed'
  );
$function$;

revoke all on function public.is_late_fee_removal_credit(uuid) from public, anon;
grant execute on function public.is_late_fee_removal_credit(uuid) to authenticated;

create or replace function public.payment_applications_removal_credit_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if public.is_late_fee_removal_credit(new.payment_id)
       or (tg_op = 'UPDATE' and public.is_late_fee_removal_credit(old.payment_id)) then
      raise exception 'A removed late fee''s credit can''t be applied by hand. Remove late fees from the unit page' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.payment_applications_removal_credit_guard() from public, anon, authenticated;

create or replace trigger trg_payment_applications_removal_credit_guard
  before insert or update on public.payment_applications
  for each row execute function public.payment_applications_removal_credit_guard();
