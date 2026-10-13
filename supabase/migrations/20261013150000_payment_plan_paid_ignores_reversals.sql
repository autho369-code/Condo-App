-- Codex on #341: payment_plan_paid_amount ignores reversed payments.
--
-- The measure counted every receipt since the plan started and subtracted
-- charges that came due inside the plan window. A returned payment was meant
-- to net out through its reversal charge, but a reversal dated in the future
-- (charge not yet due) or before the plan started (charge outside the window)
-- left the bounced receipt counted, so the plan stayed completed and its
-- collection hold released.
--
-- Now reversed receipts (reversed_at set) don't count, and their reversal
-- charges (payments.reversal_charge_id) are not subtracted, whatever their
-- dates. Ordinary receipts and charges are measured exactly as before.
-- Used by plan completion, app_recheck_payment_plan and
-- payment_plan_schedule.

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
                        and c.due_date <= least(current_date, coalesce(p.cancelled_at::date, current_date))
                        and not exists (select 1 from public.payments r
                                         where r.reversal_charge_id = c.id)), 0))
    from public.payment_plans p
   where p.id = p_plan_id
  ) s(x) limit 1);
end$function$;
