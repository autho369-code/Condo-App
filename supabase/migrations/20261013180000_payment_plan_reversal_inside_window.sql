-- Codex on #342: payment_plan_paid_amount drops a reversal charge only when
-- its receipt is counted.
--
-- 20261013150000 skipped every reversal charge (payments.reversal_charge_id)
-- whatever its receipt. A receipt recorded before the plan started is not in
-- the payment sum, so when it bounces after the plan starts its returned-
-- payment charge must still count against the plan; skipping it left the
-- plan completed and its collection hold released. Now a reversal charge is
-- skipped only when its receipt meets the payment-side window (on or after
-- the plan start, not after cancellation, not a credit). Everything else is
-- measured as before.

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
                                         where r.unit_id = c.unit_id
                                           and r.reversal_charge_id = c.id
                                           and r.created_at >= p.created_at
                                           and (p.cancelled_at is null or r.created_at <= p.cancelled_at)
                                           and coalesce(r.method, '') <> 'credit')), 0))
    from public.payment_plans p
   where p.id = p_plan_id
  ) s(x) limit 1);
end$function$;
