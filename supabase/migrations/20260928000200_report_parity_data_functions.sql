-- AppFolio report parity: scoped report data functions + full dispatch (captured from live DB 2026-09-28)

CREATE OR REPLACE FUNCTION public.report_data_account_totals(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type,
             sum(jl.debit_amount) as total_debits, sum(jl.credit_amount) as total_credits,
             sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and je.entry_date between prm.df and prm.dt
      group by g.id order by g.number
  ) r;
$function$
;
revoke all on function public.report_data_account_totals(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_account_totals(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_activities_summary(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, ce.title, ce.event_type::text as event_type, ce.start_datetime, ce.end_datetime, ce.location, ce.operations_status
      from public.calendar_events ce cross join prm left join public.associations a on a.id = ce.association_id
      where ce.portfolio_id = p_portfolio_id and ce.archived_at is null and (prm.aid is null or ce.association_id = prm.aid)
        and ce.start_datetime::date between prm.df and prm.dt order by ce.start_datetime
  ) r;
$function$
;
revoke all on function public.report_data_activities_summary(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_activities_summary(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_additional_fees(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, f.label, f.percentage, f.amount, g.name as gl_account
      from public.association_additional_fees f cross join prm join public.associations a on a.id = f.association_id and a.portfolio_id = p_portfolio_id
      left join public.gl_accounts g on g.id = f.gl_account_id where (prm.aid is null or a.id = prm.aid) order by a.name, f.label
  ) r;
$function$
;
revoke all on function public.report_data_additional_fees(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_additional_fees(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_amenities_assigned(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, am.name as amenity, am.allow_reservations, am.pricing_mode::text as pricing_mode, am.price_amount, am.opens_at, am.closes_at
      from public.association_amenities am cross join prm join public.associations a on a.id = am.association_id and a.portfolio_id = p_portfolio_id
      where am.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, am.name
  ) r;
$function$
;
revoke all on function public.report_data_amenities_assigned(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_amenities_assigned(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_ap_transaction_summary(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select v.name as vendor, count(*) as bills, sum(b.amount) as total_billed,
             sum(b.amount) filter (where b.status::text = 'paid') as total_paid,
             sum(b.amount) filter (where b.status::text in ('draft','pending_approval','approved')) as total_unpaid
      from public.payable_bills b cross join prm left join public.vendors v on v.id = b.vendor_id
      where b.portfolio_id = p_portfolio_id and b.archived_at is null and b.status::text <> 'void'
        and (prm.aid is null or b.association_id = prm.aid) and b.bill_date between prm.df and prm.dt
      group by v.id order by total_billed desc
  ) r;
$function$
;
revoke all on function public.report_data_ap_transaction_summary(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_ap_transaction_summary(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_architectural_review(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as owner, ar.title, ar.category, ar.status,
             ar.created_at::date as submitted, ar.decided_at::date as decided, ar.decision_notes
      from public.architectural_requests ar cross join prm
      join public.associations a on a.id = ar.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = ar.unit_id left join public.owners o on o.id = ar.owner_id
      where (prm.aid is null or a.id = prm.aid) and ar.created_at::date between prm.df and prm.dt
      order by ar.created_at desc
  ) r;
$function$
;
revoke all on function public.report_data_architectural_review(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_architectural_review(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_association_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name, a.address, a.city, a.state, a.zip, a.property_type, a.unit_count, a.status, a.site_manager,
             a.management_start_date, a.management_end_date, a.year_built
      from public.associations a cross join prm
      where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name
  ) r;
$function$
;
revoke all on function public.report_data_association_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_association_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_association_inspection(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, i.inspection_type, i.status::text as status, i.scheduled_date, i.completed_date,
             it.area, it.issue, it.severity::text as severity, it.resolved
      from public.inspections i cross join prm
      join public.associations a on a.id = i.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = i.unit_id left join public.inspection_items it on it.inspection_id = i.id
      where i.archived_at is null and (prm.aid is null or a.id = prm.aid) and i.unit_id is null order by i.scheduled_date desc
  ) r;
$function$
;
revoke all on function public.report_data_association_inspection(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_association_inspection(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_association_log(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select al.created_at, al.entity_type, al.action, al.actor_email
      from public.audit_logs al cross join prm
      where al.portfolio_id = p_portfolio_id and al.created_at::date between prm.df and prm.dt order by al.created_at desc limit 5000
  ) r;
$function$
;
revoke all on function public.report_data_association_log(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_association_log(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_association_vendor(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, v.name as vendor, v.trade::text as trade, count(distinct w.id) as work_orders, coalesce(sum(b.amount),0) as billed
      from public.associations a cross join prm
      join public.vendors v on v.portfolio_id = a.portfolio_id and v.archived_at is null
      left join public.work_orders w on w.vendor_id = v.id and w.association_id = a.id
      left join public.payable_bills b on b.vendor_id = v.id and b.association_id = a.id and b.status::text <> 'void'
      where a.portfolio_id = p_portfolio_id and (prm.aid is null or a.id = prm.aid)
      group by a.id, v.id having count(distinct w.id) > 0 or count(b.id) > 0 order by a.name, v.name
  ) r;
$function$
;
revoke all on function public.report_data_association_vendor(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_association_vendor(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_balance_sheet_association_comparison(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, a.name as association, g.account_type::text as account_type,
             sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
      group by g.id, a.id order by g.number, a.name
  ) r;
$function$
;
revoke all on function public.report_data_balance_sheet_association_comparison(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_balance_sheet_association_comparison(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_balance_sheet_comparative(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.dt),0) as current_balance,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.cmp),0) as prior_balance,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.dt),0) - coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date <= prm.cmp),0) as change
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity')
      group by g.id order by g.number
  ) r;
$function$
;
revoke all on function public.report_data_balance_sheet_comparative(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_balance_sheet_comparative(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_bank_account_activity(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select ba.name as bank_account, ba.bank_name, je.entry_date, je.reference_number,
             coalesce(jl.memo, je.memo) as memo, jl.debit_amount as deposits, jl.credit_amount as withdrawals
      from public.bank_accounts ba
      join public.journal_lines jl on jl.gl_account_id = ba.gl_account_id
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      cross join prm
      where ba.portfolio_id = p_portfolio_id and ba.archived_at is null
        and (prm.aid is null or ba.association_id = prm.aid or jl.association_id = prm.aid)
        and je.entry_date between prm.df and prm.dt
      order by ba.name, je.entry_date, je.created_at
  ) r;
$function$
;
revoke all on function public.report_data_bank_account_activity(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_bank_account_activity(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_bank_account_association(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select ba.name as bank_account, ba.purpose::text as purpose, a.name as association,
             (a.operating_bank_account_id = ba.id) as is_operating, (a.reserve_bank_account_id = ba.id) as is_reserve,
             (a.primary_bank_account_id = ba.id) as is_primary
      from public.bank_accounts ba cross join prm join public.associations a on a.id = ba.association_id
      where ba.portfolio_id = p_portfolio_id and ba.archived_at is null and (prm.aid is null or a.id = prm.aid)
      order by a.name, ba.name
  ) r;
$function$
;
revoke all on function public.report_data_bank_account_association(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_bank_account_association(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_bank_account_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select ba.name, ba.bank_name, ba.account_type::text as account_type, ba.purpose::text as purpose, ba.fund_type,
             ('****' || right(coalesce(ba.account_number,''), 4)) as account_last4, a.name as association,
             ba.payments_enabled, ba.auto_reconciliation, ba.last_reconciliation_date
      from public.bank_accounts ba cross join prm left join public.associations a on a.id = ba.association_id
      where ba.portfolio_id = p_portfolio_id and ba.archived_at is null and (prm.aid is null or ba.association_id = prm.aid)
      order by ba.name
  ) r;
$function$
;
revoke all on function public.report_data_bank_account_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_bank_account_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_bill_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select b.bill_number, v.name as vendor, a.name as association, b.bill_date, b.due_date, b.amount,
             b.status::text as status, b.memo, b.paid_at, b.check_number
      from public.payable_bills b
      cross join prm
      left join public.vendors v on v.id = b.vendor_id
      left join public.associations a on a.id = b.association_id
      where b.portfolio_id = p_portfolio_id and b.archived_at is null and (prm.aid is null or b.association_id = prm.aid)
        and b.bill_date between prm.df and prm.dt
      order by b.bill_date, b.bill_number
  ) r;
$function$
;
revoke all on function public.report_data_bill_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_bill_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_board_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, bm.full_name, bm.role::text as role, bm.email, bm.phone, bm.term_start, bm.term_end, bm.active, bm.signature_on_file
      from public.board_members bm cross join prm join public.associations a on a.id = bm.association_id and a.portfolio_id = p_portfolio_id
      where (prm.aid is null or a.id = prm.aid) order by a.name, bm.role::text, bm.full_name
  ) r;
$function$
;
revoke all on function public.report_data_board_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_board_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_board_rollup(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, a.unit_count,
             (select coalesce(sum(ub.balance) filter (where ub.balance > 0), 0) from public.unit_balances ub where ub.association_id = a.id) as delinquent_balance,
             (select count(*) from public.work_orders w where w.association_id = a.id and w.archived_at is null and w.status::text in ('new','assigned','scheduled','in_progress')) as open_work_orders,
             (select count(*) from public.violations v where v.association_id = a.id and v.archived_at is null and v.status::text not in ('cured','closed')) as open_violations,
             (select count(*) from public.architectural_requests ar where ar.association_id = a.id and ar.status = 'pending') as pending_architectural_requests
      from public.associations a cross join prm
      where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name
  ) r;
$function$
;
revoke all on function public.report_data_board_rollup(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_board_rollup(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_board_work_orders(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select w.number, a.name as association, u.unit_number, w.title, w.status::text as status, w.priority::text as priority,
             v.name as vendor, w.owner_approved, w.scheduled_date, w.completed_date
      from public.work_orders w cross join prm join public.associations a on a.id = w.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = w.unit_id left join public.vendors v on v.id = w.vendor_id
      where w.archived_at is null and (prm.aid is null or a.id = prm.aid) and w.created_at::date between prm.df and prm.dt
      order by w.created_at desc
  ) r;
$function$
;
revoke all on function public.report_data_board_work_orders(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_board_work_orders(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_budget_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, bl.fiscal_year, g.number as account_number, g.name as account, bl.category::text as category,
             bl.annual_total, to_jsonb(bl.monthly_amounts) as monthly_amounts
      from public.budget_lines bl cross join prm
      join public.associations a on a.id = bl.association_id and a.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = bl.gl_account_id
      where (prm.aid is null or a.id = prm.aid)
        and bl.fiscal_year = coalesce(nullif(p_params->>'fiscal_year','')::int, extract(year from prm.dt)::int)
      order by a.name, g.number
  ) r;
$function$
;
revoke all on function public.report_data_budget_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_budget_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_building_and_unit(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, b.name as building, u.unit_number, u.sqft, u.bedrooms, u.bathrooms, u.ownership_pct, o.full_name as owner
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id where (prm.aid is null or a.id = prm.aid) and u.archived_at is null order by a.name, b.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_building_and_unit(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_building_and_unit(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_building_list(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, b.name as building, b.address, b.city, b.state, b.zip, b.year_built, b.property_type,
             (select count(*) from public.units u where u.building_id = b.id and u.archived_at is null) as units
      from public.buildings b cross join prm join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      where b.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, b.name
  ) r;
$function$
;
revoke all on function public.report_data_building_list(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_building_list(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_cash_flow(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type,
             sum(jl.credit_amount - jl.debit_amount) as cash_effect
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')) and je.entry_date between prm.df and prm.dt
      group by g.id order by g.number
  ) r;
$function$
;
revoke all on function public.report_data_cash_flow(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_cash_flow(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_cash_flow_12_month(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select to_char(m.month, 'YYYY-MM') as month,
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where g.account_type::text in ('income','other_income')), 0) as income,
             coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')), 0) as expenses,
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating'))), 0) as net_cash_flow
      from prm
      cross join generate_series(date_trunc('month', prm.dt) - interval '11 months', date_trunc('month', prm.dt), interval '1 month') m(month)
      left join public.journal_entries je on je.portfolio_id = p_portfolio_id and je.posted and date_trunc('month', je.entry_date) = m.month
      left join public.journal_lines jl on jl.entry_id = je.id and (prm.aid is null or jl.association_id = prm.aid)
      left join public.gl_accounts g on g.id = jl.gl_account_id and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating'))
      group by m.month order by m.month
  ) r;
$function$
;
revoke all on function public.report_data_cash_flow_12_month(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_cash_flow_12_month(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_cash_flow_association_comparison(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association,
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where g.account_type::text in ('income','other_income')), 0) as income,
             coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')), 0) as expenses,
             coalesce(sum(jl.credit_amount - jl.debit_amount), 0) as net_cash_flow
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')) and je.entry_date between prm.df and prm.dt
      group by a.id order by a.name
  ) r;
$function$
;
revoke all on function public.report_data_cash_flow_association_comparison(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_cash_flow_association_comparison(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_cash_flow_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select je.entry_date, je.reference_number, a.name as association, g.number as account_number, g.name as account,
             coalesce(jl.memo, je.memo) as memo, jl.debit_amount, jl.credit_amount, (jl.credit_amount - jl.debit_amount) as cash_effect
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')) and je.entry_date between prm.df and prm.dt
      order by je.entry_date, g.number
  ) r;
$function$
;
revoke all on function public.report_data_cash_flow_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_cash_flow_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_charge_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, c.charge_type::text as charge_type, c.description,
             c.amount, c.due_date,
             coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0) as amount_paid
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      join public.charges c on c.unit_id = u.id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and c.due_date between prm.df and prm.dt
      order by a.name, u.unit_number, c.due_date
  ) r;
$function$
;
revoke all on function public.report_data_charge_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_charge_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_chart_of_accounts(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type, g.fund_account::text as fund,
             p.number as parent_number, g.active, g.include_on_cash_flow, g.subject_to_management_fees
      from public.gl_accounts g cross join prm
      left join public.gl_accounts p on p.id = g.sub_account_of_id
      where g.portfolio_id = p_portfolio_id and (g.association_id is null or prm.aid is null or g.association_id = prm.aid)
      order by g.number
  ) r;
$function$
;
revoke all on function public.report_data_chart_of_accounts(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_chart_of_accounts(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_check_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select pc.check_number, pc.payment_date, v.name as vendor, a.name as association, ba.name as bank_account,
             pc.amount, pc.status, pb.bill_number, pc.void_reason
      from public.payable_checks pc cross join prm
      left join public.vendors v on v.id = pc.vendor_id
      left join public.associations a on a.id = pc.association_id
      left join public.bank_accounts ba on ba.id = pc.bank_account_id
      left join public.payable_bills pb on pb.id = pc.bill_id
      where pc.portfolio_id = p_portfolio_id and (prm.aid is null or pc.association_id = prm.aid)
        and pc.payment_date between prm.df and prm.dt order by pc.payment_date, pc.check_number
  ) r;
$function$
;
revoke all on function public.report_data_check_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_check_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_data_diagnostics_summary(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select d.category, d.severity::text as severity, count(*) as open_issues, min(d.first_seen_at) as oldest
      from public.data_diagnostics d where d.portfolio_id = p_portfolio_id and d.resolved_at is null group by d.category, d.severity order by open_issues desc
  ) r;
$function$
;
revoke all on function public.report_data_data_diagnostics_summary(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_data_diagnostics_summary(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_delinquency_as_of(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, o.email,
             sum(x.outstanding) as balance, min(x.due_date) as oldest_due_date, (prm.dt - min(x.due_date)) as days_past_due
      from (select c.unit_id, c.due_date,
                   c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id and pa.applied_at::date <= prm.dt), 0) as outstanding
            from prm join public.charges c on c.due_date <= prm.dt) x
      join public.units u on u.id = x.unit_id
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      where x.outstanding > 0.004 and (prm.aid is null or a.id = prm.aid)
      group by a.id, u.id, o.id, prm.dt order by balance desc
  ) r;
$function$
;
revoke all on function public.report_data_delinquency_as_of(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_delinquency_as_of(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_deposit_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.payment_date, a.name as association, u.unit_number, o.full_name as homeowner, p.method, p.reference, p.amount,
             ba.name as bank_account, p.processor
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      join public.payments p on p.unit_id = u.id
      left join public.bank_accounts ba on ba.id = p.bank_account_id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and p.payment_date between prm.df and prm.dt and p.amount > 0 order by p.payment_date, ba.name
  ) r;
$function$
;
revoke all on function public.report_data_deposit_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_deposit_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_dispatch(p_portfolio_id uuid, p_slug text, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  case p_slug
    when 'delinquency' then return public.report_data_delinquency(p_portfolio_id, p_params);
    when 'homeowner_ledger' then return public.report_data_homeowner_ledger(p_portfolio_id, p_params);
    when 'work_order_report' then return public.report_data_work_orders(p_portfolio_id, p_params);
    when 'open_work_orders' then return public.report_data_open_work_orders(p_portfolio_id, p_params);
    when 'property_directory' then return public.report_data_property_directory(p_portfolio_id, p_params);
    when 'vendor_directory' then return public.report_data_vendor_directory(p_portfolio_id, p_params);
    when 'violation_log' then return public.report_data_violation_log(p_portfolio_id, p_params);
    when 'vendor_1099_detail' then return public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'vendor_1099_summary' then return public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'account_totals' then return public.report_data_account_totals(p_portfolio_id, p_params);
    when 'balance_sheet_comparative' then return public.report_data_balance_sheet_comparative(p_portfolio_id, p_params);
    when 'balance_sheet_association_comparison' then return public.report_data_balance_sheet_association_comparison(p_portfolio_id, p_params);
    when 'bank_account_activity' then return public.report_data_bank_account_activity(p_portfolio_id, p_params);
    when 'cash_flow' then return public.report_data_cash_flow(p_portfolio_id, p_params);
    when 'cash_flow_12_month' then return public.report_data_cash_flow_12_month(p_portfolio_id, p_params);
    when 'cash_flow_association_comparison' then return public.report_data_cash_flow_association_comparison(p_portfolio_id, p_params);
    when 'cash_flow_detail' then return public.report_data_cash_flow_detail(p_portfolio_id, p_params);
    when 'expense_distribution' then return public.report_data_expense_distribution(p_portfolio_id, p_params);
    when 'income_statement_12_month' then return public.report_data_income_statement_12_month(p_portfolio_id, p_params);
    when 'income_statement_comparative' then return public.report_data_income_statement_comparative(p_portfolio_id, p_params);
    when 'income_statement_association_comparison' then return public.report_data_income_statement_association_comparison(p_portfolio_id, p_params);
    when 'income_statement_date_range' then return public.report_data_income_statement_date_range(p_portfolio_id, p_params);
    when 'loan_statement' then return public.report_data_loan_statement(p_portfolio_id, p_params);
    when 'trial_balance_association' then return public.report_data_trial_balance_association(p_portfolio_id, p_params);
    when 'trust_account_balance' then return public.report_data_trust_account_balance(p_portfolio_id, p_params);
    when 'trust_account_detail' then return public.report_data_trust_account_detail(p_portfolio_id, p_params);
    when 'chart_of_accounts' then return public.report_data_chart_of_accounts(p_portfolio_id, p_params);
    when 'bank_account_directory' then return public.report_data_bank_account_directory(p_portfolio_id, p_params);
    when 'bank_account_association' then return public.report_data_bank_account_association(p_portfolio_id, p_params);
    when 'fund_balance_sheet' then return public.report_data_fund_balance_sheet(p_portfolio_id, p_params);
    when 'fund_income_statement' then return public.report_data_fund_income_statement(p_portfolio_id, p_params);
    when 'fund_balance_sheet_active_funds' then return public.report_data_fund_balance_sheet_active_funds(p_portfolio_id, p_params);
    when 'bill_detail' then return public.report_data_bill_detail(p_portfolio_id, p_params);
    when 'invoice_register' then return public.report_data_invoice_register(p_portfolio_id, p_params);
    when 'ap_transaction_summary' then return public.report_data_ap_transaction_summary(p_portfolio_id, p_params);
    when 'charge_detail' then return public.report_data_charge_detail(p_portfolio_id, p_params);
    when 'charge_register' then return public.report_data_charge_detail(p_portfolio_id, p_params);
    when 'check_register' then return public.report_data_check_register(p_portfolio_id, p_params);
    when 'check_register_detail' then return public.report_data_check_register(p_portfolio_id, p_params);
    when 'voided_check_register' then return public.report_data_voided_check_register(p_portfolio_id, p_params);
    when 'payment_register' then return public.report_data_payment_register(p_portfolio_id, p_params);
    when 'deposit_register' then return public.report_data_deposit_register(p_portfolio_id, p_params);
    when 'refund_register' then return public.report_data_refund_register(p_portfolio_id, p_params);
    when 'unapplied_receipts' then return public.report_data_unapplied_receipts(p_portfolio_id, p_params);
    when 'expense_register' then return public.report_data_expense_register(p_portfolio_id, p_params);
    when 'income_register' then return public.report_data_income_register(p_portfolio_id, p_params);
    when 'journal_entry_register' then return public.report_data_journal_entry_register(p_portfolio_id, p_params);
    when 'transfer_register' then return public.report_data_transfer_register(p_portfolio_id, p_params);
    when 'unpaid_balances_by_month' then return public.report_data_unpaid_balances_by_month(p_portfolio_id, p_params);
    when 'vendor_payment_register' then return public.report_data_vendor_payment_register(p_portfolio_id, p_params);
    when 'vendor_ledger' then return public.report_data_vendor_ledger(p_portfolio_id, p_params);
    when 'management_fee_summary' then return public.report_data_management_fee_summary(p_portfolio_id, p_params);
    when 'reserve_fund_analysis' then return public.report_data_reserve_fund_analysis(p_portfolio_id, p_params);
    when 'delinquency_as_of' then return public.report_data_delinquency_as_of(p_portfolio_id, p_params);
    when 'architectural_review' then return public.report_data_architectural_review(p_portfolio_id, p_params);
    when 'board_directory' then return public.report_data_board_directory(p_portfolio_id, p_params);
    when 'dues_roll' then return public.report_data_dues_roll(p_portfolio_id, p_params);
    when 'assessment_roll' then return public.report_data_dues_roll(p_portfolio_id, p_params);
    when 'dues_roll_itemized' then return public.report_data_dues_roll_itemized(p_portfolio_id, p_params);
    when 'homeowner_directory' then return public.report_data_homeowner_directory(p_portfolio_id, p_params);
    when 'owner_directory' then return public.report_data_homeowner_directory(p_portfolio_id, p_params);
    when 'resident_directory' then return public.report_data_resident_directory(p_portfolio_id, p_params);
    when 'tenant_directory' then return public.report_data_tenant_directory(p_portfolio_id, p_params);
    when 'homeowner_vehicle_info' then return public.report_data_homeowner_vehicle_info(p_portfolio_id, p_params);
    when 'owner_vehicle_info' then return public.report_data_homeowner_vehicle_info(p_portfolio_id, p_params);
    when 'vehicle_info' then return public.report_data_homeowner_vehicle_info(p_portfolio_id, p_params);
    when 'owner_prepaid' then return public.report_data_owner_prepaid(p_portfolio_id, p_params);
    when 'owner_balance' then return public.report_data_owner_balance(p_portfolio_id, p_params);
    when 'owner_violations' then return public.report_data_owner_violations(p_portfolio_id, p_params);
    when 'email_opt_out' then return public.report_data_email_opt_out(p_portfolio_id, p_params);
    when 'mailing_labels' then return public.report_data_mailing_labels(p_portfolio_id, p_params);
    when 'insurance_expiration_dates' then return public.report_data_insurance_expiration_dates(p_portfolio_id, p_params);
    when 'owner_insurance_audit' then return public.report_data_owner_insurance_audit(p_portfolio_id, p_params);
    when 'association_vendor' then return public.report_data_association_vendor(p_portfolio_id, p_params);
    when 'board_work_orders' then return public.report_data_board_work_orders(p_portfolio_id, p_params);
    when 'board_rollup' then return public.report_data_board_rollup(p_portfolio_id, p_params);
    when 'homeowner_resale' then return public.report_data_homeowner_resale(p_portfolio_id, p_params);
    when 'association_directory' then return public.report_data_association_directory(p_portfolio_id, p_params);
    when 'building_list' then return public.report_data_building_list(p_portfolio_id, p_params);
    when 'building_and_unit' then return public.report_data_building_and_unit(p_portfolio_id, p_params);
    when 'unit_directory' then return public.report_data_unit_directory(p_portfolio_id, p_params);
    when 'units_by_owner' then return public.report_data_units_by_owner(p_portfolio_id, p_params);
    when 'parking_spaces' then return public.report_data_parking_spaces(p_portfolio_id, p_params);
    when 'keys' then return public.report_data_keys(p_portfolio_id, p_params);
    when 'amenities_assigned' then return public.report_data_amenities_assigned(p_portfolio_id, p_params);
    when 'inspection_detail' then return public.report_data_inspection_detail(p_portfolio_id, p_params);
    when 'unit_inspection' then return public.report_data_unit_inspection(p_portfolio_id, p_params);
    when 'association_inspection' then return public.report_data_association_inspection(p_portfolio_id, p_params);
    when 'property_group_directory' then return public.report_data_property_group_directory(p_portfolio_id, p_params);
    when 'property_performance' then return public.report_data_property_performance(p_portfolio_id, p_params);
    when 'activities_summary' then return public.report_data_activities_summary(p_portfolio_id, p_params);
    when 'additional_fees' then return public.report_data_additional_fees(p_portfolio_id, p_params);
    when 'fixed_assets' then return public.report_data_fixed_assets(p_portfolio_id, p_params);
    when 'budget_detail' then return public.report_data_budget_detail(p_portfolio_id, p_params);
    when 'project_directory' then return public.report_data_project_directory(p_portfolio_id, p_params);
    when 'project_budget_detail' then return public.report_data_project_budget_detail(p_portfolio_id, p_params);
    when 'purchase_order' then return public.report_data_purchase_order(p_portfolio_id, p_params);
    when 'purchase_order_detail' then return public.report_data_purchase_order_detail(p_portfolio_id, p_params);
    when 'recurring_work_orders' then return public.report_data_recurring_work_orders(p_portfolio_id, p_params);
    when 'work_order_bill_detail' then return public.report_data_work_order_bill_detail(p_portfolio_id, p_params);
    when 'work_order_labor_summary' then return public.report_data_work_order_labor_summary(p_portfolio_id, p_params);
    when 'maintenance_history' then return public.report_data_maintenance_history(p_portfolio_id, p_params);
    when 'vendor_performance' then return public.report_data_vendor_performance(p_portfolio_id, p_params);
    when 'email_delivery_errors' then return public.report_data_email_delivery_errors(p_portfolio_id, p_params);
    when 'users_and_permissions' then return public.report_data_users_and_permissions(p_portfolio_id, p_params);
    when 'user_roles_permissions' then return public.report_data_user_roles_permissions(p_portfolio_id, p_params);
    when 'login_audit' then return public.report_data_login_audit(p_portfolio_id, p_params);
    when 'data_diagnostics_summary' then return public.report_data_data_diagnostics_summary(p_portfolio_id, p_params);
    when 'residents_check_fee_coverage' then return public.report_data_residents_check_fee_coverage(p_portfolio_id, p_params);
    when 'owner_ledger' then return public.report_data_homeowner_ledger(p_portfolio_id, p_params);
    when 'general_account' then return public.report_data_chart_of_accounts(p_portfolio_id, p_params);
    when 'vendor_tax_detail' then return public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'vendor_tax_summary' then return public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'survey_results' then return public.report_data_survey_results(p_portfolio_id, p_params);
    when 'task_list' then return public.report_data_task_list(p_portfolio_id, p_params);
    when 'association_log' then return public.report_data_association_log(p_portfolio_id, p_params);
    when 'letter_history' then return public.report_data_letter_history(p_portfolio_id, p_params);
    else raise exception 'report slug "%" not implemented', p_slug;
  end case;
end;
$function$
;
revoke all on function public.report_data_dispatch(p_portfolio_id uuid, p_slug text, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_dispatch(p_portfolio_id uuid, p_slug text, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_dues_roll(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, occ.dues_amount, occ.dues_frequency::text as frequency,
             occ.dues_paid_through, coalesce(ub.balance, 0) as balance, occ.online_portal_activated as portal_activated
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      left join public.unit_balances ub on ub.unit_id = u.id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_dues_roll(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_dues_roll(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_dues_roll_itemized(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, cc.name as charge, urc.amount, urc.frequency::text as frequency,
             urc.start_date, urc.end_date, urc.next_post_date, urc.active
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      join public.unit_recurring_charges urc on urc.unit_id = u.id
      left join public.charge_categories cc on cc.id = urc.charge_category_id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null order by a.name, u.unit_number, cc.name
  ) r;
$function$
;
revoke all on function public.report_data_dues_roll_itemized(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_dues_roll_itemized(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_email_delivery_errors(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select eq.created_at, eq.to_email, eq.subject, eq.status, eq.attempt_count, eq.error_message
      from public.email_queue eq cross join prm
      where eq.portfolio_id = p_portfolio_id and eq.status in ('failed','error','bounced') and eq.created_at::date between prm.df and prm.dt order by eq.created_at desc
  ) r;
$function$
;
revoke all on function public.report_data_email_delivery_errors(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_email_delivery_errors(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_email_opt_out(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, o.email, o.preferred_comm, o.electronic_consent
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and o.id is not null and coalesce(o.electronic_consent, false) = false order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_email_opt_out(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_email_opt_out(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_expense_distribution(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select number, name, amount, round(100 * amount / nullif(sum(amount) over (), 0), 2) as pct_of_total
      from (select g.number, g.name, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
            from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating') and je.entry_date between prm.df and prm.dt
            group by g.id) x
      order by amount desc
  ) r;
$function$
;
revoke all on function public.report_data_expense_distribution(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_expense_distribution(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_expense_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select je.entry_date, je.reference_number, a.name as association, g.number as account_number, g.name as account,
             coalesce(jl.memo, je.memo) as memo, (public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating') and je.entry_date between prm.df and prm.dt order by je.entry_date, g.number
  ) r;
$function$
;
revoke all on function public.report_data_expense_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_expense_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_fixed_assets(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, fa.name, fa.asset_type, fa.purchase_date, fa.purchase_price, fa.salvage_value, fa.useful_life_years,
             fa.depreciation_method::text as method, fa.accumulated_depreciation, (fa.purchase_price - fa.accumulated_depreciation) as net_book_value, fa.status::text as status
      from public.fixed_assets fa cross join prm left join public.associations a on a.id = fa.association_id
      where fa.portfolio_id = p_portfolio_id and fa.archived_at is null and (prm.aid is null or fa.association_id = prm.aid) order by a.name, fa.name
  ) r;
$function$
;
revoke all on function public.report_data_fixed_assets(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_fixed_assets(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_fund_balance_sheet(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select coalesce(g.fund_account::text, 'unassigned') as fund, g.number, g.name, g.account_type::text as account_type, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
      group by g.fund_account, g.id order by 1, g.number
  ) r;
$function$
;
revoke all on function public.report_data_fund_balance_sheet(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_fund_balance_sheet(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_fund_balance_sheet_active_funds(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select fund, sum(case when section = 'asset' then bal else 0 end) as assets,
             sum(case when section = 'liability' then bal else 0 end) as liabilities,
             sum(case when section = 'equity' then bal else 0 end) as equity
      from (select coalesce(g.fund_account::text,'unassigned') as fund,
                   case when g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset') then 'asset'
                        when g.account_type::text in ('liability','accounts_payable') then 'liability' else 'equity' end as section,
                   sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as bal
            from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
            group by g.fund_account, g.id, g.account_type) x
      group by fund having sum(abs(bal)) > 0 order by fund
  ) r;
$function$
;
revoke all on function public.report_data_fund_balance_sheet_active_funds(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_fund_balance_sheet_active_funds(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_fund_income_statement(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select coalesce(g.fund_account::text, 'unassigned') as fund, g.number, g.name, g.account_type::text as account_type, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')) and je.entry_date between prm.df and prm.dt
      group by g.fund_account, g.id order by 1, g.number
  ) r;
$function$
;
revoke all on function public.report_data_fund_income_statement(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_fund_income_statement(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_homeowner_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, o.email, o.phone, o.mailing_address,
             o.portal_activated, o.electronic_consent, o.preferred_comm
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and o.id is not null and o.archived_at is null order by o.full_name, a.name
  ) r;
$function$
;
revoke all on function public.report_data_homeowner_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_homeowner_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_homeowner_resale(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, coalesce(ub.balance,0) as balance_due,
             occ.dues_amount, occ.dues_frequency::text as dues_frequency, occ.dues_paid_through,
             (select count(*) from public.violations v where v.unit_id = u.id and v.archived_at is null and v.status::text not in ('cured','closed')) as open_violations,
             (select count(*) from public.architectural_requests ar where ar.unit_id = u.id and ar.status = 'pending') as pending_arc_requests,
             a.insurance_expiration as master_policy_expiration
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      left join public.unit_balances ub on ub.unit_id = u.id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and (nullif(p_params->>'unit_id','') is null or u.id = (p_params->>'unit_id')::uuid) order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_homeowner_resale(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_homeowner_resale(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_homeowner_vehicle_info(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as owner, ov.make, ov.model, ov.color, ov.year, ov.license_plate, ov.plate_state
      from public.owner_vehicles ov cross join prm
      join public.owners o on o.id = ov.owner_id and o.portfolio_id = p_portfolio_id
      left join public.occupancies occ on occ.owner_id = o.id and occ.status = 'current'
      left join public.units u on u.id = occ.unit_id
      left join public.buildings b on b.id = u.building_id
      left join public.associations a on a.id = b.association_id
      where ov.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_homeowner_vehicle_info(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_homeowner_vehicle_info(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_income_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select je.entry_date, je.reference_number, a.name as association, g.number as account_number, g.name as account,
             coalesce(jl.memo, je.memo) as memo, (public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('income','other_income') and je.entry_date between prm.df and prm.dt order by je.entry_date, g.number
  ) r;
$function$
;
revoke all on function public.report_data_income_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_income_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_income_statement_12_month(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type,
             to_char(date_trunc('month', je.entry_date), 'YYYY-MM') as month, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating'))
        and je.entry_date >= (date_trunc('month', prm.dt) - interval '11 months') and je.entry_date <= prm.dt
      group by g.id, date_trunc('month', je.entry_date) order by g.number, 4
  ) r;
$function$
;
revoke all on function public.report_data_income_statement_12_month(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_income_statement_12_month(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_income_statement_association_comparison(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, a.name as association, g.account_type::text as account_type, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')) and je.entry_date between prm.df and prm.dt
      group by g.id, a.id order by g.number, a.name
  ) r;
$function$
;
revoke all on function public.report_data_income_statement_association_comparison(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_income_statement_association_comparison(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_income_statement_comparative(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date between prm.df and prm.dt), 0) as current_period,
             coalesce(sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) filter (where je.entry_date between (prm.df - interval '1 year')::date and (prm.dt - interval '1 year')::date), 0) as prior_period
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating'))
      group by g.id order by g.number
  ) r;
$function$
;
revoke all on function public.report_data_income_statement_comparative(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_income_statement_comparative(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_income_statement_date_range(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name, g.account_type::text as account_type, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and (g.account_type::text in ('income','other_income') or g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')) and je.entry_date between prm.df and prm.dt
      group by g.id order by g.number
  ) r;
$function$
;
revoke all on function public.report_data_income_statement_date_range(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_income_statement_date_range(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_inspection_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, i.inspection_type, i.status::text as status, i.scheduled_date, i.completed_date,
             it.area, it.issue, it.severity::text as severity, it.resolved
      from public.inspections i cross join prm
      join public.associations a on a.id = i.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = i.unit_id left join public.inspection_items it on it.inspection_id = i.id
      where i.archived_at is null and (prm.aid is null or a.id = prm.aid) order by i.scheduled_date desc
  ) r;
$function$
;
revoke all on function public.report_data_inspection_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_inspection_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_insurance_expiration_dates(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, o.full_name as owner, ip.insurance_company, ip.policy_number, ip.effective_date, ip.expiration_date,
             (ip.expiration_date - current_date) as days_until_expiration, ip.status
      from public.insurance_policies ip cross join prm
      join public.associations a on a.id = ip.association_id and a.portfolio_id = p_portfolio_id
      left join public.owners o on o.id = ip.owner_id
      where ip.archived_at is null and (prm.aid is null or a.id = prm.aid)
        and ip.expiration_date <= current_date + coalesce(nullif(p_params->>'days','')::int, 90)
      order by ip.expiration_date
  ) r;
$function$
;
revoke all on function public.report_data_insurance_expiration_dates(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_insurance_expiration_dates(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_invoice_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select public.report_data_bill_detail(p_portfolio_id, p_params);
$function$
;
revoke all on function public.report_data_invoice_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_invoice_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_journal_entry_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select je.entry_date, je.reference_number, coalesce(je.memo, je.description) as memo, je.source_type,
             je.posted, sum(jl.debit_amount) as total_debits, sum(jl.credit_amount) as total_credits, count(*) as line_count
      from public.journal_entries je cross join prm
      join public.journal_lines jl on jl.entry_id = je.id
      where je.portfolio_id = p_portfolio_id and je.entry_date between prm.df and prm.dt
        and (prm.aid is null or jl.association_id = prm.aid)
      group by je.id order by je.entry_date, je.reference_number
  ) r;
$function$
;
revoke all on function public.report_data_journal_entry_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_journal_entry_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_keys(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, k.label, k.key_number, k.held_by, k.notes
      from public.association_keys k cross join prm join public.associations a on a.id = k.association_id and a.portfolio_id = p_portfolio_id
      where k.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, k.label
  ) r;
$function$
;
revoke all on function public.report_data_keys(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_keys(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_letter_history(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select eq.created_at, a.name as association, eq.to_name as recipient, eq.to_email, eq.subject, eq.status, eq.sent_at
      from public.email_queue eq cross join prm left join public.associations a on a.id = eq.association_id
      where eq.portfolio_id = p_portfolio_id and (prm.aid is null or eq.association_id = prm.aid) and eq.created_at::date between prm.df and prm.dt order by eq.created_at desc limit 5000
  ) r;
$function$
;
revoke all on function public.report_data_letter_history(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_letter_history(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_loan_statement(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, l.lender, l.loan_type, l.original_principal, l.current_balance, l.interest_rate,
             l.term_months, l.start_date, l.maturity_date, l.payment_amount, l.payment_frequency, l.next_payment_date, l.status
      from public.association_loans l join public.associations a on a.id = l.association_id
      cross join prm
      where l.portfolio_id = p_portfolio_id and l.archived_at is null and (prm.aid is null or a.id = prm.aid)
      order by a.name, l.lender
  ) r;
$function$
;
revoke all on function public.report_data_loan_statement(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_loan_statement(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_login_audit(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select la.at, la.email, la.success, la.failure_reason, la.mfa_used, la.ip_address
      from public.login_attempts la cross join prm where la.portfolio_id = p_portfolio_id and la.at::date between prm.df and prm.dt order by la.at desc
  ) r;
$function$
;
revoke all on function public.report_data_login_audit(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_login_audit(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_mailing_labels(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select o.full_name as name, coalesce(nullif(o.mailing_address,''), concat_ws(', ', o.address_street, o.address_city, o.address_state, o.address_zip)) as mailing_address,
             a.name as association, u.unit_number
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and o.id is not null order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_mailing_labels(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_mailing_labels(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_maintenance_history(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select w.number, a.name as association, u.unit_number, w.title, w.category::text as category, w.status::text as status, v.name as vendor, w.completed_date
      from public.work_orders w cross join prm join public.associations a on a.id = w.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = w.unit_id left join public.vendors v on v.id = w.vendor_id
      where w.archived_at is null and w.status::text in ('done','completed','billed','closed') and (prm.aid is null or a.id = prm.aid)
        and coalesce(w.completed_date, w.created_at::date) between prm.df and prm.dt order by w.completed_date desc nulls last
  ) r;
$function$
;
revoke all on function public.report_data_maintenance_history(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_maintenance_history(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_management_fee_summary(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, to_char(mf.month, 'YYYY-MM') as month, mf.door_count,
             mf.fee_amount_cents / 100.0 as fee_amount, mf.collected_cents / 100.0 as collected, mf.delinquent_cents / 100.0 as delinquent
      from public.management_fees mf cross join prm join public.associations a on a.id = mf.association_id
      where mf.portfolio_id = p_portfolio_id and (prm.aid is null or a.id = prm.aid) and mf.month between prm.df and prm.dt
      order by mf.month, a.name
  ) r;
$function$
;
revoke all on function public.report_data_management_fee_summary(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_management_fee_summary(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_owner_balance(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, ub.total_charges, ub.total_payments, ub.balance
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id join public.unit_balances ub on ub.unit_id = u.id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_owner_balance(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_owner_balance(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_owner_insurance_audit(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner,
             max(ip.expiration_date) as latest_expiration,
             case when max(ip.expiration_date) is null then 'No policy on file'
                  when max(ip.expiration_date) < current_date then 'Expired'
                  when max(ip.expiration_date) < current_date + 30 then 'Expiring within 30 days' else 'Current' end as insurance_status
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      left join public.insurance_policies ip on ip.owner_id = o.id and ip.association_id = a.id and ip.archived_at is null
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and o.id is not null group by a.id, u.id, o.id order by insurance_status, a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_owner_insurance_audit(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_owner_insurance_audit(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_owner_prepaid(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as homeowner, -ub.balance as prepaid_credit
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id join public.unit_balances ub on ub.unit_id = u.id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and ub.balance < -0.004 order by prepaid_credit desc
  ) r;
$function$
;
revoke all on function public.report_data_owner_prepaid(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_owner_prepaid(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_owner_violations(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, o.full_name as owner, v.title, v.violation_type::text as type, v.status::text as status,
             v.date_observed, v.cure_deadline, v.fine_amount, v.closed_at
      from public.violations v cross join prm join public.associations a on a.id = v.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = v.unit_id left join public.owners o on o.id = v.owner_id
      where v.archived_at is null and (prm.aid is null or a.id = prm.aid) order by v.date_observed desc
  ) r;
$function$
;
revoke all on function public.report_data_owner_violations(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_owner_violations(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_parking_spaces(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, ps.label, ps.space_type, ps.monthly_fee, ps.deposit_amount, ps.active, ps.notes
      from public.parking_spaces ps cross join prm join public.associations a on a.id = ps.association_id and a.portfolio_id = p_portfolio_id
      where ps.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, ps.label
  ) r;
$function$
;
revoke all on function public.report_data_parking_spaces(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_parking_spaces(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_payment_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.payment_date, a.name as association, u.unit_number, o.full_name as homeowner, p.method, p.reference, p.amount,
             ba.name as bank_account, p.processor
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      join public.payments p on p.unit_id = u.id
      left join public.bank_accounts ba on ba.id = p.bank_account_id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and p.payment_date between prm.df and prm.dt order by p.payment_date, a.name
  ) r;
$function$
;
revoke all on function public.report_data_payment_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_payment_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_project_budget_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, cp.name, cp.status, cp.budget_amount, cp.contingency_amount, cp.approved_budget_amount,
             coalesce((select sum(b.amount) from public.capital_project_work_orders cw join public.payable_bills b on b.work_order_id = cw.work_order_id where cw.project_id = cp.id and b.status::text <> 'void'),0) as billed_to_date
      from public.capital_projects cp cross join prm join public.associations a on a.id = cp.association_id
      where cp.portfolio_id = p_portfolio_id and cp.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, cp.name
  ) r;
$function$
;
revoke all on function public.report_data_project_budget_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_project_budget_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_project_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, cp.name, cp.status, cp.priority, cp.start_date, cp.target_end_date, cp.budget_amount, cp.approved_budget_amount, cp.board_approved_at
      from public.capital_projects cp cross join prm join public.associations a on a.id = cp.association_id
      where cp.portfolio_id = p_portfolio_id and cp.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, cp.name
  ) r;
$function$
;
revoke all on function public.report_data_project_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_project_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_property_group_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select pg.name, pg.description, count(a.id) as associations, coalesce(sum(a.unit_count),0) as units
      from public.property_groups pg left join public.associations a on a.property_group_id = pg.id and a.archived_at is null
      where pg.portfolio_id = p_portfolio_id group by pg.id order by pg.name
  ) r;
$function$
;
revoke all on function public.report_data_property_group_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_property_group_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_property_performance(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, a.unit_count,
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where g.account_type::text in ('income','other_income')), 0) as income,
             coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')), 0) as expenses,
             coalesce(sum(jl.credit_amount - jl.debit_amount) filter (where g.account_type::text in ('income','other_income')), 0) - coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where g.account_type::text in ('expense','cost_of_goods_sold','other_expense','non_operating')), 0) as net_operating_income
      from prm cross join public.associations a
      left join public.journal_lines jl on jl.association_id = a.id
      left join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id and je.entry_date between prm.df and prm.dt
      left join public.gl_accounts g on g.id = jl.gl_account_id
      where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid) and (je.id is not null or jl.id is null)
      group by a.id order by a.name
  ) r;
$function$
;
revoke all on function public.report_data_property_performance(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_property_performance(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_purchase_order(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select po.number, a.name as association, v.name as vendor, po.status::text as status, po.po_total, po.po_billed, (po.po_total - po.po_billed) as remaining, po.created_at::date as created
      from public.purchase_orders po cross join prm left join public.associations a on a.id = po.association_id left join public.vendors v on v.id = po.vendor_id
      where po.portfolio_id = p_portfolio_id and po.archived_at is null and (prm.aid is null or po.association_id = prm.aid) order by po.created_at desc
  ) r;
$function$
;
revoke all on function public.report_data_purchase_order(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_purchase_order(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_purchase_order_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select po.number, v.name as vendor, po.status::text as status, li.description, li.qty, li.unit_price, li.line_total, g.name as gl_account
      from public.purchase_orders po cross join prm
      left join public.vendors v on v.id = po.vendor_id
      left join public.purchase_order_line_items li on li.purchase_order_id = po.id
      left join public.gl_accounts g on g.id = li.gl_account_id
      where po.portfolio_id = p_portfolio_id and po.archived_at is null and (prm.aid is null or po.association_id = prm.aid) order by po.number, li.sort_order
  ) r;
$function$
;
revoke all on function public.report_data_purchase_order_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_purchase_order_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_recurring_work_orders(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, r.title, r.trade::text as trade, r.frequency::text as frequency, r.interval_count, r.start_date, r.end_date, r.next_due_date, v.name as vendor, r.auto_generate
      from public.recurring_work_orders r cross join prm left join public.associations a on a.id = r.association_id left join public.vendors v on v.id = r.vendor_id
      where r.portfolio_id = p_portfolio_id and r.archived_at is null and (prm.aid is null or r.association_id = prm.aid) order by r.next_due_date
  ) r;
$function$
;
revoke all on function public.report_data_recurring_work_orders(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_recurring_work_orders(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_refund_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.payment_date, a.name as association, u.unit_number, o.full_name as homeowner, p.method, p.reference, p.amount,
             ba.name as bank_account, p.processor
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      join public.payments p on p.unit_id = u.id
      left join public.bank_accounts ba on ba.id = p.bank_account_id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and p.payment_date between prm.df and prm.dt and p.amount < 0 order by p.payment_date
  ) r;
$function$
;
revoke all on function public.report_data_refund_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_refund_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_reserve_fund_analysis(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, rf.target_amount, rf.monthly_contribution, rf.percent_funded, rf.last_study_date, rf.next_study_due, rf.notes
      from public.reserve_fund_settings rf cross join prm join public.associations a on a.id = rf.association_id
      where rf.portfolio_id = p_portfolio_id and (prm.aid is null or a.id = prm.aid) order by a.name
  ) r;
$function$
;
revoke all on function public.report_data_reserve_fund_analysis(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_reserve_fund_analysis(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_resident_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select association, unit_number, resident, resident_type, email, phone
      from (select a.name as association, u.unit_number, o.full_name as resident, 'Owner' as resident_type, o.email, o.phone, a.id as aid, u.archived_at
            from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id where o.id is not null
            union all
            select a.name, u.unit_number, trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), 'Renter', t.email, t.phone, a.id, u.archived_at
            from public.tenants t join public.units u on u.id = t.unit_id join public.buildings b on b.id = u.building_id
            join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
            where t.archived_at is null) x
      cross join prm where (prm.aid is null or x.aid = prm.aid) and x.archived_at is null order by association, unit_number
  ) r;
$function$
;
revoke all on function public.report_data_resident_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_resident_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_residents_check_fee_coverage(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, a.residents_check_fee_coverage_enabled as coverage_enabled
      from public.associations a cross join prm where a.portfolio_id = p_portfolio_id and a.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name
  ) r;
$function$
;
revoke all on function public.report_data_residents_check_fee_coverage(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_residents_check_fee_coverage(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_survey_results(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select s.name as survey, s.survey_type, sr.submitted_at, coalesce(sr.submitted_by_name, '') as submitted_by, sr.submitted_by_email, sr.rating, sr.comments
      from public.survey_responses sr cross join prm join public.surveys s on s.id = sr.survey_id
      where s.portfolio_id = p_portfolio_id and sr.submitted_at::date between prm.df and prm.dt order by sr.submitted_at desc
  ) r;
$function$
;
revoke all on function public.report_data_survey_results(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_survey_results(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_task_list(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, t.task_type, t.title, t.status, t.due_at, t.completed_at
      from public.automation_tasks t cross join prm left join public.associations a on a.id = t.association_id
      where t.portfolio_id = p_portfolio_id and (prm.aid is null or t.association_id = prm.aid) order by t.due_at nulls last
  ) r;
$function$
;
revoke all on function public.report_data_task_list(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_task_list(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_tenant_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')) as renter,
             t.email, t.phone, t.lease_start, t.lease_end, t.insurance_expiration, t.status
      from public.tenants t cross join prm join public.associations a on a.id = t.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = t.unit_id
      where t.archived_at is null and (prm.aid is null or a.id = prm.aid) order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_tenant_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_tenant_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_transfer_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select bt.transfer_date, fa.name as from_account, ta.name as to_account, bt.amount, bt.reference_number, bt.memo
      from public.bank_transfers bt cross join prm
      left join public.bank_accounts fa on fa.id = bt.from_bank_account_id
      left join public.bank_accounts ta on ta.id = bt.to_bank_account_id
      where bt.portfolio_id = p_portfolio_id and bt.transfer_date between prm.df and prm.dt
        and (prm.aid is null or fa.association_id = prm.aid or ta.association_id = prm.aid)
      order by bt.transfer_date
  ) r;
$function$
;
revoke all on function public.report_data_transfer_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_transfer_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_trial_balance_association(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, g.number, g.name, g.account_type::text as account_type,
             sum(jl.debit_amount) as debits, sum(jl.credit_amount) as credits, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id
      cross join prm
      left join public.associations a on a.id = jl.association_id
      where (prm.aid is null or jl.association_id = prm.aid) and je.entry_date <= prm.dt
      group by a.id, g.id order by a.name, g.number
  ) r;
$function$
;
revoke all on function public.report_data_trial_balance_association(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_trial_balance_association(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_trust_account_balance(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select ba.name as bank_account, ba.bank_name, aa.name as association,
             coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where je.entry_date <= prm.dt), 0) as balance
      from public.bank_accounts ba
      cross join prm
      left join public.associations aa on aa.id = ba.association_id
      left join public.journal_lines jl on jl.gl_account_id = ba.gl_account_id
      left join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      where ba.portfolio_id = p_portfolio_id and ba.archived_at is null and ba.purpose::text = 'trust'
        and (prm.aid is null or ba.association_id = prm.aid)
      group by ba.id, aa.name order by ba.name
  ) r;
$function$
;
revoke all on function public.report_data_trust_account_balance(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_trust_account_balance(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_trust_account_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select ba.name as bank_account, je.entry_date, je.reference_number, coalesce(jl.memo, je.memo) as memo,
             jl.debit_amount as deposits, jl.credit_amount as withdrawals
      from public.bank_accounts ba
      cross join prm
      join public.journal_lines jl on jl.gl_account_id = ba.gl_account_id
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      where ba.portfolio_id = p_portfolio_id and ba.purpose::text = 'trust' and (prm.aid is null or ba.association_id = prm.aid)
        and je.entry_date between prm.df and prm.dt
      order by ba.name, je.entry_date
  ) r;
$function$
;
revoke all on function public.report_data_trust_account_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_trust_account_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_unapplied_receipts(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.payment_date, a.name as association, u.unit_number, o.full_name as homeowner, p.method, p.reference, p.amount,
             p.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.payment_id = p.id), 0) as unapplied_amount
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      join public.payments p on p.unit_id = u.id
      where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and p.amount > 0
        and p.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.payment_id = p.id), 0) > 0.004
      order by p.payment_date
  ) r;
$function$
;
revoke all on function public.report_data_unapplied_receipts(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_unapplied_receipts(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_unit_directory(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, b.name as building, u.unit_number, u.sqft, u.bedrooms, u.bathrooms, u.ownership_pct,
             u.parking_spaces, u.storage_number, o.full_name as owner, o.email as owner_email
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id where (prm.aid is null or a.id = prm.aid) and u.archived_at is null order by a.name, u.unit_number
  ) r;
$function$
;
revoke all on function public.report_data_unit_directory(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_unit_directory(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_unit_inspection(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select a.name as association, u.unit_number, i.inspection_type, i.status::text as status, i.scheduled_date, i.completed_date,
             it.area, it.issue, it.severity::text as severity, it.resolved
      from public.inspections i cross join prm
      join public.associations a on a.id = i.association_id and a.portfolio_id = p_portfolio_id
      left join public.units u on u.id = i.unit_id left join public.inspection_items it on it.inspection_id = i.id
      where i.archived_at is null and (prm.aid is null or a.id = prm.aid) and i.unit_id is not null order by i.scheduled_date desc
  ) r;
$function$
;
revoke all on function public.report_data_unit_inspection(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_unit_inspection(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_units_by_owner(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select o.full_name as owner, o.email, count(*) as units, string_agg(a.name || ' #' || u.unit_number, '; ' order by a.name, u.unit_number) as unit_list
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and o.id is not null group by o.id order by o.full_name
  ) r;
$function$
;
revoke all on function public.report_data_units_by_owner(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_units_by_owner(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_unpaid_balances_by_month(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select to_char(date_trunc('month', x.due_date), 'YYYY-MM') as month, count(*) as open_charges, sum(x.outstanding) as outstanding
      from (select c.due_date, c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0) as outstanding
            from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id and a.portfolio_id = p_portfolio_id
      cross join prm
            join public.charges c on c.unit_id = u.id
            where (prm.aid is null or a.id = prm.aid) and u.archived_at is null and c.due_date <= prm.dt) x
      where x.outstanding > 0.004 group by 1 order by 1
  ) r;
$function$
;
revoke all on function public.report_data_unpaid_balances_by_month(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_unpaid_balances_by_month(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_user_roles_permissions(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.full_name, p.email, p.hoa_role::text as role, p.mvp_role::text as company_role, p.last_login_at, p.mfa_enrolled_at is not null as mfa_enrolled, p.disabled_at is not null as disabled
      from public.profiles p where p.portfolio_id = p_portfolio_id order by p.full_name
  ) r;
$function$
;
revoke all on function public.report_data_user_roles_permissions(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_user_roles_permissions(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_users_and_permissions(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.full_name, p.email, p.hoa_role::text as role, p.mvp_role::text as company_role, p.last_login_at, p.mfa_enrolled_at is not null as mfa_enrolled, p.disabled_at is not null as disabled
      from public.profiles p where p.portfolio_id = p_portfolio_id order by p.full_name
  ) r;
$function$
;
revoke all on function public.report_data_users_and_permissions(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_users_and_permissions(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_vendor_ledger(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select v.name as vendor, x.txn_date, x.txn_type, x.reference, x.association, x.debit, x.credit
      from (select b.vendor_id, b.bill_date as txn_date, 'Bill' as txn_type, b.bill_number as reference, a.name as association,
                   0::numeric as debit, b.amount as credit, b.portfolio_id, b.association_id
            from public.payable_bills b left join public.associations a on a.id = b.association_id
            where b.archived_at is null and b.status::text <> 'void'
            union all
            select pc.vendor_id, pc.payment_date, 'Payment', pc.check_number::text, a.name, pc.amount, 0::numeric, pc.portfolio_id, pc.association_id
            from public.payable_checks pc left join public.associations a on a.id = pc.association_id
            where pc.voided_at is null) x
      cross join prm join public.vendors v on v.id = x.vendor_id
      where x.portfolio_id = p_portfolio_id and (prm.aid is null or x.association_id = prm.aid) and x.txn_date between prm.df and prm.dt
      order by v.name, x.txn_date
  ) r;
$function$
;
revoke all on function public.report_data_vendor_ledger(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_vendor_ledger(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_vendor_payment_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select v.name as vendor, count(*) as checks, sum(pc.amount) as total_paid, min(pc.payment_date) as first_payment, max(pc.payment_date) as last_payment
      from public.payable_checks pc cross join prm left join public.vendors v on v.id = pc.vendor_id
      where pc.portfolio_id = p_portfolio_id and pc.voided_at is null and (prm.aid is null or pc.association_id = prm.aid)
        and pc.payment_date between prm.df and prm.dt
      group by v.id order by total_paid desc
  ) r;
$function$
;
revoke all on function public.report_data_vendor_payment_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_vendor_payment_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_vendor_performance(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select v.name as vendor, v.trade::text as trade, count(w.id) as work_orders,
             count(w.id) filter (where w.status::text in ('done','completed','billed','closed')) as completed,
             round(avg(w.completed_date - w.created_at::date) filter (where w.completed_date is not null), 1) as avg_days_to_complete
      from public.vendors v cross join prm left join public.work_orders w on w.vendor_id = v.id and w.archived_at is null and (prm.aid is null or w.association_id = prm.aid)
      where v.portfolio_id = p_portfolio_id and v.archived_at is null group by v.id having count(w.id) > 0 order by work_orders desc
  ) r;
$function$
;
revoke all on function public.report_data_vendor_performance(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_vendor_performance(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_voided_check_register(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select pc.check_number, pc.payment_date, v.name as vendor, a.name as association, ba.name as bank_account,
             pc.amount, pc.status, pb.bill_number, pc.void_reason
      from public.payable_checks pc cross join prm
      left join public.vendors v on v.id = pc.vendor_id
      left join public.associations a on a.id = pc.association_id
      left join public.bank_accounts ba on ba.id = pc.bank_account_id
      left join public.payable_bills pb on pb.id = pc.bill_id
      where pc.portfolio_id = p_portfolio_id and (prm.aid is null or pc.association_id = prm.aid)
        and pc.payment_date between prm.df and prm.dt and pc.voided_at is not null order by pc.voided_at
  ) r;
$function$
;
revoke all on function public.report_data_voided_check_register(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_voided_check_register(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_work_order_bill_detail(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select w.number as work_order, w.title, v.name as vendor, b.bill_number, b.bill_date, b.amount, b.status::text as status
      from public.payable_bills b cross join prm join public.work_orders w on w.id = b.work_order_id
      left join public.vendors v on v.id = b.vendor_id
      where b.portfolio_id = p_portfolio_id and b.archived_at is null and (prm.aid is null or b.association_id = prm.aid) and b.bill_date between prm.df and prm.dt
      order by b.bill_date
  ) r;
$function$
;
revoke all on function public.report_data_work_order_bill_detail(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_work_order_bill_detail(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.report_data_work_order_labor_summary(p_portfolio_id uuid, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select w.number as work_order, w.title, l.tech_name, l.date_worked, l.hours, l.hourly_rate, l.labor_cost
      from public.work_order_labor_entries l cross join prm join public.work_orders w on w.id = l.work_order_id
      where w.portfolio_id = p_portfolio_id and (prm.aid is null or w.association_id = prm.aid) and l.date_worked between prm.df and prm.dt order by l.date_worked
  ) r;
$function$
;
revoke all on function public.report_data_work_order_labor_summary(p_portfolio_id uuid, p_params jsonb) from public, anon, authenticated;
grant execute on function public.report_data_work_order_labor_summary(p_portfolio_id uuid, p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.rpt_prm(p_params jsonb)
 RETURNS TABLE(aid uuid, df date, dt date, cmp date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select nullif(p_params->>'association_id','')::uuid,
  coalesce(nullif(p_params->>'date_from','')::date, date_trunc('year', current_date)::date),
  coalesce(nullif(p_params->>'date_to','')::date, current_date),
  coalesce(nullif(p_params->>'compare_to','')::date, (coalesce(nullif(p_params->>'date_to','')::date, current_date) - interval '1 year')::date) $function$
;
revoke all on function public.rpt_prm(p_params jsonb) from public, anon, authenticated;
grant execute on function public.rpt_prm(p_params jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.rpt_sign(t text, d numeric, c numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select case when t in ('asset','cash','accounts_receivable','fixed_asset','expense','cost_of_goods_sold','other_expense','non_operating') then d - c else c - d end $function$
;
revoke all on function public.rpt_sign(t text, d numeric, c numeric) from public, anon, authenticated;
grant execute on function public.rpt_sign(t text, d numeric, c numeric) to service_role;
