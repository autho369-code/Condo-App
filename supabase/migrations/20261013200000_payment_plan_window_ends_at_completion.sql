-- Codex on #344 and migration-reviewer: one window for a payment plan,
-- measured by when things were recorded.
--
-- 20261013190000 stopped counting ordinary charges after completion but
-- still counted every receipt recorded after it, so later dues receipts
-- covered a bounce of a payment that funded the plan (a $1,000 plan, a
-- later $500 dues receipt, then an original $500 bounces: still $1,000,
-- plan stays completed). The review of the first fix found three more
-- holes, all from mixing due dates with recording times:
--   * a charge posted after completion with an earlier due date (the
--     next morning's dues run after a late-night payoff, a backdated fine)
--     counted against the completed plan;
--   * a bounce of a receipt from before the plan, dated back before the
--     plan started, never counted;
--   * on a unit with two plans, one bounce counted against both.
--
-- The plan window runs from the plan start to its completion or
-- cancellation, whichever is first (recording times, inclusive):
--   receipts  recorded inside the window, not reversed, not credits;
--   charges   ordinary charges due from the plan start up to today (up to
--             the completion date for a completed plan), and for a closed
--             plan only those recorded inside the window;
--   later     receipts and charges inside a later plan's window (not
--             cancelled) are that plan's, by that plan's own filters, so a
--             reopened older plan does not count money that paid the newer
--             one;
--   bounces   a reversal charge (payments.reversal_charge_id) never counts
--             as an ordinary charge. It counts only for a receipt recorded
--             before the plan whose bounce was recorded after the plan
--             started and not after cancellation (also after completion:
--             that reopens the plan), whatever the reversal date, and only
--             when the receipt is not inside an earlier plan's window that
--             was not cancelled (that plan owns it), and only for the latest
--             plan (not cancelled) that had started when the bounce was
--             recorded, so one bounce never counts against two plans.
-- A reopened plan clears completed_at, so its window runs to today again.

create or replace function public.payment_plan_paid_amount(p_plan_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select greatest(0,
           coalesce((select sum(pm.amount) from public.payments pm
                      where pm.unit_id = p.unit_id
                        and pm.created_at >= p.created_at
                        and (w.window_end is null or pm.created_at <= w.window_end)
                        and coalesce(pm.method, '') <> 'credit'
                        and pm.reversed_at is null
                        -- inside a later plan (not cancelled): that plan's
                        and not exists (select 1 from public.payment_plans o
                                         where o.unit_id = p.unit_id
                                           and o.id <> p.id
                                           and o.status <> 'cancelled'
                                           and o.created_at > p.created_at
                                           and pm.created_at >= o.created_at
                                           and (least(o.cancelled_at, o.completed_at) is null
                                                or pm.created_at <= least(o.cancelled_at, o.completed_at)))), 0)
         -- ordinary charges
         - coalesce((select sum(c.amount) from public.charges c
                      where c.unit_id = p.unit_id
                        and c.due_date >= p.created_at::date
                        and c.due_date <= least(current_date, p.cancelled_at::date, p.completed_at::date)
                        and (w.window_end is null or c.created_at <= w.window_end)
                        and not exists (select 1 from public.payments r
                                         where r.unit_id = c.unit_id
                                           and r.reversal_charge_id = c.id)
                        -- inside a later plan (not cancelled): that plan's
                        and not exists (select 1 from public.payment_plans o
                                         where o.unit_id = p.unit_id
                                           and o.id <> p.id
                                           and o.status <> 'cancelled'
                                           and o.created_at > p.created_at
                                           and c.due_date >= o.created_at::date
                                           and c.due_date <= least(current_date, o.cancelled_at::date, o.completed_at::date)
                                           and (least(o.cancelled_at, o.completed_at) is null
                                                or c.created_at <= least(o.cancelled_at, o.completed_at)))), 0)
         -- bounces of receipts from before the plan
         - coalesce((select sum(c.amount) from public.payments r
                       join public.charges c on c.id = r.reversal_charge_id
                      where r.unit_id = p.unit_id
                        and r.created_at < p.created_at
                        and r.reversed_at >= p.created_at
                        and (p.cancelled_at is null or r.reversed_at <= p.cancelled_at)
                        and not exists (select 1 from public.payment_plans o
                                         where o.unit_id = p.unit_id
                                           and o.id <> p.id
                                           and o.status <> 'cancelled'
                                           and o.created_at < p.created_at
                                           and r.created_at >= o.created_at
                                           and (least(o.cancelled_at, o.completed_at) is null
                                                or r.created_at <= least(o.cancelled_at, o.completed_at)))
                        -- a later plan (not cancelled) had started when the
                        -- bounce was recorded: the latest such plan owns it
                        and not exists (select 1 from public.payment_plans o
                                         where o.unit_id = p.unit_id
                                           and o.id <> p.id
                                           and o.status <> 'cancelled'
                                           and o.created_at > p.created_at
                                           and o.created_at <= r.reversed_at)), 0))
    from public.payment_plans p
    cross join lateral (select least(p.cancelled_at, p.completed_at) as window_end) w
   where p.id = p_plan_id
  ) s(x) limit 1);
end$function$;

-- The cancel reason named the other active plan "newer"; with the window
-- above the active plan can be the older one (a reopened plan). Text only;
-- otherwise app_recheck_payment_plan is 20261013140000 unchanged.

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
               cancel_reason = 'A payment correction left the plan unpaid; another plan on the unit is active'
         where id = pl.id;
      end if;
    end if;
  end loop;
end $function$;
