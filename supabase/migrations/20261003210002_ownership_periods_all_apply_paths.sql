-- Ownership periods for every automatic application path (review fixes).
-- 1. A period is bounded by the unit's owner move-ins, past owners included,
--    so a backdated payment from the second of three owners stays with the
--    second owner's charges (it was grouped with every earlier owner).
--    A co-owner added to an ownership that is still running does not start a
--    new period.
-- 2. The new-charge trigger (auto_apply_credit_on_new_charge) applied any
--    unapplied payment on the unit, so a seller's credit paid the buyer's
--    first assessment. It now only uses credit from the charge's period.

-- [period_from, period_to) of the ownership that covers p_date.
create or replace function public.app_ownership_bounds(p_unit_id uuid, p_date date,
  out period_from date, out period_to date)
language sql stable security definer set search_path = pg_catalog, public as $$
  with starts as (
    select distinct o.move_in_date as d
      from public.occupancies o
     where o.unit_id = p_unit_id and o.occupancy_type = 'owner' and o.move_in_date is not null
       -- not a co-owner joining an ownership that is still running
       and not exists (
         select 1 from public.occupancies e
          where e.unit_id = o.unit_id and e.occupancy_type = 'owner' and e.id <> o.id
            and e.move_in_date < o.move_in_date
            and (e.status = 'current' or e.move_out_date > o.move_in_date))
  )
  select coalesce((select max(d) from starts where d <= p_date), '-infinity'::date),
         coalesce((select min(d) from starts where d > p_date), 'infinity'::date);
$$;
revoke all on function public.app_ownership_bounds(uuid, date) from public, anon, authenticated;

-- apply_payment: the payment's own ownership period.
do $$
declare def text;
  v_old text := '  -- One ownership period: split at the current owner''s move-in.' || chr(10) ||
    '  v_since := public.app_unit_owner_since(pay.unit_id);' || chr(10) ||
    '  if v_since is not null then' || chr(10) ||
    '    if coalesce(pay.payment_date, current_date) >= v_since then v_from := v_since; else v_to := v_since; end if;' || chr(10) ||
    '  end if;';
begin
  def := pg_get_functiondef('public.apply_payment(uuid, text, uuid[])'::regprocedure);
  if position(v_old in def) = 0 then raise exception 'apply_payment drifted'; end if;
  def := replace(def, v_old,
    '  -- One ownership period: the ownership that covers the payment date.' || chr(10) ||
    '  select b.period_from, b.period_to into v_from, v_to' || chr(10) ||
    '    from public.app_ownership_bounds(pay.unit_id, coalesce(pay.payment_date, current_date)) b;');
  execute def;
end $$;

-- apply_credits: the current ownership's payments, applied to its charges.
create or replace function public.apply_credits(p_association_id uuid, p_unit_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_pid uuid;
  c record;
  res jsonb;
  v_applied numeric := 0;
  v_payments integer := 0;
  v_charge_ids uuid[];
begin
  select portfolio_id into v_pid from public.associations where id = p_association_id and archived_at is null;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(p_association_id) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if p_unit_id is not null and not exists (
       select 1 from public.units u join public.buildings b on b.id = u.building_id
        where u.id = p_unit_id and b.association_id = p_association_id) then
    raise exception 'That unit is not in this association' using errcode = '22023';
  end if;

  for c in
    select v.payment_id, v.unit_id, bd.period_from, bd.period_to
      from public.v_unapplied_credits v
      join public.units u on u.id = v.unit_id
      join public.buildings b on b.id = u.building_id
      cross join lateral public.app_ownership_bounds(v.unit_id, v.payment_date) bd
     where b.association_id = p_association_id
       and (p_unit_id is null or v.unit_id = p_unit_id)
       and v.unapplied_amount > 0.005
       and bd.period_to = 'infinity'::date
     order by v.unit_id, v.payment_date, v.payment_id
  loop
    select array_agg(cb.charge_id order by cb.due_date, ch.created_at, cb.charge_id) into v_charge_ids
      from public.v_charge_balances cb join public.charges ch on ch.id = cb.charge_id
     where cb.unit_id = c.unit_id and cb.balance_due > 0.005
       and coalesce(cb.due_date, ch.created_at::date) >= c.period_from
       and coalesce(cb.due_date, ch.created_at::date) < c.period_to;
    continue when v_charge_ids is null;
    res := public.apply_payment(c.payment_id, 'auto_specific', v_charge_ids);
    if coalesce((res ->> 'applied_total')::numeric, 0) > 0 then
      v_applied := v_applied + (res ->> 'applied_total')::numeric;
      v_payments := v_payments + 1;
    end if;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'association', p_association_id, 'credits_applied', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('unit_id', p_unit_id, 'payments', v_payments, 'applied_total', v_applied));
  return jsonb_build_object('payments', v_payments, 'applied_total', round(v_applied, 2));
end $$;

-- New charge: only credit paid in the same ownership period, oldest first.
create or replace function public.auto_apply_credit_on_new_charge()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  credit_row record;
  remaining_charge numeric(14,2);
  to_apply numeric(14,2);
  v_from date;
  v_to date;
begin
  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || new.unit_id::text, 0));
  remaining_charge := new.amount;
  select b.period_from, b.period_to into v_from, v_to
    from public.app_ownership_bounds(new.unit_id, coalesce(new.due_date, current_date)) b;

  for credit_row in
    select payment_id, unapplied_amount
      from public.v_unapplied_credits
     where unit_id = new.unit_id
       and coalesce(payment_date, current_date) >= v_from
       and coalesce(payment_date, current_date) < v_to
     order by payment_date, payment_id
  loop
    exit when remaining_charge <= 0;
    to_apply := least(remaining_charge, credit_row.unapplied_amount);
    if to_apply > 0 then
      insert into public.payment_applications (payment_id, charge_id, amount_applied, application_method)
      values (credit_row.payment_id, new.id, to_apply, 'credit_application')
      on conflict do nothing;
      remaining_charge := remaining_charge - to_apply;
    end if;
  end loop;
  return new;
end $$;
