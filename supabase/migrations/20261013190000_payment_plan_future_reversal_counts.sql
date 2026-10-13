-- Codex on #343: a bounce dated in the future counts against the plan now.
--
-- reverse_homeowner_payment allows a future reversal date, which becomes the
-- reversal charge's due date. payment_plan_paid_amount counted charges only
-- up to today, and the payment-update trigger is the only recheck, so a
-- receipt from before the plan bounced with a future date left the plan
-- completed and its collection hold released, and nothing rechecked it when
-- the date arrived. A reversal charge whose receipt is outside the plan
-- window now counts as soon as the bounce is recorded, whatever its due date
-- (still from the plan start and not after cancellation). Reversal charges
-- of receipts inside the window are still skipped (the receipt is dropped
-- too).
--
-- migration-reviewer on this PR: ordinary charges are counted only up to
-- the day the plan was completed. Before, next month's dues coming due could
-- reopen a completed plan the next time any payment on the unit changed;
-- a completed plan reopens only on a payment correction (a bounce or an
-- edited receipt). Falling behind on new dues is a new delinquency, not the
-- old plan. Active plans (completed_at null) are measured as before.

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
                        and (p.cancelled_at is null or pm.created_at <= p.cancelled_at)
                        and coalesce(pm.method, '') <> 'credit'
                        and pm.reversed_at is null), 0)
         - coalesce((select sum(c.amount) from public.charges c
                      where c.unit_id = p.unit_id
                        and c.due_date >= p.created_at::date
                        and (p.cancelled_at is null or c.due_date <= p.cancelled_at::date)
                        and not exists (select 1 from public.payments r
                                         where r.unit_id = c.unit_id
                                           and r.reversal_charge_id = c.id
                                           and r.created_at >= p.created_at
                                           and (p.cancelled_at is null or r.created_at <= p.cancelled_at)
                                           and coalesce(r.method, '') <> 'credit')
                        -- due by today (by completion for a completed plan),
                        -- or the reversal of a receipt from outside the
                        -- window (counts once recorded)
                        and (c.due_date <= least(current_date, coalesce(p.completed_at::date, current_date))
                             or exists (select 1 from public.payments r
                                         where r.unit_id = c.unit_id
                                           and r.reversal_charge_id = c.id))), 0))
    from public.payment_plans p
   where p.id = p_plan_id
  ) s(x) limit 1);
end$function$;
