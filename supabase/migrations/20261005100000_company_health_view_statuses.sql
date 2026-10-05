-- v_company_health counted the wrong statuses:
--  * violation_cases: the view excluded ('closed','violation_dismissed'), but
--    the check constraint only allows reported | converted | dismissed, so
--    converted and dismissed cases were counted as open forever. Only
--    'reported' cases are open.
--  * work_orders: "open" omitted 'assigned' (work_order_status is
--    new, assigned, scheduled, in_progress, done, completed, billed, closed,
--    cancelled). Open = every non-terminal status: new, assigned, scheduled,
--    in_progress.
-- Same columns, names, types and order as before; security_invoker kept.

create or replace view public.v_company_health
with (security_invoker = true)
as
with assoc_health as (
  select
    a.portfolio_id,
    a.id as association_id,
    a.unit_count,
    a.status as assoc_status,
    count(distinct wo.id) filter (
      where wo.status = any (array['new', 'assigned', 'scheduled', 'in_progress']::work_order_status[])
    ) as open_wos,
    count(distinct wo.id) filter (
      where wo.status = any (array['new', 'assigned', 'scheduled', 'in_progress']::work_order_status[])
        and wo.scheduled_date < current_date
    ) as overdue_wos,
    count(distinct vc.id) filter (
      where vc.status = 'reported' and vc.archived_at is null
    ) as open_violations,
    coalesce(
      avg(extract(epoch from wo.completed_date::timestamp with time zone - wo.created_at) / 3600.0)
        filter (where wo.completed_date is not null),
      0::numeric
    ) as avg_response_hours
  from associations a
    left join work_orders wo on wo.association_id = a.id and wo.archived_at is null
    left join violation_cases vc on vc.association_id = a.id
  where a.archived_at is null
  group by a.portfolio_id, a.id, a.unit_count, a.status
)
select
  p.id as portfolio_id,
  count(distinct ah.association_id) as total_associations,
  coalesce(sum(ah.unit_count), 0::bigint) as total_doors,
  count(distinct ah.association_id) filter (where ah.open_wos = 0 and ah.open_violations = 0) as healthy_count,
  count(distinct ah.association_id) filter (
    where ah.open_wos >= 1 and ah.open_wos <= 3 or ah.open_violations >= 1 and ah.open_violations <= 2
  ) as warning_count,
  count(distinct ah.association_id) filter (
    where ah.open_wos > 3 or ah.open_violations > 2 or ah.overdue_wos > 0
  ) as critical_count,
  coalesce(sum(ah.open_wos), 0::numeric) as open_work_orders,
  coalesce(sum(ah.overdue_wos), 0::numeric) as overdue_work_orders,
  coalesce(sum(ah.open_violations), 0::numeric) as open_violations,
  coalesce(avg(ah.avg_response_hours) filter (where ah.avg_response_hours > 0::numeric), 0::numeric) as avg_response_hours,
  coalesce((
    select sum(mf.delinquent_cents) as sum
    from management_fees mf
    where mf.portfolio_id = p.id
      and mf.month = date_trunc('month', current_date::timestamp with time zone)::date
  ), 0::bigint) as delinquency_total_cents
from portfolios p
  left join assoc_health ah on ah.portfolio_id = p.id
where can_access_portfolio(p.id)
group by p.id;

alter view public.v_company_health set (security_invoker = true);
