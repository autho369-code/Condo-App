-- =============================================================================
-- AppFolio buildout — Phase 5: Reporting Engine
--   • report_definitions (catalog of 110+ reports)
--   • saved_reports (user-saved parameterized views)
--   • scheduled_reports (recurring deliveries)
--   • report_runs (async generation history)
--   • Seed system report definitions from schematic §7.1
--   • Wire report_snapshots to definitions/runs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.report_category as enum (
  'association', 'accounting', 'property_unit', 'maintenance', 'people', 'communication', 'compliance'
);
create type public.report_format as enum ('pdf', 'xlsx', 'csv', 'json', 'html');
create type public.report_run_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.schedule_frequency as enum ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually');
create type public.report_delivery_channel as enum ('email', 'portal', 'webhook', 'download_only');

-- -----------------------------------------------------------------------------
-- 2. report_definitions
-- -----------------------------------------------------------------------------
create table public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  slug text not null unique,
  name text not null check (length(name) between 1 and 200),
  category public.report_category not null,
  description text,
  parameter_schema jsonb not null default '{}'::jsonb,
  default_filters jsonb not null default '{}'::jsonb,
  output_formats public.report_format[] not null default array['pdf','xlsx']::public.report_format[],
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_report_defs_category on public.report_definitions(category) where active;
create index idx_report_defs_portfolio on public.report_definitions(portfolio_id) where active;
create trigger trg_report_defs_updated before update on public.report_definitions
  for each row execute function public.touch_updated_at();

alter table public.report_definitions enable row level security;
create policy report_defs_manager_all on public.report_definitions
  for all to public using (public.is_manager()) with check (public.is_manager());
create policy report_defs_authenticated_read on public.report_definitions
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 3. saved_reports
-- -----------------------------------------------------------------------------
create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  definition_id uuid not null references public.report_definitions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(name) between 1 and 200),
  parameters jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  last_run_at timestamptz,
  run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_saved_reports_portfolio on public.saved_reports(portfolio_id);
create index idx_saved_reports_definition on public.saved_reports(definition_id);
create index idx_saved_reports_user on public.saved_reports(user_id);
create index idx_saved_reports_pinned on public.saved_reports(portfolio_id) where pinned;
create trigger trg_saved_reports_updated before update on public.saved_reports
  for each row execute function public.touch_updated_at();

alter table public.saved_reports enable row level security;
create policy saved_reports_manager_all on public.saved_reports
  for all to public using (public.is_manager()) with check (public.is_manager());
create policy saved_reports_own_read on public.saved_reports
  for select to authenticated using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. scheduled_reports
-- -----------------------------------------------------------------------------
create table public.scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  saved_report_id uuid references public.saved_reports(id) on delete cascade,
  definition_id uuid not null references public.report_definitions(id) on delete cascade,
  name text not null,
  parameters jsonb not null default '{}'::jsonb,
  frequency public.schedule_frequency not null,
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 31),
  hour_utc smallint not null default 8 check (hour_utc between 0 and 23),
  next_run_at timestamptz,
  last_run_at timestamptz,
  output_format public.report_format not null default 'pdf',
  delivery_channel public.report_delivery_channel not null default 'email',
  delivery_targets jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_scheduled_reports_portfolio on public.scheduled_reports(portfolio_id) where active and archived_at is null;
create index idx_scheduled_reports_next_run on public.scheduled_reports(next_run_at) where active and archived_at is null;
create index idx_scheduled_reports_definition on public.scheduled_reports(definition_id);
create trigger trg_scheduled_reports_updated before update on public.scheduled_reports
  for each row execute function public.touch_updated_at();

alter table public.scheduled_reports enable row level security;
create policy scheduled_reports_manager_all on public.scheduled_reports
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 5. report_runs (async generation history)
-- -----------------------------------------------------------------------------
create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  definition_id uuid not null references public.report_definitions(id) on delete restrict,
  saved_report_id uuid references public.saved_reports(id) on delete set null,
  scheduled_report_id uuid references public.scheduled_reports(id) on delete set null,
  status public.report_run_status not null default 'queued',
  parameters jsonb not null default '{}'::jsonb,
  output_format public.report_format not null default 'pdf',
  output_url text,
  output_size_bytes bigint,
  row_count integer,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer generated always as (
    case when started_at is not null and finished_at is not null
      then (extract(epoch from (finished_at - started_at)) * 1000)::integer
      else null
    end
  ) stored,
  error_message text,
  triggered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_report_runs_portfolio_created on public.report_runs(portfolio_id, created_at desc);
create index idx_report_runs_definition on public.report_runs(definition_id);
create index idx_report_runs_saved on public.report_runs(saved_report_id);
create index idx_report_runs_scheduled on public.report_runs(scheduled_report_id);
create index idx_report_runs_status on public.report_runs(status) where status in ('queued','running');
create trigger trg_report_runs_updated before update on public.report_runs
  for each row execute function public.touch_updated_at();

alter table public.report_runs enable row level security;
create policy report_runs_manager_all on public.report_runs
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 6. Wire existing report_snapshots to the new engine
-- -----------------------------------------------------------------------------
alter table public.report_snapshots
  add column definition_id uuid references public.report_definitions(id) on delete set null,
  add column run_id uuid references public.report_runs(id) on delete set null;
create index idx_report_snapshots_definition on public.report_snapshots(definition_id);
create index idx_report_snapshots_run on public.report_snapshots(run_id);

-- -----------------------------------------------------------------------------
-- 7. Keep saved_reports.run_count + last_run_at in sync automatically
-- -----------------------------------------------------------------------------
create or replace function public.bump_saved_report_on_run()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'succeeded' and new.saved_report_id is not null then
    update public.saved_reports
       set last_run_at = coalesce(new.finished_at, now()),
           run_count = run_count + 1,
           updated_at = now()
     where id = new.saved_report_id;
  end if;
  return new;
end;
$$;
create trigger trg_report_runs_bump_saved
  after insert or update of status on public.report_runs
  for each row when (new.status = 'succeeded')
  execute function public.bump_saved_report_on_run();

-- -----------------------------------------------------------------------------
-- 8. Seed system report definitions (schematic §7.1)
-- -----------------------------------------------------------------------------
insert into public.report_definitions (portfolio_id, slug, name, category, description, is_system, output_formats) values
-- Association/HOA
(null, 'balance_sheet', 'Balance Sheet', 'association', 'Association assets, liabilities, and equity at a point in time.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'income_statement', 'Income Statement', 'association', 'Revenue and expenses over a fiscal period.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'cash_flow', 'Cash Flow Statement', 'association', 'Cash in/out by operating, investing, financing activities.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'homeowner_ledger', 'Homeowner Ledger', 'association', 'Charges and payments per homeowner.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'budget_vs_actual', 'Budget vs Actual', 'association', 'Compare budget lines to actual GL activity.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'delinquency', 'Delinquency Report', 'association', 'Units with outstanding balances past due.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'reserve_fund_analysis', 'Reserve Fund Analysis', 'association', 'Reserve fund balances and planned expenditures.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'assessment_roll', 'Assessment Roll', 'association', 'Per-unit assessments for the period.', true, array['pdf','xlsx']::public.report_format[]),
-- Accounting
(null, 'general_ledger', 'General Ledger', 'accounting', 'All journal entries grouped by GL account.', true, array['pdf','xlsx','csv']::public.report_format[]),
(null, 'trial_balance', 'Trial Balance', 'accounting', 'Debits and credits per GL account at a point in time.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'bank_reconciliation', 'Bank Reconciliation', 'accounting', 'Reconcile bank account to statement.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'ar_aging', 'A/R Aging', 'accounting', 'Receivables by aging bucket (current, 1-30, 31-60, 61-90, 90+).', true, array['pdf','xlsx']::public.report_format[]),
(null, 'ap_aging', 'A/P Aging', 'accounting', 'Payables by aging bucket.', true, array['pdf','xlsx']::public.report_format[]),
-- Property/Unit
(null, 'property_directory', 'Property Directory', 'property_unit', 'All associations and units with key metadata.', true, array['pdf','xlsx','csv']::public.report_format[]),
(null, 'unit_availability', 'Unit Availability', 'property_unit', 'Vacant vs occupied units.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'unit_turn_report', 'Unit Turn Report', 'property_unit', 'Unit turnover timeline and costs.', true, array['pdf','xlsx']::public.report_format[]),
-- Maintenance
(null, 'work_order_report', 'Work Order Report', 'maintenance', 'Summary of work orders by status, vendor, category.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'maintenance_history', 'Maintenance History', 'maintenance', 'Historical work orders per unit/association.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'vendor_performance', 'Vendor Performance', 'maintenance', 'Vendor KPIs: avg completion time, cost, rating.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'open_work_orders', 'Open Work Orders', 'maintenance', 'All currently open/assigned work orders.', true, array['pdf','xlsx']::public.report_format[]),
-- People
(null, 'homeowner_directory', 'Homeowner Directory', 'people', 'All homeowners with contact info.', true, array['pdf','xlsx','csv']::public.report_format[]),
(null, 'owner_directory', 'Owner Directory', 'people', 'All property owners.', true, array['pdf','xlsx','csv']::public.report_format[]),
(null, 'vendor_directory', 'Vendor Directory', 'people', 'All vendors with trade, contact, compliance.', true, array['pdf','xlsx','csv']::public.report_format[]),
-- Communication
(null, 'letter_history', 'Letter History', 'communication', 'Sent notices and letters per entity.', true, array['pdf','xlsx']::public.report_format[]),
(null, 'survey_results', 'Survey Results', 'communication', 'Aggregated survey ratings and comments.', true, array['pdf','xlsx']::public.report_format[]),
-- Compliance
(null, 'violation_log', 'Violation Log', 'compliance', 'All violations with status, unit, homeowner, dates.', true, array['pdf','xlsx']::public.report_format[]);

-- -----------------------------------------------------------------------------
-- 9. Comments
-- -----------------------------------------------------------------------------
comment on table public.report_definitions is '26 system report templates seeded by default (schematic §7.1). Per-portfolio custom reports set portfolio_id.';
comment on column public.report_definitions.parameter_schema is 'JSON Schema describing required/optional parameters for this report.';
comment on table public.report_runs is 'Async generation log. duration_ms is computed from started_at/finished_at.';
comment on table public.scheduled_reports is 'Recurring generation. A cron job picks rows where next_run_at <= now() AND active AND archived_at IS NULL.';
;
