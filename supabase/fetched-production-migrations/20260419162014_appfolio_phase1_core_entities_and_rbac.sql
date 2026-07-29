-- =============================================================================
-- AppFolio buildout — Phase 1: Core data model + RBAC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions needed by this phase
-- -----------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.portfolio_profile_type as enum ('association_management', 'property_management');
create type public.portfolio_tier as enum ('core', 'plus', 'max');

create type public.vendor_trade as enum (
  'hvac', 'plumbing', 'electrical', 'landscaping', 'roofing',
  'general_contractor', 'handyperson', 'snow_removal', 'pest_control',
  'pool_spa', 'painting', 'keys_locks', 'fireplace_chimney', 'garage_doors',
  'gutter_cleaning', 'inspections', 'parking_driveways', 'preventative_maintenance',
  'repairs_exterior', 'repairs_interior', 'septic', 'trash_recycling',
  'utilities', 'turnover', 'other'
);
create type public.vendor_payment_type as enum ('check', 'echeck', 'ach', 'online');
create type public.vendor_type as enum ('general', 'contractor', 'sub_contractor', 'service_provider', 'other');

create type public.occupancy_type as enum ('homeowner', 'tenant');
create type public.occupancy_status as enum ('current', 'future', 'past');

create type public.board_role as enum ('president', 'vice_president', 'secretary', 'treasurer', 'director');

-- -----------------------------------------------------------------------------
-- 2. portfolios
-- -----------------------------------------------------------------------------
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(company_name) between 1 and 200),
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  phone_number text,
  texting_phone_number text,
  profile_type public.portfolio_profile_type not null default 'association_management',
  tier public.portfolio_tier not null default 'core',
  entitlements text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create trigger trg_portfolios_updated before update on public.portfolios
  for each row execute function public.touch_updated_at();

alter table public.portfolios enable row level security;
create policy portfolios_manager_all on public.portfolios
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 3. property_groups
-- -----------------------------------------------------------------------------
create table public.property_groups (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_property_groups_portfolio on public.property_groups(portfolio_id);
create trigger trg_property_groups_updated before update on public.property_groups
  for each row execute function public.touch_updated_at();

alter table public.property_groups enable row level security;
create policy property_groups_manager_all on public.property_groups
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 4. user_roles
-- -----------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  description text,
  is_system boolean not null default false,
  gl_account_permissions jsonb not null default '{}'::jsonb,
  profile_access text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (portfolio_id, name)
);
create index idx_user_roles_portfolio on public.user_roles(portfolio_id);
create trigger trg_user_roles_updated before update on public.user_roles
  for each row execute function public.touch_updated_at();

alter table public.user_roles enable row level security;
create policy user_roles_manager_all on public.user_roles
  for all to public using (public.is_manager()) with check (public.is_manager());
create policy user_roles_authenticated_read on public.user_roles
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 5. vendors + vendor_compliance
-- -----------------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  vendor_type public.vendor_type not null default 'general',
  trade public.vendor_trade not null default 'other',
  phone_numbers jsonb not null default '[]'::jsonb,
  emails jsonb not null default '[]'::jsonb,
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  portal_activated boolean not null default false,
  portal_login_last_at timestamptz,
  taxpayer_name text,
  taxpayer_id text,
  tax_account_number text,
  send_1099 boolean not null default false,
  check_consolidation text,
  check_stub_breakdown text,
  hold_payments boolean not null default false,
  email_echeck_receipt boolean not null default true,
  payment_terms text,
  default_check_memo text,
  default_gl_account_id uuid,
  work_order_adjustment numeric(5,2) not null default 0 check (work_order_adjustment between 0 and 100),
  payment_type public.vendor_payment_type,
  bank_routing_number text,
  bank_account_number text,
  savings_account boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_vendors_portfolio on public.vendors(portfolio_id) where archived_at is null;
create index idx_vendors_trade on public.vendors(trade) where archived_at is null;
create index idx_vendors_name_trgm on public.vendors using gin (name extensions.gin_trgm_ops);
create trigger trg_vendors_updated before update on public.vendors
  for each row execute function public.touch_updated_at();

alter table public.vendors enable row level security;
create policy vendors_manager_all on public.vendors
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.vendor_compliance (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  workers_comp_expiration date,
  general_liability_expiration date,
  epa_certification_expiration date,
  auto_insurance_expiration date,
  state_license_expiration date,
  contract_expiration date,
  updated_at timestamptz not null default now()
);
create trigger trg_vendor_compliance_updated before update on public.vendor_compliance
  for each row execute function public.touch_updated_at();

alter table public.vendor_compliance enable row level security;
create policy vendor_compliance_manager_all on public.vendor_compliance
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 6. occupancies
-- -----------------------------------------------------------------------------
create table public.occupancies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  occupancy_type public.occupancy_type not null default 'homeowner',
  status public.occupancy_status not null default 'current',
  move_in_date date,
  move_out_date date,
  dues_amount numeric(12,2) not null default 0 check (dues_amount >= 0),
  online_portal_activated boolean not null default false,
  online_payments_recurring_total numeric(12,2) not null default 0,
  online_payments_recurring_count integer not null default 0,
  is_primary boolean not null default true,
  share_pct numeric(5,2) not null default 100 check (share_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_occupancies_unit on public.occupancies(unit_id) where status = 'current';
create index idx_occupancies_association on public.occupancies(association_id);
create index idx_occupancies_owner on public.occupancies(owner_id);
create trigger trg_occupancies_updated before update on public.occupancies
  for each row execute function public.touch_updated_at();

alter table public.occupancies enable row level security;
create policy occupancies_manager_all on public.occupancies
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 7. board_members
-- -----------------------------------------------------------------------------
create table public.board_members (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  role public.board_role not null default 'director',
  term_start date,
  term_end date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_board_members_association on public.board_members(association_id) where active;
create trigger trg_board_members_updated before update on public.board_members
  for each row execute function public.touch_updated_at();

alter table public.board_members enable row level security;
create policy board_members_manager_all on public.board_members
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 8. committees + committee_members
-- -----------------------------------------------------------------------------
create table public.committees (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  name text not null,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_committees_association on public.committees(association_id) where archived_at is null;
create trigger trg_committees_updated before update on public.committees
  for each row execute function public.touch_updated_at();

alter table public.committees enable row level security;
create policy committees_manager_all on public.committees
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete cascade,
  role text not null default 'member',
  joined_at date not null default current_date,
  left_at date,
  created_at timestamptz not null default now()
);
create index idx_committee_members_committee on public.committee_members(committee_id);
create index idx_committee_members_owner on public.committee_members(owner_id);

alter table public.committee_members enable row level security;
create policy committee_members_manager_all on public.committee_members
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 9. Extend existing tables (additive)
-- -----------------------------------------------------------------------------
alter table public.associations
  add column portfolio_id uuid references public.portfolios(id) on delete restrict,
  add column property_group_id uuid references public.property_groups(id) on delete set null,
  add column unit_count integer,
  add column status text not null default 'active' check (status in ('active', 'inactive')),
  add column management_fee_schedule_id uuid,
  add column primary_bank_account_id uuid;
create index idx_associations_portfolio on public.associations(portfolio_id);
create index idx_associations_group on public.associations(property_group_id);

alter table public.profiles
  add column portfolio_id uuid references public.portfolios(id) on delete set null,
  add column role_id uuid references public.user_roles(id) on delete set null,
  add column profile_access text[] not null default '{}',
  add column gl_account_permissions jsonb not null default '{}'::jsonb,
  add column portal_login_last_at timestamptz;
create index idx_profiles_portfolio on public.profiles(portfolio_id);
create index idx_profiles_role on public.profiles(role_id);

alter table public.units
  add column name text,
  add column bathrooms numeric(3,1),
  add column notes text,
  add column home_warranty_company text,
  add column home_warranty_expires date,
  add column address_override text;

alter table public.owners
  add column portfolio_id uuid references public.portfolios(id) on delete set null,
  add column first_name text,
  add column last_name text,
  add column portal_activated boolean not null default false,
  add column portal_login_last_at timestamptz,
  add column phone_numbers jsonb not null default '[]'::jsonb,
  add column emails jsonb not null default '[]'::jsonb,
  add column address_street text,
  add column address_city text,
  add column address_state text,
  add column address_zip text,
  add column notes text;
create index idx_owners_portfolio on public.owners(portfolio_id);

-- -----------------------------------------------------------------------------
-- 10. Seed predefined system user roles
-- -----------------------------------------------------------------------------
insert into public.user_roles (portfolio_id, name, description, is_system, profile_access) values
  (null, 'President', 'Full system access for HOA president', true, array['association','property']),
  (null, 'Accountant', 'Accounting access: GL, bills, payments, journals', true, array['association','property']),
  (null, 'Property Manager', 'Operational management of associations and units', true, array['association','property']),
  (null, 'On-Site Manager', 'Day-to-day site operations, maintenance coordination', true, array['property']),
  (null, 'Leasing Agent', 'Leasing, occupancy, tenant communications', true, array['property']),
  (null, 'Accounts Payable', 'Bills, POs, vendor payments', true, array['association','property']);

-- -----------------------------------------------------------------------------
-- 11. Comments for phases to come
-- -----------------------------------------------------------------------------
comment on column public.vendors.default_gl_account_id is 'FK to public.gl_accounts — wired in Phase 2';
comment on column public.vendors.taxpayer_id is 'Sensitive: EIN/SSN — consider Vault encryption';
comment on column public.associations.primary_bank_account_id is 'FK to public.bank_accounts — wired in Phase 2';
comment on column public.associations.management_fee_schedule_id is 'FK to management_fee_schedules — wired in Phase 2';
comment on table public.occupancies is 'Unified unit↔person relationship; will eventually supersede unit_owners/tenancies';
comment on table public.portfolios is 'Top-level tenant (management company) — multi-tenancy root';
;
