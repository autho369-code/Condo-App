-- Re-drop the auth.users join that 20260628 architectural_requests reintroduced
-- into v_manager_workload (20260623 fix_v_manager_workload_drop_auth_users had
-- already removed it — advisor: auth_users_exposed). last_login stays as a NULL
-- column to preserve the view's shape; no app code reads it.
create or replace view public.v_manager_workload as
 SELECT pr.id AS manager_id,
    pr.full_name AS manager_name,
    pr.email AS manager_email,
    count(DISTINCT am.association_id) AS assigned_associations,
    COALESCE(sum(a.unit_count), (0)::bigint) AS total_doors_managed,
    count(DISTINCT wo.id) FILTER (WHERE (wo.status = ANY (ARRAY['new'::work_order_status, 'in_progress'::work_order_status, 'scheduled'::work_order_status]))) AS open_work_orders,
    count(DISTINCT wo.id) FILTER (WHERE ((wo.status = ANY (ARRAY['new'::work_order_status, 'in_progress'::work_order_status, 'scheduled'::work_order_status])) AND (wo.scheduled_date < CURRENT_DATE))) AS overdue_work_orders,
    count(DISTINCT vc.id) FILTER (WHERE ((vc.status <> ALL (ARRAY['closed'::text, 'violation_dismissed'::text])) AND (vc.archived_at IS NULL))) AS open_violations,
    (count(DISTINCT ar.id) FILTER (WHERE (ar.status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'more_info'::text]))))::integer AS open_arch_reviews,
    NULL::timestamptz AS last_login
   FROM (((((profiles pr
     JOIN association_managers am ON (((am.user_id = pr.id) AND (am.ended_at IS NULL))))
     JOIN associations a ON (((a.id = am.association_id) AND (a.archived_at IS NULL))))
     LEFT JOIN work_orders wo ON (((wo.association_id = a.id) AND (wo.archived_at IS NULL))))
     LEFT JOIN violation_cases vc ON ((vc.association_id = a.id)))
     LEFT JOIN architectural_requests ar ON ((ar.association_id = a.id)))
  WHERE ((pr.hoa_role = ANY (ARRAY['manager'::hoa_role, 'company_admin'::hoa_role])) OR (EXISTS ( SELECT 1
           FROM user_roles ur
          WHERE ((ur.id = pr.role_id) AND (ur.name = ANY (ARRAY['President'::text, 'Property Manager'::text, 'Accountant'::text]))))))
    AND public.can_access_portfolio(a.portfolio_id)
  GROUP BY pr.id, pr.full_name, pr.email;
