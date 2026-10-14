-- Reviewers on #383 (after five Codex rounds): finish locking a removed late
-- fee in one pass. Every row the "removed" label or the credit's money reads:
--  1. The removal credit: signed-in users can change only its notes;
--     amount, date, accounts, unit, deposit link etc. are frozen too.
--  2. The fee charge: signed-in users can't delete it (the application
--     cascade runs as the table owner and would free the credit) or change
--     anything but its description (amount, type, account, category and
--     date decide its posting; trg_post_charge_to_gl reposts on update).
--  3. A removal credit applies only to its own fee, for every caller
--     (remove_late_fee applies it before marking it, so it is unaffected).
--  4. v_unapplied_credits leaves removal credits out, so apply_credits and
--     auto_apply_credit_on_new_charge (definer) never spend one elsewhere.
-- Messages reworded for managers (white-label checker).

-- 1. Removal credit frozen.
create or replace function public.payments_late_fee_removed_marker()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.reference = 'Late fee removed')
       or (tg_op = 'UPDATE' and new.reference = 'Late fee removed'
           and old.reference is distinct from 'Late fee removed') then
      raise exception 'The reference "Late fee removed" is used only when a late fee is removed. Remove late fees from the unit page.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.reference = 'Late fee removed'
       and (to_jsonb(new) - 'notes') is distinct from (to_jsonb(old) - 'notes') then
      raise exception 'This credit removed a late fee and can''t be changed.' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.payments_late_fee_removed_marker() from public, anon, authenticated;

drop trigger if exists trg_payments_late_fee_removed_marker on public.payments;
create trigger trg_payments_late_fee_removed_marker
  before insert or update on public.payments
  for each row execute function public.payments_late_fee_removed_marker();

create or replace function public.payments_late_fee_removed_delete_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') and old.reference = 'Late fee removed' then
    raise exception 'This credit removed a late fee and can''t be deleted.' using errcode = '42501';
  end if;
  return old;
end
$function$;

revoke all on function public.payments_late_fee_removed_delete_guard() from public, anon, authenticated;

-- 3. Applications: signed-in users can't touch a removal credit's; nobody
-- can apply one to another charge.
create or replace function public.payment_applications_removal_credit_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op in ('INSERT', 'UPDATE') and public.is_late_fee_removal_credit(new.payment_id))
       or (tg_op in ('UPDATE', 'DELETE') and public.is_late_fee_removal_credit(old.payment_id)) then
      raise exception 'This credit removed a late fee and can''t be changed.' using errcode = '42501';
    end if;
  elsif tg_op in ('INSERT', 'UPDATE') and exists (
      select 1 from public.payments p
       where p.id = new.payment_id and p.method = 'credit' and p.reference = 'Late fee removed'
         and p.charge_id is distinct from new.charge_id) then
    raise exception 'A removed late fee''s credit applies only to that fee.' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

revoke all on function public.payment_applications_removal_credit_guard() from public, anon, authenticated;

-- 2. The fee charge.
create or replace function public.is_removed_late_fee(p_charge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  -- A removal credit names its fee and applies only to it (below).
  select exists (
    select 1 from public.payments p
     where p.charge_id = p_charge_id and p.method = 'credit' and p.reference = 'Late fee removed'
  );
$function$;

-- The guard trigger runs as the caller, so signed-in users need to call it.
revoke all on function public.is_removed_late_fee(uuid) from public, anon;
grant execute on function public.is_removed_late_fee(uuid) to authenticated;

create or replace function public.charges_late_fee_removed_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') and public.is_removed_late_fee(old.id) then
    if tg_op = 'DELETE' then
      raise exception 'This late fee was removed and can''t be deleted.' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'description') is distinct from (to_jsonb(old) - 'description') then
      raise exception 'This late fee was removed and can''t be changed.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

revoke all on function public.charges_late_fee_removed_guard() from public, anon, authenticated;

drop trigger if exists trg_charges_late_fee_removed_guard on public.charges;
create trigger trg_charges_late_fee_removed_guard
  before update or delete on public.charges
  for each row execute function public.charges_late_fee_removed_guard();

-- 4. Removal credits are never spendable credit.
create or replace view public.v_unapplied_credits
with (security_invoker = true) as
 SELECT p.id AS payment_id,
    p.unit_id,
    p.payment_date,
    p.amount,
    COALESCE(pa.applied, (0)::numeric) AS applied_amount,
    (p.amount - COALESCE(pa.applied, (0)::numeric)) AS unapplied_amount
   FROM (payments p
     LEFT JOIN LATERAL ( SELECT sum(x.amount_applied) AS applied
           FROM payment_applications x
          WHERE (x.payment_id = p.id)) pa ON (true))
  WHERE ((p.amount - COALESCE(pa.applied, (0)::numeric)) > 0.005)
    AND NOT (p.method = 'credit' AND p.reference IS NOT DISTINCT FROM 'Late fee removed');

-- reallocate_payment message ends with a full stop like the app's own.
do $$
declare
  d text := replace(pg_get_functiondef('public.reallocate_payment(uuid, jsonb)'::regprocedure), chr(13), '');
begin
  if position('stays applied to it''' in d) > 0 then
    execute replace(d, 'stays applied to it''', 'stays applied to it.''');
  end if;
end $$;
