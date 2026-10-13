-- Codex follow-ups on #339 (20261013080000).
--
-- 1. app_recheck_payment_plan summed raw payments since the plan started.
--    On a long plan, ordinary dues receipts can exceed the plan amount, so a
--    bounced payoff still left the plan "completed" and its collection hold
--    released. It now uses payment_plan_paid_amount(plan), the same measure
--    app_complete_paid_payment_plan completes plans with (payments less the
--    charges that came due since the plan started; a reversal's charge nets
--    out the bounced payment).
-- 2. Reconciliation items: the completed-status check read the parent
--    without a lock, so an item change racing a completion could commit
--    against a reconciliation completed with the old items. The item guard
--    now locks the parent row (FOR SHARE): it waits for a completing update
--    and then sees the completed status; a completing update waits for item
--    changes in flight and its balance check sees them.

create or replace function public.app_recheck_payment_plan(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  pl public.payment_plans;
  v_paid numeric;
  c record;
begin
  for pl in select * from public.payment_plans
             where unit_id = p_unit_id and status in ('active', 'completed')
             order by created_at for update loop
    -- Same measure app_complete_paid_payment_plan uses.
    v_paid := public.payment_plan_paid_amount(pl.id);

    if pl.status = 'active' and v_paid >= pl.total_amount then
      perform public.app_complete_paid_payment_plan(pl.unit_id);
    elsif pl.status = 'completed' and v_paid < pl.total_amount then
      if exists (select 1 from public.delinquency_cases d where d.unit_id = pl.unit_id and d.status in ('legal_review', 'approved_for_counsel')) then
        update public.payment_plans
           set status = 'cancelled', cancelled_at = now(), updated_at = now(),
               cancel_reason = 'A payment correction left the plan unpaid while the collection case is in legal review'
         where id = pl.id;
      elsif not exists (select 1 from public.payment_plans o where o.unit_id = pl.unit_id and o.status = 'active') then
        update public.payment_plans set status = 'active', completed_at = null, updated_at = now() where id = pl.id;
        for c in select * from public.delinquency_cases where unit_id = pl.unit_id and status = 'open' for update loop
          update public.delinquency_cases set status = 'open' where id = c.id;
          insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note)
          values (c.id, 'hold_placed', c.current_step_number, c.balance_snapshot, 'Payment plan reopened after a payment correction');
        end loop;
      else
        update public.payment_plans
           set status = 'cancelled', cancelled_at = now(), updated_at = now(),
               cancel_reason = 'A payment correction left the plan unpaid; a newer plan is active'
         where id = pl.id;
      end if;
    end if;
  end loop;
end $function$;

create or replace function public.app_guard_bank_reconciliation_item()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_status text;
begin
  if current_user = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  for v_status in
    select r.status::text from public.bank_reconciliations r
     where r.id in (case when tg_op = 'INSERT' then null else old.reconciliation_id end,
                    case when tg_op = 'DELETE' then null else new.reconciliation_id end)
     for share
  loop
    if v_status = 'completed' then
      raise exception 'Items of a completed reconciliation cannot be changed' using errcode = '55000';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end
$function$;
