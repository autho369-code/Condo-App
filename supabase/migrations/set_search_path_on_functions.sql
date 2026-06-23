-- Advisor "Function Search Path Mutable": pin search_path on the app's own 20
-- functions to the codebase convention ('pg_catalog','public'). No behavior
-- change (they already resolve against these schemas). Applied 2026-06-22.
alter function amenity_reservations_touch_updated_at() set search_path = 'pg_catalog', 'public';
alter function association_operating_account(uuid) set search_path = 'pg_catalog', 'public';
alter function association_reserve_account(uuid) set search_path = 'pg_catalog', 'public';
alter function calc_next_maintenance_due(text,integer,date) set search_path = 'pg_catalog', 'public';
alter function dispatch_calendar_maintenance_notify() set search_path = 'pg_catalog', 'public';
alter function dispatch_calendar_sms_notify() set search_path = 'pg_catalog', 'public';
alter function ensure_operating_and_reserve_accounts() set search_path = 'pg_catalog', 'public';
alter function generate_invite_token() set search_path = 'pg_catalog', 'public';
alter function generate_owner_payable_number() set search_path = 'pg_catalog', 'public';
alter function generate_portfolio_slug() set search_path = 'pg_catalog', 'public';
alter function log_audit_event() set search_path = 'pg_catalog', 'public';
alter function queue_calendar_sms(uuid) set search_path = 'pg_catalog', 'public';
alter function set_document_template_portfolio_id() set search_path = 'pg_catalog', 'public';
alter function slugify_association_name(text) set search_path = 'pg_catalog', 'public';
alter function touch_updated_at() set search_path = 'pg_catalog', 'public';
alter function update_bank_account_reconciliation_date() set search_path = 'pg_catalog', 'public';
alter function update_meetings_updated_at() set search_path = 'pg_catalog', 'public';
alter function update_owner_payables_updated_at() set search_path = 'pg_catalog', 'public';
alter function update_plaid_items_updated_at() set search_path = 'pg_catalog', 'public';
alter function update_updated_at_column() set search_path = 'pg_catalog', 'public';
