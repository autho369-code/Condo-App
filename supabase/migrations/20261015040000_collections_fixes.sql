-- Collections deep check (rolled back at 2,000 units on production):
--
-- 1. Managers can remove a late fee (Mirsad, 2026-10-13): remove_late_fee
--    credits the fee's open amount back to the income account the fee posted
--    to (Dr late-fee income / Cr A/R), applied to that fee, with a reason,
--    audited. The late_fee_assessments row stays, so the daily run never
--    charges that fee again. A paid fee is refused (give a credit or refund).
-- 2. Dates follow the association's own calendar, not the server's UTC date:
--    late fees (a fee could be charged a day early, and dated tomorrow, when
--    "Charge late fees now" was clicked on a US evening), late-fee overrides,
--    the ladder's days past due, referral readiness, payment plan installment
--    status and the plan's paid amount (existing plans are rechecked), the
--    legacy apply_late_fees, and the date checks on plan offers, board
--    votes, new plans and override end dates.
-- 3. Interest is on principal only, as its own description says: late fees
--    and NSF fees no longer earn interest, and a previous owner's unpaid
--    charges don't earn interest billed to the new owner (the same rule late
--    fees already follow).
-- 4. late_fee_assessments can't be written directly by signed-in users (staff
--    could delete a row and the daily run would charge the fee again); only
--    the late-fee functions write it.
-- 5. A payment plan's cancellation reason is staff-only (owners could read it
--    from payment_plans through the API): it is kept in payment_plan_private.
--
-- Re-runnable: each function patch checks its marker first.

-- 4. Direct writes to late-fee records.
revoke insert, update, delete on public.late_fee_assessments from authenticated, anon;

-- 5. Cancellation reason moves to the staff-only table.
alter table public.payment_plan_private add column if not exists cancel_reason text;

create or replace function public.move_payment_plan_cancel_reason()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.cancel_reason is not null then
    insert into public.payment_plan_private (payment_plan_id, cancel_reason, updated_at)
    values (new.id, nullif(btrim(new.cancel_reason), ''), now())
    on conflict (payment_plan_id) do update set cancel_reason = excluded.cancel_reason, updated_at = now();
    new.cancel_reason := null;
  end if;
  return new;
end
$function$;

revoke all on function public.move_payment_plan_cancel_reason() from public, anon, authenticated;

create or replace trigger payment_plans_move_cancel_reason
  before insert or update of cancel_reason on public.payment_plans
  for each row execute function public.move_payment_plan_cancel_reason();

insert into public.payment_plan_private (payment_plan_id, cancel_reason, updated_at)
select p.id, nullif(btrim(p.cancel_reason), ''), now() from public.payment_plans p where p.cancel_reason is not null
on conflict (payment_plan_id) do update set cancel_reason = excluded.cancel_reason, updated_at = now();
update public.payment_plans set cancel_reason = null where cancel_reason is not null;

-- 1. Remove a late fee.
create or replace function public.remove_late_fee(p_charge_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  c public.charges;
  v_assoc uuid;
  v_pid uuid;
  v_open numeric;
  v_income uuid;
  v_reason text := left(btrim(coalesce(p_reason, '')), 400);
  v_credit uuid;
begin
  select * into c from public.charges where id = p_charge_id;
  if not found then raise exception 'Late fee not found' using errcode = 'P0002'; end if;
  v_assoc := public.unit_association_id(c.unit_id);
  select a.portfolio_id into v_pid from public.associations a where a.id = v_assoc;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(v_assoc) then
    raise exception 'Late fee not found' using errcode = 'P0002';
  end if;
  if c.charge_type <> 'late_fee' then
    raise exception 'Only a late fee can be removed here; use a credit for other charges' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Say why the late fee is removed' using errcode = '22023';
  end if;
  -- Same lock as payment application on the unit, so two removals (or a
  -- removal and a payment) can't both take the same open amount.
  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || c.unit_id::text, 0));
  v_open := c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0);
  if v_open <= 0.005 then
    raise exception 'This late fee is already paid or removed. To give the money back, post a credit or a refund' using errcode = '22023';
  end if;
  select g.income into v_income from public.charge_gl_accounts(c) g;
  if v_income is null then
    raise exception 'Set the income account on the late fee charge category first' using errcode = '22023';
  end if;
  v_credit := public.post_homeowner_credit(c.unit_id, round(v_open, 2), public.association_local_date(v_assoc), v_income,
                                           'Late fee removed: ' || v_reason, c.id);
  -- The owner's ledger shows the reference (the reason stays staff-only in
  -- payment_private), so the credit reads as a removed fee, not a payment.
  update public.payments set reference = 'Late fee removed' where id = v_credit;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'unit', c.unit_id, 'late_fee_removed', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('charge_id', c.id, 'amount', round(v_open, 2), 'credit_payment_id', v_credit, 'reason', v_reason));
  return v_credit;
end
$function$;

revoke all on function public.remove_late_fee(uuid, text) from public, anon;
grant execute on function public.remove_late_fee(uuid, text) to authenticated;

-- 2 and 3. Patches of the live definitions (each anchor must appear once).
create or replace function pg_temp.patch_fn(p_sig text, p_marker text, p_pairs text[])
returns void
language plpgsql
as $function$
declare
  v_def text := replace(pg_get_functiondef(p_sig::regprocedure), E'\r\n', E'\n');
  i integer;
begin
  if position(p_marker in v_def) > 0 then return; end if;
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if array_length(string_to_array(v_def, p_pairs[2 * i - 1]), 1) <> 2 then
      raise exception '% : anchor not found exactly once: %', p_sig, p_pairs[2 * i - 1];
    end if;
    v_def := replace(v_def, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  if position(p_marker in v_def) = 0 then raise exception '% : marker missing after patch', p_sig; end if;
  execute v_def;
end
$function$;

select pg_temp.patch_fn('public.assess_late_fee(uuid)', 'association_local_date(v_assoc.id)', array[
  'if v_charge.due_date + coalesce(v_assoc.late_fee_grace_days, 0) >= current_date then',
  'if v_charge.due_date + coalesce(v_assoc.late_fee_grace_days, 0) >= public.association_local_date(v_assoc.id) then',
  '.period_to <= current_date then',
  '.period_to <= public.association_local_date(v_assoc.id) then',
  'v_fee, current_date, v_cat.gl_account_id, auth.uid()',
  'v_fee, public.association_local_date(v_assoc.id), v_cat.gl_account_id, auth.uid()'
]);

select pg_temp.patch_fn('public.charge_late_fees_now(uuid)', 'association_local_date(p_association_id)', array[
  'where a.id = p_association_id), 0) < current_date',
  'where a.id = p_association_id), 0) < (select public.association_local_date(p_association_id))'
]);

select pg_temp.patch_fn('public.cron_assess_late_fees()', 'association_local_date(id) as today', array[
  'select id, name, coalesce(late_fee_grace_days, 0) as grace',
  'select id, name, coalesce(late_fee_grace_days, 0) as grace, public.association_local_date(id) as today',
  'and ch.due_date + a.grace < current_date',
  'and ch.due_date + a.grace < a.today'
]);

select pg_temp.patch_fn('public.unit_late_fee_override(uuid)', 'association_local_date(o.association_id)', array[
  'o.late_fee_override_until >= current_date)',
  'o.late_fee_override_until >= public.association_local_date(o.association_id))'
]);

select pg_temp.patch_fn('public.set_owner_late_fee_override(uuid,boolean,numeric,boolean,date,text)', 'association_local_date(o.association_id)', array[
  'if p_until is not null and p_until < current_date then',
  'if p_until is not null and p_until < public.association_local_date(o.association_id) then'
]);

select pg_temp.patch_fn('public.advance_delinquency_case(uuid,text)', 'association_local_date(case_row.association_id)', array[
  'or (current_date - case_row.oldest_due_date) < next_step.days_past_due then',
  'or (public.association_local_date(case_row.association_id) - case_row.oldest_due_date) < next_step.days_past_due then'
]);

select pg_temp.patch_fn('public.delinquency_referral_readiness(uuid)', 'association_local_date(c.association_id)', array[
  'c.oldest_due_date > current_date - make_interval(',
  'c.oldest_due_date > public.association_local_date(c.association_id) - make_interval('
]);

select pg_temp.patch_fn('public.record_delinquency_board_referral_vote(uuid,date,integer,integer,text)', 'association_local_date(c.association_id)', array[
  'p_meeting_date > current_date then',
  'p_meeting_date > public.association_local_date(c.association_id) then'
]);

select pg_temp.patch_fn('public.record_delinquency_payment_plan_offer(uuid,date,integer,text)', 'association_local_date(c.association_id)', array[
  'p_offered_on > current_date then',
  'p_offered_on > public.association_local_date(c.association_id) then'
]);

select pg_temp.patch_fn('public.create_payment_plan(uuid,numeric,integer,text,date,text)', 'association_local_date(v_assoc)', array[
  'p_first_due < current_date - 31 or p_first_due > current_date + 366',
  'p_first_due < public.association_local_date(v_assoc) - 31 or p_first_due > public.association_local_date(v_assoc) + 366'
]);

select pg_temp.patch_fn('public.payment_plan_schedule(uuid)', 'as today from plan', array[
  'select public.payment_plan_paid_amount(plan.id) as total from plan',
  'select public.payment_plan_paid_amount(plan.id) as total, public.association_local_date(plan.association_id) as today from plan',
  'when s.due_date < current_date then',
  'when s.due_date < paid.today then',
  'when s.due_date <= current_date + 7 then',
  'when s.due_date <= paid.today + 7 then'
]);

select pg_temp.patch_fn('public.assess_association_interest(date)', 'not in (''late_fee'', ''nsf_fee'')', array[
  'join public.charges ch on ch.unit_id = un.id',
  -- the current owner's period starts at their move-in; earlier charges are a previous owner's
  -- offset 0 keeps the lateral from being merged: one call per unit, not per charge
  'cross join lateral (select (public.app_ownership_bounds(un.id, v_post_date)).period_from as owner_from offset 0) ob
          join public.charges ch on ch.unit_id = un.id and ch.due_date >= ob.owner_from',
  'and ch.due_date < v_post_date - a.grace_days',
  'and ch.due_date < v_post_date - a.grace_days
           and ch.charge_type not in (''late_fee'', ''nsf_fee'')  -- interest on principal, not on fees'
]);

select pg_temp.patch_fn('public.apply_late_fees()', 'association_local_date(a.id)', array[
  'and c.due_date < current_date - coalesce(a.late_fee_grace_days, 0)',
  'and c.due_date < public.association_local_date(a.id) - coalesce(a.late_fee_grace_days, 0)'
]);

-- The plan's paid amount counts charges due up to the association's today
-- (read once per plan).
select pg_temp.patch_fn('public.payment_plan_paid_amount(uuid)', 'as today) w', array[
  'cross join lateral (select least(p.cancelled_at, p.completed_at) as window_end) w',
  'cross join lateral (select least(p.cancelled_at, p.completed_at) as window_end, public.association_local_date(p.association_id) as today) w',
  'and c.due_date <= least(current_date, p.cancelled_at::date, p.completed_at::date)',
  'and c.due_date <= least(w.today, p.cancelled_at::date, p.completed_at::date)',
  'and c.due_date <= least(current_date, o.cancelled_at::date, o.completed_at::date)',
  'and c.due_date <= least(w.today, o.cancelled_at::date, o.completed_at::date)'
]);

-- A changed measure rechecks stored statuses (Product Rules): every unit with
-- an active or completed plan. Production had no payment plans when this ran.
do $$
declare
  v_unit uuid;
begin
  for v_unit in
    select distinct unit_id from public.payment_plans where status in ('active', 'completed')
  loop
    perform public.app_recheck_payment_plan(v_unit);
  end loop;
end
$$;
