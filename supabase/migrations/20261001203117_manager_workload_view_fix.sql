-- v_manager_workload: per-manager counts were wrong.
--  * total_doors_managed summed unit_count across the work-order/violation/
--    architectural fan-out, inflating it by the number of joined rows.
--  * open work orders left out 'assigned'.
--  * open violations read violation_cases; the app records violations in
--    public.violations (open = not cured/closed).
--  * last_login was hard-coded NULL.
-- Same columns, names and types, so existing callers keep working.
create or replace view public.v_manager_workload
with (security_invoker = true) as
with mgr as (
  select pr.id, pr.full_name, pr.email, pr.last_login_at
  from public.profiles pr
  where pr.hoa_role = any (array['manager'::hoa_role, 'company_admin'::hoa_role])
     or exists (
       select 1 from public.user_roles ur
       where ur.id = pr.role_id
         and ur.name = any (array['President'::text, 'Property Manager'::text, 'Accountant'::text])
     )
), assigned as (
  select distinct am.user_id, a.id as association_id, coalesce(a.unit_count, 0) as unit_count
  from public.association_managers am
  join public.associations a on a.id = am.association_id and a.archived_at is null
  where am.ended_at is null
    and public.can_access_portfolio(a.portfolio_id)
)
select
  m.id as manager_id,
  m.full_name as manager_name,
  m.email as manager_email,
  count(s.association_id) as assigned_associations,
  coalesce(sum(s.unit_count), 0)::bigint as total_doors_managed,
  coalesce(sum((select count(*) from public.work_orders wo
    where wo.association_id = s.association_id and wo.archived_at is null
      and wo.status = any (array['new','assigned','scheduled','in_progress']::work_order_status[]))), 0)::bigint as open_work_orders,
  coalesce(sum((select count(*) from public.work_orders wo
    where wo.association_id = s.association_id and wo.archived_at is null
      and wo.status = any (array['new','assigned','scheduled','in_progress']::work_order_status[])
      and wo.scheduled_date < current_date)), 0)::bigint as overdue_work_orders,
  coalesce(sum((select count(*) from public.violations v
    where v.association_id = s.association_id and v.archived_at is null
      and v.status <> all (array['cured','closed']::violation_status[]))), 0)::bigint as open_violations,
  coalesce(sum((select count(*) from public.architectural_requests ar
    where ar.association_id = s.association_id
      and ar.status = any (array['submitted','under_review','more_info']))), 0)::integer as open_arch_reviews,
  m.last_login_at as last_login
from mgr m
join assigned s on s.user_id = m.id
group by m.id, m.full_name, m.email, m.last_login_at;
