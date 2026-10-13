-- Speed: payment_plan_paid_amount finds reversal charges through the unit
-- (migration-reviewer on #342). payments.reversal_charge_id has no index, so
-- "not exists (payment pointing at this charge)" could scan every payment;
-- a reversal charge always belongs to its payment's unit, so the lookup is
-- narrowed by unit_id (indexed). Result unchanged.

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
                                           and r.reversal_charge_id = c.id)), 0))
    from public.payment_plans p
   where p.id = p_plan_id
  ) s(x) limit 1);
end$function$;
