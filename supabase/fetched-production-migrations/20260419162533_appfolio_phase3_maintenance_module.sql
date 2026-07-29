-- =============================================================================
-- AppFolio buildout — Phase 3: Maintenance
--   • service_requests (parent of work_orders per schematic §3.10)
--   • Extend work_orders with AppFolio-spec fields (SR link, vendor, trade, etc.)
--   • purchase_orders + purchase_order_line_items
--   • recurring_work_orders (templates)
--   • work_order_labor_entries (tech time)
--   • work_order_estimates (vendor quotes)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.service_request_priority as enum ('low', 'normal', 'high', 'emergency');
create type public.service_request_status as enum ('open', 'completed', 'cancelled', 'waiting');
create type public.service_request_source as enum ('resident', 'internal', 'recurring');

create type public.purchase_order_status as enum ('open', 'approved', 'billed', 'cancelled');

create type public.recurring_frequency as enum ('daily', 'weekly', 'monthly', 'quarterly', 'annually');

-- Add missing values to existing work_order_status enum (AppFolio adds "done", "billed")
alter type public.work_order_status add value if not exists 'done' after 'in_progress';
alter type public.work_order_status add value if not exists 'billed' after 'completed';
alter type public.work_order_status add value if not exists 'cancelled' after 'closed';

-- -----------------------------------------------------------------------------
-- 2. service_requests  (parent of work_orders)
-- -----------------------------------------------------------------------------
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  homeowner_id uuid references public.owners(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  number text,  -- display number e.g. "2546"
  description text not null check (length(description) >= 1),
  priority public.service_request_priority not null default 'normal',
  permission_to_enter boolean not null default false,
  source public.service_request_source not null default 'resident',
  status public.service_request_status not null default 'open',
  created_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_requests_association on public.service_requests(association_id) where archived_at is null;
create index idx_service_requests_unit on public.service_requests(unit_id);
create index idx_service_requests_status on public.service_requests(status) where archived_at is null;
create index idx_service_requests_homeowner on public.service_requests(homeowner_id);
create trigger trg_service_requests_updated before update on public.service_requests
  for each row execute function public.touch_updated_at();

alter table public.service_requests enable row level security;
create policy service_requests_manager_all on public.service_requests
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 3. Extend work_orders with AppFolio-spec fields (additive)
-- -----------------------------------------------------------------------------
alter table public.work_orders
  add column service_request_id uuid references public.service_requests(id) on delete set null,
  add column portfolio_id uuid references public.portfolios(id) on delete set null,
  add column vendor_id uuid references public.vendors(id) on delete set null,
  add column number text,
  add column job_description text,
  add column owner_approved boolean not null default false,
  add column trade public.vendor_trade,
  add column issue text,
  add column vendor_instructions text,
  add column scheduled_time time,
  add column homeowner_availability text,
  add column next_followup_date date,
  add column assignee_id uuid references auth.users(id) on delete set null,
  add column withheld_amount_from_owner numeric(14,2) not null default 0 check (withheld_amount_from_owner >= 0);
create index idx_work_orders_service_request on public.work_orders(service_request_id);
create index idx_work_orders_vendor on public.work_orders(vendor_id) where archived_at is null;
create index idx_work_orders_assignee on public.work_orders(assignee_id);
create index idx_work_orders_portfolio on public.work_orders(portfolio_id);

-- -----------------------------------------------------------------------------
-- 4. purchase_orders + purchase_order_line_items
-- -----------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete set null,
  number text,
  status public.purchase_order_status not null default 'open',
  po_total numeric(14,2) not null default 0 check (po_total >= 0),
  po_billed numeric(14,2) not null default 0 check (po_billed >= 0),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_purchase_orders_association on public.purchase_orders(association_id) where archived_at is null;
create index idx_purchase_orders_vendor on public.purchase_orders(vendor_id);
create index idx_purchase_orders_work_order on public.purchase_orders(work_order_id);
create index idx_purchase_orders_status on public.purchase_orders(status) where archived_at is null;
create trigger trg_purchase_orders_updated before update on public.purchase_orders
  for each row execute function public.touch_updated_at();

alter table public.purchase_orders enable row level security;
create policy purchase_orders_manager_all on public.purchase_orders
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.purchase_order_line_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  description text,
  qty numeric(12,3) not null default 1 check (qty > 0),
  unit_price numeric(14,4) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round((qty * unit_price)::numeric, 2)) stored,
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_po_line_items_po on public.purchase_order_line_items(purchase_order_id);
create index idx_po_line_items_gl on public.purchase_order_line_items(gl_account_id);
create trigger trg_po_line_items_updated before update on public.purchase_order_line_items
  for each row execute function public.touch_updated_at();

alter table public.purchase_order_line_items enable row level security;
create policy po_line_items_manager_all on public.purchase_order_line_items
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 5. recurring_work_orders (templates that auto-generate WOs)
-- -----------------------------------------------------------------------------
create table public.recurring_work_orders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  description text,
  trade public.vendor_trade,
  category public.work_order_category,
  priority public.work_order_priority not null default 'normal',
  frequency public.recurring_frequency not null default 'monthly',
  interval_count integer not null default 1 check (interval_count >= 1),
  start_date date not null default current_date,
  end_date date,
  next_due_date date not null default current_date,
  last_generated_at timestamptz,
  auto_generate boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_recurring_wo_association on public.recurring_work_orders(association_id) where archived_at is null;
create index idx_recurring_wo_vendor on public.recurring_work_orders(vendor_id);
create index idx_recurring_wo_next_due on public.recurring_work_orders(next_due_date) where auto_generate and archived_at is null;
create trigger trg_recurring_wo_updated before update on public.recurring_work_orders
  for each row execute function public.touch_updated_at();

alter table public.recurring_work_orders enable row level security;
create policy recurring_wo_manager_all on public.recurring_work_orders
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 6. work_order_labor_entries (tech time tracking)
-- -----------------------------------------------------------------------------
create table public.work_order_labor_entries (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  tech_id uuid references auth.users(id) on delete set null,
  tech_name text,
  date_worked date not null default current_date,
  hours numeric(6,2) not null check (hours > 0 and hours <= 24),
  description text,
  hourly_rate numeric(12,2),
  labor_cost numeric(14,2) generated always as (
    round((hours * coalesce(hourly_rate, 0))::numeric, 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_labor_entries_wo on public.work_order_labor_entries(work_order_id);
create index idx_labor_entries_tech on public.work_order_labor_entries(tech_id);
create index idx_labor_entries_date on public.work_order_labor_entries(date_worked desc);
create trigger trg_labor_entries_updated before update on public.work_order_labor_entries
  for each row execute function public.touch_updated_at();

alter table public.work_order_labor_entries enable row level security;
create policy labor_entries_manager_all on public.work_order_labor_entries
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 7. work_order_estimates (vendor quotes against a WO)
-- -----------------------------------------------------------------------------
create table public.work_order_estimates (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  notes text,
  submitted_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_estimates_wo on public.work_order_estimates(work_order_id);
create index idx_estimates_vendor on public.work_order_estimates(vendor_id);
create trigger trg_estimates_updated before update on public.work_order_estimates
  for each row execute function public.touch_updated_at();

alter table public.work_order_estimates enable row level security;
create policy estimates_manager_all on public.work_order_estimates
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 8. Wire payable_bills.work_order_id was already in place; no change needed.
--    purchase_orders references work_orders already. All good.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 9. Comments
-- -----------------------------------------------------------------------------
comment on table public.service_requests is 'Maintenance ticket created by resident/staff — parent of work_orders. AppFolio §3.10.';
comment on column public.service_requests.source is 'resident = homeowner portal, internal = staff-initiated, recurring = auto-generated from recurring_work_orders.';
comment on table public.purchase_orders is 'Vendor purchase orders, optionally tied to a work order. Status: open → approved → billed → cancelled.';
comment on table public.recurring_work_orders is 'Templates that generate work_orders on a schedule. A cron job (future phase) advances next_due_date and creates SR+WO rows.';
comment on column public.work_orders.service_request_id is 'Parent service_request. New WOs should set this; legacy rows may be null.';
;
