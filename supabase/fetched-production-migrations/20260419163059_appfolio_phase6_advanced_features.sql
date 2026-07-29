-- =============================================================================
-- AppFolio buildout — Phase 6: Advanced Features (final schema phase)
--   • fixed_assets + depreciation_entries (schematic §3.18)
--   • inspections + inspection_items (§3.16)
--   • calendar_events with iCal RRULE (§3.20)
--   • surveys + survey_responses (§3.22)
--   • tags + tag_assignments (polymorphic)
--   • approval_requests (HOA architectural/pet/etc. approvals §3.24)
--   • Extend violations with due_date + attachments (§3.19 parity)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.depreciation_method as enum (
  'straight_line', 'declining_balance', 'sum_of_years_digits', 'units_of_production', 'none'
);
create type public.asset_status as enum ('active', 'disposed', 'sold', 'fully_depreciated');

create type public.inspection_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.inspection_severity as enum ('info', 'minor', 'moderate', 'major', 'critical');

create type public.event_type as enum (
  'administrative', 'announcements', 'maintenance', 'meetings', 'social_events', 'other'
);

create type public.survey_type as enum ('maintenance', 'leasing', 'general');

create type public.tag_entity_type as enum (
  'association', 'unit', 'owner', 'vendor', 'work_order', 'service_request',
  'bill', 'payment', 'charge', 'violation', 'document', 'inspection', 'calendar_event'
);

create type public.approval_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- -----------------------------------------------------------------------------
-- 2. fixed_assets + depreciation_entries
-- -----------------------------------------------------------------------------
create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  name text not null check (length(name) between 1 and 200),
  description text,
  asset_type text,
  purchase_date date,
  purchase_price numeric(14,2) check (purchase_price is null or purchase_price >= 0),
  salvage_value numeric(14,2) not null default 0 check (salvage_value >= 0),
  useful_life_years integer check (useful_life_years is null or useful_life_years > 0),
  depreciation_method public.depreciation_method not null default 'straight_line',
  accumulated_depreciation numeric(14,2) not null default 0 check (accumulated_depreciation >= 0),
  status public.asset_status not null default 'active',
  disposed_at timestamptz,
  disposed_amount numeric(14,2),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_fixed_assets_portfolio on public.fixed_assets(portfolio_id) where archived_at is null;
create index idx_fixed_assets_association on public.fixed_assets(association_id) where archived_at is null;
create index idx_fixed_assets_gl on public.fixed_assets(gl_account_id);
create index idx_fixed_assets_status on public.fixed_assets(status) where archived_at is null;
create trigger trg_fixed_assets_updated before update on public.fixed_assets
  for each row execute function public.touch_updated_at();

alter table public.fixed_assets enable row level security;
create policy fixed_assets_manager_all on public.fixed_assets
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.depreciation_entries (
  id uuid primary key default gen_random_uuid(),
  fixed_asset_id uuid not null references public.fixed_assets(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  amount numeric(14,2) not null check (amount >= 0),
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (fixed_asset_id, period_year, period_month)
);
create index idx_depr_entries_asset on public.depreciation_entries(fixed_asset_id);
create index idx_depr_entries_journal on public.depreciation_entries(journal_entry_id);
create index idx_depr_entries_period on public.depreciation_entries(period_year, period_month);

alter table public.depreciation_entries enable row level security;
create policy depr_entries_manager_all on public.depreciation_entries
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 3. inspections + inspection_items
-- -----------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  inspection_type text,
  scheduled_date date,
  completed_date date,
  inspector_user_id uuid references auth.users(id) on delete set null,
  inspector_vendor_id uuid references public.vendors(id) on delete set null,
  status public.inspection_status not null default 'scheduled',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_inspections_association on public.inspections(association_id) where archived_at is null;
create index idx_inspections_unit on public.inspections(unit_id);
create index idx_inspections_status on public.inspections(status) where archived_at is null;
create index idx_inspections_scheduled on public.inspections(scheduled_date) where status = 'scheduled' and archived_at is null;
create trigger trg_inspections_updated before update on public.inspections
  for each row execute function public.touch_updated_at();

alter table public.inspections enable row level security;
create policy inspections_manager_all on public.inspections
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  area text,
  issue text not null,
  severity public.inspection_severity not null default 'minor',
  photo_urls jsonb not null default '[]'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolution_notes text,
  work_order_id uuid references public.work_orders(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_inspection_items_inspection on public.inspection_items(inspection_id);
create index idx_inspection_items_wo on public.inspection_items(work_order_id);
create index idx_inspection_items_severity on public.inspection_items(severity) where not resolved;
create trigger trg_inspection_items_updated before update on public.inspection_items
  for each row execute function public.touch_updated_at();

alter table public.inspection_items enable row level security;
create policy inspection_items_manager_all on public.inspection_items
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 4. calendar_events
-- -----------------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  event_type public.event_type not null default 'other',
  start_datetime timestamptz not null,
  end_datetime timestamptz,
  all_day boolean not null default false,
  recurrence_rule text,
  location text,
  description text,
  attendees jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (end_datetime is null or end_datetime >= start_datetime)
);
create index idx_calendar_events_portfolio on public.calendar_events(portfolio_id) where archived_at is null;
create index idx_calendar_events_association on public.calendar_events(association_id) where archived_at is null;
create index idx_calendar_events_start on public.calendar_events(start_datetime) where archived_at is null;
create index idx_calendar_events_type on public.calendar_events(event_type) where archived_at is null;
create trigger trg_calendar_events_updated before update on public.calendar_events
  for each row execute function public.touch_updated_at();

alter table public.calendar_events enable row level security;
create policy calendar_events_manager_all on public.calendar_events
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 5. surveys + survey_responses
-- -----------------------------------------------------------------------------
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  survey_type public.survey_type not null default 'general',
  name text not null check (length(name) between 1 and 200),
  description text,
  questions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_surveys_portfolio on public.surveys(portfolio_id) where active and archived_at is null;
create index idx_surveys_type on public.surveys(survey_type);
create trigger trg_surveys_updated before update on public.surveys
  for each row execute function public.touch_updated_at();

alter table public.surveys enable row level security;
create policy surveys_manager_all on public.surveys
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  submitted_by_owner_id uuid references public.owners(id) on delete set null,
  submitted_by_name text,
  submitted_by_email text,
  rating smallint check (rating between 1 and 5),
  answers jsonb not null default '{}'::jsonb,
  comments text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_survey_responses_survey on public.survey_responses(survey_id);
create index idx_survey_responses_wo on public.survey_responses(work_order_id);
create index idx_survey_responses_owner on public.survey_responses(submitted_by_owner_id);
create index idx_survey_responses_submitted on public.survey_responses(submitted_at desc);

alter table public.survey_responses enable row level security;
create policy survey_responses_manager_all on public.survey_responses
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 6. tags + tag_assignments (polymorphic)
-- -----------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  color text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, name)
);
create index idx_tags_portfolio on public.tags(portfolio_id);
create trigger trg_tags_updated before update on public.tags
  for each row execute function public.touch_updated_at();

alter table public.tags enable row level security;
create policy tags_manager_all on public.tags
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.tag_assignments (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags(id) on delete cascade,
  entity_type public.tag_entity_type not null,
  entity_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tag_id, entity_type, entity_id)
);
create index idx_tag_assignments_entity on public.tag_assignments(entity_type, entity_id);
create index idx_tag_assignments_tag on public.tag_assignments(tag_id);

alter table public.tag_assignments enable row level security;
create policy tag_assignments_manager_all on public.tag_assignments
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 7. approval_requests (HOA-specific, e.g., architectural review, pets, etc.)
-- -----------------------------------------------------------------------------
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  homeowner_id uuid references public.owners(id) on delete set null,
  request_type text not null,
  title text not null,
  description text,
  requested_by_name text,
  requested_by_email text,
  requested_at timestamptz not null default now(),
  decision_by uuid references auth.users(id) on delete set null,
  decision_at timestamptz,
  status public.approval_request_status not null default 'pending',
  notes text,
  attachments jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_approval_requests_association on public.approval_requests(association_id) where archived_at is null;
create index idx_approval_requests_status on public.approval_requests(status) where archived_at is null;
create index idx_approval_requests_unit on public.approval_requests(unit_id);
create index idx_approval_requests_homeowner on public.approval_requests(homeowner_id);
create trigger trg_approval_requests_updated before update on public.approval_requests
  for each row execute function public.touch_updated_at();

alter table public.approval_requests enable row level security;
create policy approval_requests_manager_all on public.approval_requests
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 8. Extend violations for AppFolio §3.19 parity
-- -----------------------------------------------------------------------------
alter table public.violations
  add column due_date date,
  add column reported_date date default current_date,
  add column attachments jsonb not null default '[]'::jsonb;
create index idx_violations_due on public.violations(due_date) where archived_at is null and status <> 'closed';

-- -----------------------------------------------------------------------------
-- 9. Comments
-- -----------------------------------------------------------------------------
comment on table public.fixed_assets is 'Depreciable assets per §3.18. accumulated_depreciation is maintained by the depreciation job (future automation).';
comment on column public.fixed_assets.depreciation_method is 'Accounting method. Straight-line is the most common; others supported for GAAP compliance.';
comment on table public.depreciation_entries is 'Period-level depreciation posting. One row per asset per month; optionally ties to the journal entry that booked it.';
comment on table public.inspections is 'Scheduled/completed inspections. inspection_items are the findings.';
comment on column public.inspection_items.work_order_id is 'Link to a WO created to remediate this finding.';
comment on column public.calendar_events.recurrence_rule is 'iCal RRULE string (RFC 5545) for recurring events.';
comment on table public.tag_assignments is 'Polymorphic: entity_type determines which table entity_id points at.';
comment on table public.approval_requests is 'HOA-side approval workflow (architectural review, pet requests, etc.) — distinct from payable_bill approvals.';
;
