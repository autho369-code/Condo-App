-- Close public exposure of SECURITY DEFINER (owner-rights) views.
--
-- Supabase advisors flagged 8 views that run with owner privileges and were
-- SELECT-able by BOTH `anon` and `authenticated` (full grants, PostgREST-reachable
-- with the public anon key): v_manager_workload (manager emails + auth.users
-- last_sign_in_at), v_upcoming_expirations (owner names/emails + policy numbers),
-- v_unit_charge_schedule (every unit's charges), v_company_health / v_company_metrics
-- (revenue + delinquency), v_due_reminders, v_upcoming_maintenance, v_role_permissions.
--
-- Fix, preserving app behavior exactly for permitted roles:
--   1. Each data-bearing view now filters by can_access_portfolio(...) so a
--      definer view only returns rows for the caller's own portfolio (operators
--      see all, staff/company admins their portfolio, everyone else nothing).
--   2. Revoke ALL from anon; leave authenticated with SELECT only.
-- v_role_permissions is a static VALUES list (documentation of the permission
-- model, no tenant data) — grants tightened only.

-- 1) v_company_health -------------------------------------------------------
create or replace view public.v_company_health as
 WITH assoc_health AS (
         SELECT a.portfolio_id,
            a.id AS association_id,
            a.unit_count,
            a.status AS assoc_status,
            count(DISTINCT wo.id) FILTER (WHERE (wo.status = ANY (ARRAY['new'::work_order_status, 'in_progress'::work_order_status, 'scheduled'::work_order_status]))) AS open_wos,
            count(DISTINCT wo.id) FILTER (WHERE ((wo.status = ANY (ARRAY['new'::work_order_status, 'in_progress'::work_order_status, 'scheduled'::work_order_status])) AND (wo.scheduled_date < CURRENT_DATE))) AS overdue_wos,
            count(DISTINCT vc.id) FILTER (WHERE ((vc.status <> ALL (ARRAY['closed'::text, 'violation_dismissed'::text])) AND (vc.archived_at IS NULL))) AS open_violations,
            COALESCE(avg((EXTRACT(epoch FROM ((wo.completed_date)::timestamp with time zone - wo.created_at)) / 3600.0)) FILTER (WHERE (wo.completed_date IS NOT NULL)), (0)::numeric) AS avg_response_hours
           FROM ((associations a
             LEFT JOIN work_orders wo ON (((wo.association_id = a.id) AND (wo.archived_at IS NULL))))
             LEFT JOIN violation_cases vc ON ((vc.association_id = a.id)))
          WHERE (a.archived_at IS NULL)
          GROUP BY a.portfolio_id, a.id, a.unit_count, a.status
        )
 SELECT p.id AS portfolio_id,
    count(DISTINCT ah.association_id) AS total_associations,
    COALESCE(sum(ah.unit_count), (0)::bigint) AS total_doors,
    count(DISTINCT ah.association_id) FILTER (WHERE ((ah.open_wos = 0) AND (ah.open_violations = 0))) AS healthy_count,
    count(DISTINCT ah.association_id) FILTER (WHERE (((ah.open_wos >= 1) AND (ah.open_wos <= 3)) OR ((ah.open_violations >= 1) AND (ah.open_violations <= 2)))) AS warning_count,
    count(DISTINCT ah.association_id) FILTER (WHERE ((ah.open_wos > 3) OR (ah.open_violations > 2) OR (ah.overdue_wos > 0))) AS critical_count,
    COALESCE(sum(ah.open_wos), (0)::numeric) AS open_work_orders,
    COALESCE(sum(ah.overdue_wos), (0)::numeric) AS overdue_work_orders,
    COALESCE(sum(ah.open_violations), (0)::numeric) AS open_violations,
    COALESCE(avg(ah.avg_response_hours) FILTER (WHERE (ah.avg_response_hours > (0)::numeric)), (0)::numeric) AS avg_response_hours,
    COALESCE(( SELECT sum(mf.delinquent_cents) AS sum
           FROM management_fees mf
          WHERE ((mf.portfolio_id = p.id) AND (mf.month = (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date))), (0)::bigint) AS delinquency_total_cents
   FROM (portfolios p
     LEFT JOIN assoc_health ah ON ((ah.portfolio_id = p.id)))
  WHERE public.can_access_portfolio(p.id)
  GROUP BY p.id;

-- 2) v_company_metrics ------------------------------------------------------
create or replace view public.v_company_metrics as
 SELECT p.id AS portfolio_id,
    'current_month'::text AS period,
    COALESCE(( SELECT sum(mf.collected_cents) AS sum
           FROM management_fees mf
          WHERE ((mf.portfolio_id = p.id) AND (mf.month = (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date))), (0)::bigint) AS total_revenue_cents,
    COALESCE(( SELECT sum(mf.fee_amount_cents) AS sum
           FROM management_fees mf
          WHERE ((mf.portfolio_id = p.id) AND (mf.month = (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date))), (0)::bigint) AS management_fee_income_cents,
    COALESCE(( SELECT count(DISTINCT am.user_id) AS count
           FROM (association_managers am
             JOIN associations a_1 ON ((a_1.id = am.association_id)))
          WHERE ((a_1.portfolio_id = p.id) AND (a_1.archived_at IS NULL) AND (am.ended_at IS NULL))), (0)::bigint) AS active_managers,
    COALESCE(sum(a.unit_count), (0)::bigint) AS total_doors,
    COALESCE(( SELECT bu.doors_active
           FROM billing_usage bu
          WHERE ((bu.portfolio_id = p.id) AND (bu.status = 'active'::text))
          ORDER BY bu.period_end DESC
         LIMIT 1), 0) AS doors_used,
    COALESCE(( SELECT bu.doors_limit
           FROM billing_usage bu
          WHERE ((bu.portfolio_id = p.id) AND (bu.status = 'active'::text))
          ORDER BY bu.period_end DESC
         LIMIT 1), 0) AS doors_limit,
    COALESCE(( SELECT bu.status
           FROM billing_usage bu
          WHERE ((bu.portfolio_id = p.id) AND (bu.status = 'active'::text))
          ORDER BY bu.period_end DESC
         LIMIT 1), 'inactive'::text) AS subscription_status
   FROM (portfolios p
     LEFT JOIN associations a ON (((a.portfolio_id = p.id) AND (a.archived_at IS NULL))))
  WHERE public.can_access_portfolio(p.id)
  GROUP BY p.id;

-- 3) v_due_reminders --------------------------------------------------------
create or replace view public.v_due_reminders as
 SELECT ce.id AS event_id,
    ce.portfolio_id,
    ce.association_id,
    a.name AS association_name,
    ce.title,
    ce.event_type,
    ce.calendar_scope,
    ce.start_datetime,
    ce.reminder_days_before,
    (ce.start_datetime - ((ce.reminder_days_before || ' days'::text))::interval) AS reminder_start,
    ce.location,
    ce.description
   FROM (calendar_events ce
     LEFT JOIN associations a ON ((a.id = ce.association_id)))
  WHERE ((ce.archived_at IS NULL) AND (ce.reminder_days_before IS NOT NULL) AND (ce.reminder_acknowledged_at IS NULL) AND (now() >= (ce.start_datetime - ((ce.reminder_days_before || ' days'::text))::interval)) AND (now() <= ce.start_datetime)
    AND public.can_access_portfolio(ce.portfolio_id));

-- 4) v_manager_workload -----------------------------------------------------
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
    au.last_sign_in_at AS last_login
   FROM ((((((profiles pr
     JOIN association_managers am ON (((am.user_id = pr.id) AND (am.ended_at IS NULL))))
     JOIN associations a ON (((a.id = am.association_id) AND (a.archived_at IS NULL))))
     LEFT JOIN work_orders wo ON (((wo.association_id = a.id) AND (wo.archived_at IS NULL))))
     LEFT JOIN violation_cases vc ON ((vc.association_id = a.id)))
     LEFT JOIN architectural_requests ar ON ((ar.association_id = a.id)))
     LEFT JOIN auth.users au ON ((au.id = pr.id)))
  WHERE ((pr.hoa_role = ANY (ARRAY['manager'::hoa_role, 'company_admin'::hoa_role])) OR (EXISTS ( SELECT 1
           FROM user_roles ur
          WHERE ((ur.id = pr.role_id) AND (ur.name = ANY (ARRAY['President'::text, 'Property Manager'::text, 'Accountant'::text]))))))
    AND public.can_access_portfolio(a.portfolio_id)
  GROUP BY pr.id, pr.full_name, pr.email, au.last_sign_in_at;

-- 5) v_unit_charge_schedule -------------------------------------------------
create or replace view public.v_unit_charge_schedule as
 SELECT urc.id AS recurring_charge_id,
    urc.unit_id,
    u.unit_number,
    b.association_id,
    a.name AS association_name,
    a.portfolio_id,
    cc.id AS charge_category_id,
    cc.name AS category_name,
    cc.code AS category_code,
    cc.charge_type,
    cc.is_assessment,
    cc.is_fee,
    urc.amount,
    urc.frequency,
    urc.start_date,
    urc.end_date,
    urc.next_post_date,
    urc.last_posted_at,
    urc.active,
    urc.memo,
    urc.identifier
   FROM ((((unit_recurring_charges urc
     JOIN charge_categories cc ON ((cc.id = urc.charge_category_id)))
     JOIN units u ON ((u.id = urc.unit_id)))
     JOIN buildings b ON ((b.id = u.building_id)))
     JOIN associations a ON ((a.id = b.association_id)))
  WHERE public.can_access_portfolio(a.portfolio_id);

-- 6) v_upcoming_expirations -------------------------------------------------
create or replace view public.v_upcoming_expirations as
 SELECT ip.id,
    ip.owner_id,
    ip.association_id,
    ip.policy_number,
    ip.insurance_company,
    ip.coverage_amount,
    ip.liability_amount,
    ip.deductible_amount,
    ip.effective_date,
    ip.expiration_date,
    ip.certificate_file_url,
    ip.extracted_fields,
    ip.extraction_status,
    ip.status,
    ip.notes,
    ip.created_at,
    ip.updated_at,
    ip.archived_at,
    o.full_name AS owner_name,
    o.email AS owner_email,
    a.name AS association_name,
    (ip.expiration_date - CURRENT_DATE) AS days_remaining
   FROM ((insurance_policies ip
     JOIN owners o ON ((o.id = ip.owner_id)))
     LEFT JOIN associations a ON ((a.id = ip.association_id)))
  WHERE ((ip.archived_at IS NULL) AND (ip.status = ANY (ARRAY['active'::text, 'expiring_soon'::text]))
    AND public.can_access_portfolio(o.portfolio_id))
  ORDER BY ip.expiration_date;

-- 7) v_upcoming_maintenance -------------------------------------------------
create or replace view public.v_upcoming_maintenance as
 SELECT mt.id,
    mt.association_id,
    mt.template_id,
    mt.task_name,
    mt.category,
    mt.frequency,
    mt.custom_interval_days,
    mt.vendor_id,
    mt.assigned_staff_id,
    mt.reminder_days,
    mt.priority,
    mt.start_date,
    mt.end_date,
    mt.notes,
    mt.status,
    mt.last_completed_at,
    mt.next_due_date,
    mt.created_at,
    mt.updated_at,
    mt.archived_at,
    a.name AS association_name,
    v.name AS vendor_name,
    (mt.next_due_date - CURRENT_DATE) AS days_until_due
   FROM ((maintenance_tasks mt
     JOIN associations a ON ((a.id = mt.association_id)))
     LEFT JOIN vendors v ON ((v.id = mt.vendor_id)))
  WHERE ((mt.archived_at IS NULL) AND (mt.status = 'active'::text)
    AND public.can_access_portfolio(a.portfolio_id))
  ORDER BY mt.next_due_date;

-- 8) Grants: no anon access; authenticated read-only ------------------------
revoke all on public.v_company_health,
              public.v_company_metrics,
              public.v_due_reminders,
              public.v_manager_workload,
              public.v_role_permissions,
              public.v_unit_charge_schedule,
              public.v_upcoming_expirations,
              public.v_upcoming_maintenance
  from anon;

revoke insert, update, delete, truncate, references, trigger
  on public.v_company_health,
     public.v_company_metrics,
     public.v_due_reminders,
     public.v_manager_workload,
     public.v_role_permissions,
     public.v_unit_charge_schedule,
     public.v_upcoming_expirations,
     public.v_upcoming_maintenance
  from authenticated;
