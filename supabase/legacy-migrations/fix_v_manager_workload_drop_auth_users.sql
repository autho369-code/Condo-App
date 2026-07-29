-- Security advisor "Exposed Auth Users": v_manager_workload joined auth.users
-- only to read last_sign_in_at. profiles.last_login_at already has that, so the
-- auth.users join is dropped entirely (no auth schema exposure to clients).
-- Applied to remote DB 2026-06-22.
create or replace view public.v_manager_workload as
 select pr.id as manager_id,
    pr.full_name as manager_name,
    pr.email as manager_email,
    count(distinct am.association_id) as assigned_associations,
    coalesce(sum(a.unit_count), (0)::bigint) as total_doors_managed,
    count(distinct wo.id) filter (where (wo.status = any (array['new'::work_order_status, 'in_progress'::work_order_status, 'scheduled'::work_order_status]))) as open_work_orders,
    count(distinct wo.id) filter (where ((wo.status = any (array['new'::work_order_status, 'in_progress'::work_order_status, 'scheduled'::work_order_status])) and (wo.scheduled_date < current_date))) as overdue_work_orders,
    count(distinct vc.id) filter (where ((vc.status <> all (array['closed'::text, 'violation_dismissed'::text])) and (vc.archived_at is null))) as open_violations,
    0 as open_arch_reviews,
    pr.last_login_at as last_login
   from ((((profiles pr
     join association_managers am on (((am.user_id = pr.id) and (am.ended_at is null))))
     join associations a on (((a.id = am.association_id) and (a.archived_at is null))))
     left join work_orders wo on (((wo.association_id = a.id) and (wo.archived_at is null))))
     left join violation_cases vc on ((vc.association_id = a.id)))
  where ((pr.hoa_role = any (array['manager'::hoa_role, 'company_admin'::hoa_role])) or (exists ( select 1
           from user_roles ur
          where ((ur.id = pr.role_id) and (ur.name = any (array['President'::text, 'Property Manager'::text, 'Accountant'::text]))))))
  group by pr.id, pr.full_name, pr.email, pr.last_login_at;
