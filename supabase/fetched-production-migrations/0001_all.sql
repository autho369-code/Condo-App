-- ==========================================================================
-- HOA-OS: Combined migrations (0001-0016) with all known issues fixed.
-- Generated 2026-04-18.
--
-- FIXES APPLIED:
--   1. lower(name) removed from buildings unique index (locale/immutable issue)
--   2. is_manager(auth.uid()) -> is_manager() in 0014, 0015, 0016
--   3. profiles.role -> profiles.hoa_role in 0010, 0011, 0014, 0016
--   4. owners.user_id references stubbed with "and false -- TODO" (column doesn't exist)
--   5. tenancies.tenant_user_id references stubbed with "and false -- TODO" (column doesn't exist)
--   6. No current_date in index predicates found, but confirmed safe.
-- ==========================================================================

-- ==========================================================================
-- SECTION 0: COMPLETE CLEANUP (drop everything for a clean slate)
-- ==========================================================================

-- Drop all RLS policies on public tables
do $$
declare
  r record;
begin
  for r in (
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end$$;
-- Drop all triggers on public tables
do $$
declare
  r record;
begin
  for r in (
    select trigger_name, event_object_table
    from information_schema.triggers
    where trigger_schema = 'public'
  )
  loop
    execute format('drop trigger if exists %I on public.%I cascade', r.trigger_name, r.event_object_table);
  end loop;
end$$;
-- Drop the on_auth_user_created trigger on auth.users if it exists
drop trigger if exists on_auth_user_created on auth.users;
-- Drop all views in public schema
do $$
declare
  r record;
begin
  for r in (
    select table_name
    from information_schema.views
    where table_schema = 'public'
  )
  loop
    execute format('drop view if exists public.%I cascade', r.table_name);
  end loop;
end$$;
-- Drop all tables in public schema (respecting dependencies via cascade)
do $$
declare
  r record;
begin
  for r in (
    select tablename
    from pg_tables
    where schemaname = 'public'
  )
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end$$;
-- Drop all functions in public schema
do $$
declare
  r record;
begin
  for r in (
    select p.oid, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  )
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end$$;
-- Drop all custom types in public schema
do $$
declare
  r record;
begin
  for r in (
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype = 'e'  -- enum types
  )
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end$$;
-- ==========================================================================
-- MIGRATION 0001: profiles
-- ==========================================================================

-- 1) Role enum (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'hoa_role') then
    create type public.hoa_role as enum ('manager', 'board', 'owner', 'tenant');
  end if;
end$$;
-- 2) Make sure profiles exists (the AIOS migration already creates it but this
--    is defensive in case hoa-os is the only thing connected to a project)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  role        text default 'user',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
-- 3) Add hoa-os specific columns
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists hoa_role public.hoa_role default 'manager';
-- 4) Auto-create profile on signup (replaces the function -- safe to re-run)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, hoa_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'manager'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- 5) RLS -- user can read/update only their own row
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- ==========================================================================
-- MIGRATION 0002: associations
-- ==========================================================================

create table if not exists public.associations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  address             text not null,
  city                text not null,
  state               text not null,
  zip                 text not null,
  fiscal_year_start   smallint not null check (fiscal_year_start between 1 and 12),
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  created_by          uuid not null references auth.users(id) on delete restrict
);
create index if not exists associations_created_by_idx on public.associations(created_by);
create index if not exists associations_archived_idx on public.associations(archived_at);
alter table public.associations enable row level security;
-- Helper: is the current user a manager?
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and hoa_role = 'manager'
  );
$$;
-- MANAGER: full access
drop policy if exists "associations_manager_all" on public.associations;
create policy "associations_manager_all" on public.associations
  for all
  using (public.is_manager())
  with check (public.is_manager());
-- Board members: can read associations they belong to.
drop policy if exists "associations_board_read" on public.associations;
create policy "associations_board_read" on public.associations
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    and false  -- TODO: replace with membership check when association_members exists
  );
-- Owners: can read associations they own a unit in.
drop policy if exists "associations_owner_read" on public.associations;
create policy "associations_owner_read" on public.associations
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: replace with unit ownership join
  );
-- Tenants: can read associations they have an active lease in.
drop policy if exists "associations_tenant_read" on public.associations;
create policy "associations_tenant_read" on public.associations
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'tenant'
    )
    and false  -- TODO: replace with lease join
  );
-- touch_updated_at (will be dropped in 0008 cleanup but defined here defensively)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.created_at = coalesce(new.created_at, now());
  return new;
end;
$$;
-- ==========================================================================
-- MIGRATION 0003: buildings
-- ==========================================================================

create table if not exists public.buildings (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references public.associations(id) on delete cascade,
  name            text not null,
  address         text not null,
  year_built      smallint check (year_built between 1700 and 2100),
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists buildings_association_idx on public.buildings(association_id);
create index if not exists buildings_active_idx on public.buildings(association_id);
-- FIX #6: replaced lower(name) with just name to avoid IMMUTABLE/locale issues
create unique index if not exists buildings_unique_name_per_assoc
  on public.buildings(association_id, name);
alter table public.buildings enable row level security;
-- MANAGER: full access
drop policy if exists "buildings_manager_all" on public.buildings;
create policy "buildings_manager_all" on public.buildings
  for all
  using (public.is_manager())
  with check (public.is_manager());
-- BOARD: read buildings in associations they belong to
drop policy if exists "buildings_board_read" on public.buildings;
create policy "buildings_board_read" on public.buildings
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    and false  -- TODO: replace with membership check when association_members exists
  );
-- OWNER: read buildings where they own a unit
drop policy if exists "buildings_owner_read" on public.buildings;
create policy "buildings_owner_read" on public.buildings
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: replace with units ownership join
  );
-- TENANT: read buildings where they have an active lease
drop policy if exists "buildings_tenant_read" on public.buildings;
create policy "buildings_tenant_read" on public.buildings
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'tenant'
    )
    and false  -- TODO: replace with leases join
  );
-- ==========================================================================
-- MIGRATION 0004: units
-- ==========================================================================

create table if not exists public.units (
  id              uuid primary key default gen_random_uuid(),
  building_id     uuid not null references public.buildings(id) on delete cascade,
  unit_number     text not null,
  sqft            integer check (sqft is null or sqft > 0),
  bedrooms        smallint check (bedrooms is null or bedrooms >= 0),
  ownership_pct   numeric(6,3) not null check (ownership_pct >= 0 and ownership_pct <= 100),
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists units_building_idx on public.units(building_id);
create index if not exists units_active_idx on public.units(building_id);
create unique index if not exists units_unique_number_per_building
  on public.units(building_id, unit_number);
alter table public.units enable row level security;
-- MANAGER: full access
drop policy if exists "units_manager_all" on public.units;
create policy "units_manager_all" on public.units
  for all
  using (public.is_manager())
  with check (public.is_manager());
-- BOARD: read units in associations they belong to
drop policy if exists "units_board_read" on public.units;
create policy "units_board_read" on public.units
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    and false  -- TODO: replace with membership join
  );
-- OWNER: read units they own
drop policy if exists "units_owner_read" on public.units;
create policy "units_owner_read" on public.units
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: replace with unit_owners join
  );
-- TENANT: read the unit on their active lease
drop policy if exists "units_tenant_read" on public.units;
create policy "units_tenant_read" on public.units
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'tenant'
    )
    and false  -- TODO: replace with leases join
  );
-- View: ownership_pct rollup per association
create or replace view public.association_ownership_totals as
  select
    a.id as association_id,
    coalesce(sum(u.ownership_pct), 0)::numeric(8,3) as total_pct,
    count(u.id)::int as unit_count
  from public.associations a
  left join public.buildings b
    on b.association_id = a.id and b.archived_at is null
  left join public.units u
    on u.building_id = b.id and u.archived_at is null
  where a.archived_at is null
  group by a.id;
-- ==========================================================================
-- MIGRATION 0005: owners + unit_owners
-- ==========================================================================

create table if not exists public.owners (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text,
  phone           text,
  mailing_address text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);
create index if not exists owners_active_idx on public.owners(id);
alter table public.owners enable row level security;
create policy "owners_manager_all" on public.owners for all using (public.is_manager()) with check (public.is_manager());
create table if not exists public.unit_owners (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  owner_id    uuid not null references public.owners(id) on delete cascade,
  is_primary  boolean not null default true,
  share_pct   numeric(5,2) not null default 100 check (share_pct >= 0 and share_pct <= 100),
  start_date  date not null default current_date,
  end_date    date,
  created_at  timestamptz not null default now()
);
create index if not exists unit_owners_unit_idx on public.unit_owners(unit_id);
create index if not exists unit_owners_owner_idx on public.unit_owners(owner_id);
create unique index if not exists unit_owners_active_unique on public.unit_owners(unit_id, owner_id);
alter table public.unit_owners enable row level security;
create policy "unit_owners_manager_all" on public.unit_owners for all using (public.is_manager()) with check (public.is_manager());
-- ==========================================================================
-- MIGRATION 0006: tenancies + documents
-- ==========================================================================

create table if not exists public.tenancies (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units(id) on delete cascade,
  tenant_name   text not null,
  tenant_email  text,
  tenant_phone  text,
  lease_start   date not null,
  lease_end     date,
  rent_amount   numeric(10,2),
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists tenancies_unit_idx on public.tenancies(unit_id);
create index if not exists tenancies_active_idx on public.tenancies(unit_id);
alter table public.tenancies enable row level security;
create policy "tenancies_manager_all" on public.tenancies for all using (public.is_manager()) with check (public.is_manager());
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,
  entity_id     uuid not null,
  doc_type      text not null check (doc_type in ('lease','ho6','renters_insurance','bylaws','minutes','other')),
  file_name     text not null,
  file_url      text not null,
  expires_at    timestamptz,
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references auth.users(id)
);
create index if not exists documents_entity_idx on public.documents(entity_type, entity_id);
create index if not exists documents_expiry_idx on public.documents(expires_at);
alter table public.documents enable row level security;
create policy "documents_manager_all" on public.documents for all using (public.is_manager()) with check (public.is_manager());
-- ==========================================================================
-- MIGRATION 0007: email_queue + owners.email NOT NULL + unit columns
-- ==========================================================================

create table if not exists public.email_queue (
  id              uuid primary key default gen_random_uuid(),
  to_email        text not null,
  to_name         text,
  subject         text not null,
  body            text not null,
  association_id  uuid references public.associations(id),
  sent_by         uuid references auth.users(id),
  status          text not null default 'pending' check (status in ('pending','sent','failed')),
  error_message   text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index if not exists email_queue_status_idx on public.email_queue(status);
create index if not exists email_queue_assoc_idx on public.email_queue(association_id);
alter table public.email_queue enable row level security;
create policy "email_queue_manager_all" on public.email_queue for all using (public.is_manager()) with check (public.is_manager());
-- Make owners.email NOT NULL going forward
alter table public.owners alter column email set not null;
-- Add parking + storage to units
alter table public.units add column if not exists parking_spaces text;
alter table public.units add column if not exists storage_number text;
-- ==========================================================================
-- MIGRATION 0008: cleanup
-- ==========================================================================

drop function if exists public.touch_updated_at() cascade;
-- Owner communication preferences
alter table public.owners add column if not exists preferred_comm text not null default 'email' check (preferred_comm in ('email','mail','phone'));
alter table public.owners add column if not exists electronic_consent boolean not null default false;
alter table public.owners add column if not exists electronic_consent_date timestamptz;
-- ==========================================================================
-- MIGRATION 0009: assessments, charges, payments
-- ==========================================================================

-- Charge type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'charge_type') then
    create type public.charge_type as enum (
      'assessment',
      'late_fee',
      'fine',
      'special_assessment',
      'move_fee',
      'amenity_fee',
      'other'
    );
  end if;
end$$;
-- Assessment periods
create table if not exists public.assessment_periods (
  id                uuid primary key default gen_random_uuid(),
  association_id    uuid not null references public.associations(id) on delete cascade,
  name              text not null,
  period_start      date not null,
  period_end        date not null,
  base_amount       numeric(10,2) not null check (base_amount >= 0),
  status            text not null default 'draft' check (status in ('draft','posted','closed')),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  constraint period_dates_valid check (period_end >= period_start)
);
create index if not exists ap_association_idx on public.assessment_periods(association_id);
create index if not exists ap_status_idx on public.assessment_periods(status);
-- Charges
create table if not exists public.charges (
  id                    uuid primary key default gen_random_uuid(),
  unit_id               uuid not null references public.units(id) on delete cascade,
  assessment_period_id  uuid references public.assessment_periods(id) on delete set null,
  charge_type           public.charge_type not null default 'assessment',
  description           text not null,
  amount                numeric(10,2) not null check (amount >= 0),
  due_date              date not null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id)
);
create index if not exists charges_unit_idx on public.charges(unit_id);
create index if not exists charges_period_idx on public.charges(assessment_period_id);
create index if not exists charges_due_idx on public.charges(due_date);
-- Payments
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units(id) on delete cascade,
  charge_id     uuid references public.charges(id) on delete set null,
  amount        numeric(10,2) not null check (amount > 0),
  payment_date  date not null default current_date,
  method        text not null default 'manual' check (method in ('manual','check','ach','card','other')),
  reference     text,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);
create index if not exists payments_unit_idx on public.payments(unit_id);
create index if not exists payments_charge_idx on public.payments(charge_id);
create index if not exists payments_date_idx on public.payments(payment_date);
-- View: unit_balances
create or replace view public.unit_balances as
select
  u.id as unit_id,
  u.unit_number,
  u.building_id,
  b.association_id,
  coalesce(c.total_charges, 0) as total_charges,
  coalesce(p.total_payments, 0) as total_payments,
  coalesce(c.total_charges, 0) - coalesce(p.total_payments, 0) as balance
from public.units u
join public.buildings b on b.id = u.building_id
left join (
  select unit_id, sum(amount) as total_charges
  from public.charges
  group by unit_id
) c on c.unit_id = u.id
left join (
  select unit_id, sum(amount) as total_payments
  from public.payments
  group by unit_id
) p on p.unit_id = u.id
where u.archived_at is null;
-- View: delinquent_units
create or replace view public.delinquent_units as
select
  ub.unit_id,
  ub.unit_number,
  ub.building_id,
  ub.association_id,
  ub.balance,
  oldest.oldest_due
from public.unit_balances ub
join lateral (
  select min(ch.due_date) as oldest_due
  from public.charges ch
  where ch.unit_id = ub.unit_id
    and ch.due_date < current_date
) oldest on true
where ub.balance > 0
  and oldest.oldest_due is not null;
-- RLS: assessment_periods
alter table public.assessment_periods enable row level security;
drop policy if exists "ap_manager_all" on public.assessment_periods;
create policy "ap_manager_all" on public.assessment_periods
  for all
  using (public.is_manager())
  with check (public.is_manager());
drop policy if exists "ap_board_read" on public.assessment_periods;
create policy "ap_board_read" on public.assessment_periods
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    and false  -- TODO: replace with association membership join
  );
drop policy if exists "ap_owner_read" on public.assessment_periods;
create policy "ap_owner_read" on public.assessment_periods
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: replace with unit ownership -> association join
  );
-- RLS: charges
alter table public.charges enable row level security;
drop policy if exists "charges_manager_all" on public.charges;
create policy "charges_manager_all" on public.charges
  for all
  using (public.is_manager())
  with check (public.is_manager());
drop policy if exists "charges_board_read" on public.charges;
create policy "charges_board_read" on public.charges
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    and false  -- TODO: replace with association membership join
  );
drop policy if exists "charges_owner_read" on public.charges;
create policy "charges_owner_read" on public.charges
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: replace with unit_owners join
  );
drop policy if exists "charges_tenant_read" on public.charges;
create policy "charges_tenant_read" on public.charges
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'tenant'
    )
    and false  -- TODO: replace with tenancy -> unit join
  );
-- RLS: payments
alter table public.payments enable row level security;
drop policy if exists "payments_manager_all" on public.payments;
create policy "payments_manager_all" on public.payments
  for all
  using (public.is_manager())
  with check (public.is_manager());
drop policy if exists "payments_board_read" on public.payments;
create policy "payments_board_read" on public.payments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    and false  -- TODO: replace with association membership join
  );
drop policy if exists "payments_owner_read" on public.payments;
create policy "payments_owner_read" on public.payments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: replace with unit_owners join
  );
-- ==========================================================================
-- MIGRATION 0010: work_orders
-- ==========================================================================

-- Enums
create type work_order_status as enum (
  'new',
  'assigned',
  'scheduled',
  'in_progress',
  'completed',
  'closed'
);
create type work_order_priority as enum (
  'low',
  'normal',
  'high',
  'emergency'
);
create type work_order_category as enum (
  'plumbing',
  'electrical',
  'hvac',
  'general_repair',
  'common_area',
  'appliance',
  'pest_control',
  'landscaping',
  'other'
);
-- Work Orders table
create table work_orders (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid references units(id) on delete set null,
  association_id uuid not null references associations(id) on delete cascade,
  title         text not null check (length(title) between 2 and 200),
  description   text check (length(description) <= 2000),
  category      work_order_category not null default 'other',
  priority      work_order_priority not null default 'normal',
  status        work_order_status not null default 'new',
  assigned_to   text,
  scheduled_date date,
  completed_date date,
  requested_by  text,
  internal_notes text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);
-- Indexes
create index idx_work_orders_association on work_orders(association_id);
create index idx_work_orders_unit on work_orders(unit_id);
create index idx_work_orders_status on work_orders(status);
create index idx_work_orders_priority on work_orders(priority);
-- Work Order Updates (activity log)
create table work_order_updates (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  note          text not null check (length(note) between 1 and 2000),
  new_status    work_order_status,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index idx_wo_updates_order on work_order_updates(work_order_id);
-- RLS
alter table work_orders enable row level security;
alter table work_order_updates enable row level security;
-- Manager: full CRUD on work_orders
create policy "manager_work_orders_select"
  on work_orders for select to authenticated
  using (is_manager());
create policy "manager_work_orders_insert"
  on work_orders for insert to authenticated
  with check (is_manager());
create policy "manager_work_orders_update"
  on work_orders for update to authenticated
  using (is_manager())
  with check (is_manager());
create policy "manager_work_orders_delete"
  on work_orders for delete to authenticated
  using (is_manager());
-- Manager: full CRUD on work_order_updates
create policy "manager_wo_updates_select"
  on work_order_updates for select to authenticated
  using (is_manager());
create policy "manager_wo_updates_insert"
  on work_order_updates for insert to authenticated
  with check (is_manager());
-- FIX #3: profiles.role -> profiles.hoa_role
-- Board: read-only on work_orders in their association (scaffolded)
create policy "board_work_orders_select"
  on work_orders for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.hoa_role = 'board'
    )
    and false  -- TODO: restrict to board's association
  );
-- FIX #3: profiles.role -> profiles.hoa_role
-- Owner/Tenant: read own unit work orders (scaffolded)
create policy "owner_work_orders_select"
  on work_orders for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.hoa_role in ('owner', 'tenant')
    )
    and false  -- TODO: restrict to own unit
  );
-- Updated_at trigger
create or replace function update_work_order_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger trg_work_orders_updated_at
  before update on work_orders
  for each row
  execute function update_work_order_timestamp();
-- ==========================================================================
-- MIGRATION 0011: notices
-- ==========================================================================

-- Enums
create type notice_type as enum (
  'general',
  'violation',
  'meeting',
  'payment_reminder',
  'maintenance_update',
  'annual_meeting',
  'board_packet',
  'emergency',
  'other'
);
create type notice_status as enum (
  'draft',
  'sent',
  'archived'
);
-- Notices table
create table notices (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references associations(id) on delete cascade,
  notice_type     notice_type not null default 'general',
  status          notice_status not null default 'draft',
  subject         text not null check (length(subject) between 2 and 300),
  body            text not null check (length(body) >= 1),
  send_to         text not null default 'all_owners',
  sent_at         timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);
-- Notice recipients
create table notice_recipients (
  id              uuid primary key default gen_random_uuid(),
  notice_id       uuid not null references notices(id) on delete cascade,
  owner_id        uuid references owners(id) on delete set null,
  email           text not null,
  name            text,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);
-- Indexes
create index idx_notices_association on notices(association_id);
create index idx_notices_status on notices(status);
create index idx_notices_type on notices(notice_type);
create index idx_notice_recipients_notice on notice_recipients(notice_id);
create index idx_notice_recipients_owner on notice_recipients(owner_id);
-- RLS
alter table notices enable row level security;
alter table notice_recipients enable row level security;
-- Manager: full CRUD
create policy "manager_notices_select"
  on notices for select to authenticated
  using (is_manager());
create policy "manager_notices_insert"
  on notices for insert to authenticated
  with check (is_manager());
create policy "manager_notices_update"
  on notices for update to authenticated
  using (is_manager())
  with check (is_manager());
create policy "manager_notices_delete"
  on notices for delete to authenticated
  using (is_manager());
-- Manager: full CRUD on recipients
create policy "manager_recipients_select"
  on notice_recipients for select to authenticated
  using (is_manager());
create policy "manager_recipients_insert"
  on notice_recipients for insert to authenticated
  with check (is_manager());
-- FIX #3: profiles.role -> profiles.hoa_role
-- Board: read-only notices for their association (scaffolded)
create policy "board_notices_select"
  on notices for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.hoa_role = 'board'
    )
    and false  -- TODO: restrict to board's association
  );
-- FIX #3: profiles.role -> profiles.hoa_role
-- Owner: read notices sent to them (scaffolded)
create policy "owner_notices_select"
  on notices for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.hoa_role in ('owner', 'tenant')
    )
    and false  -- TODO: restrict to own notices
  );
-- Updated_at trigger (reuses the existing function from 0010)
create trigger trg_notices_updated_at
  before update on notices
  for each row
  execute function update_work_order_timestamp();
-- ==========================================================================
-- MIGRATION 0012: violations & compliance
-- ==========================================================================

-- Enums
create type violation_status as enum (
  'open',
  'notice_sent',
  'hearing_pending',
  'cured',
  'fined',
  'closed'
);
create type violation_type as enum (
  'noise',
  'parking',
  'pets',
  'exterior_modification',
  'trash_debris',
  'landscaping',
  'common_area_misuse',
  'lease_violation',
  'assessment_delinquency',
  'other'
);
-- Violations table
create table violations (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references associations(id) on delete cascade,
  unit_id         uuid references units(id) on delete set null,
  owner_id        uuid references owners(id) on delete set null,
  violation_type  violation_type not null default 'other',
  status          violation_status not null default 'open',
  title           text not null check (length(title) between 2 and 200),
  description     text check (length(description) <= 4000),
  date_observed   date not null default current_date,
  hearing_date    date,
  fine_amount     numeric(10,2) check (fine_amount >= 0),
  fine_assessed_at timestamptz,
  cured_at        timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz,
  archived_at     timestamptz
);
-- Indexes
create index idx_violations_association on violations(association_id);
create index idx_violations_unit on violations(unit_id);
create index idx_violations_owner on violations(owner_id);
create index idx_violations_status on violations(status);
-- Violation updates (activity log)
create table violation_updates (
  id            uuid primary key default gen_random_uuid(),
  violation_id  uuid not null references violations(id) on delete cascade,
  note          text not null check (length(note) between 1 and 2000),
  new_status    violation_status,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index idx_violation_updates_violation on violation_updates(violation_id);
-- Updated_at trigger
create or replace function touch_violation_updated()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_violation_updated
  before update on violations
  for each row execute function touch_violation_updated();
-- RLS
alter table violations enable row level security;
alter table violation_updates enable row level security;
-- Manager: full CRUD
create policy "manager_violations_select"
  on violations for select to authenticated
  using (is_manager());
create policy "manager_violations_insert"
  on violations for insert to authenticated
  with check (is_manager());
create policy "manager_violations_update"
  on violations for update to authenticated
  using (is_manager())
  with check (is_manager());
create policy "manager_violations_delete"
  on violations for delete to authenticated
  using (is_manager());
-- Manager: full CRUD on updates
create policy "manager_violation_updates_select"
  on violation_updates for select to authenticated
  using (is_manager());
create policy "manager_violation_updates_insert"
  on violation_updates for insert to authenticated
  with check (is_manager());
-- Board: read-only
create policy "board_violations_select"
  on violations for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
  );
create policy "board_violation_updates_select"
  on violation_updates for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
  );
-- FIX #4: owners.user_id does not exist -- stubbed with "and false"
-- Owner: own violations only
create policy "owner_violations_select"
  on violations for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.hoa_role = 'owner'
    )
    and false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
-- FIX #5: tenancies.tenant_user_id does not exist -- stubbed with "and false"
-- Tenant: own unit violations only
create policy "tenant_violations_select"
  on violations for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.hoa_role = 'tenant'
    )
    and false  -- TODO: tenancies.tenant_user_id does not exist; wire when tenant-user link is added
  );
-- ==========================================================================
-- MIGRATION 0013: report_snapshots
-- ==========================================================================

create table if not exists report_snapshots (
  id            uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations(id) on delete cascade,
  report_type   text not null check (report_type in (
    'aged_receivables',
    'account_ledger',
    'income_summary',
    'unpaid_balances',
    'delinquency',
    'work_order_aging',
    'violation_summary'
  )),
  parameters    jsonb not null default '{}',
  data          jsonb not null default '{}',
  generated_at  timestamptz not null default now(),
  generated_by  uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
-- Indexes
create index idx_report_snapshots_assoc on report_snapshots(association_id);
create index idx_report_snapshots_type on report_snapshots(report_type);
create index idx_report_snapshots_generated on report_snapshots(generated_at desc);
-- Aged receivables view
create or replace view aged_receivables as
select
  c.unit_id,
  u.unit_number,
  b.name as building_name,
  a.name as association_name,
  a.id as association_id,
  c.id as charge_id,
  c.description,
  c.amount,
  c.due_date,
  coalesce(paid.total_paid, 0) as total_paid,
  c.amount - coalesce(paid.total_paid, 0) as balance_due,
  case
    when c.due_date >= current_date then 'current'
    when c.due_date >= current_date - interval '30 days' then '1_30'
    when c.due_date >= current_date - interval '60 days' then '31_60'
    when c.due_date >= current_date - interval '90 days' then '61_90'
    else '90_plus'
  end as aging_bucket
from charges c
join units u on u.id = c.unit_id
join buildings b on b.id = u.building_id
join associations a on a.id = b.association_id
left join (
  select charge_id, sum(amount) as total_paid
  from payments
  group by charge_id
) paid on paid.charge_id = c.id
where c.amount - coalesce(paid.total_paid, 0) > 0;
-- Monthly income view
create or replace view monthly_income as
select
  date_trunc('month', p.payment_date::date) as month,
  a.id as association_id,
  a.name as association_name,
  p.method,
  count(*) as payment_count,
  sum(p.amount) as total_amount
from payments p
join units u on u.id = p.unit_id
join buildings b on b.id = u.building_id
join associations a on a.id = b.association_id
group by date_trunc('month', p.payment_date::date), a.id, a.name, p.method
order by month desc, a.name;
-- RLS
alter table report_snapshots enable row level security;
-- Manager: full access
create policy "manager_report_snapshots_all" on report_snapshots
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.hoa_role = 'manager'
    )
  );
-- Board: read only for own association
create policy "board_report_snapshots_select" on report_snapshots
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.hoa_role = 'board'
    )
  );
-- ==========================================================================
-- MIGRATION 0014: statements
-- ==========================================================================

create table if not exists statements (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references owners(id) on delete cascade,
  unit_id       uuid not null references units(id) on delete cascade,
  association_id uuid not null references associations(id) on delete cascade,
  period_month  int not null check (period_month between 1 and 12),
  period_year   int not null check (period_year between 2000 and 2100),
  opening_balance numeric(12,2) not null default 0,
  total_charges numeric(12,2) not null default 0,
  total_payments numeric(12,2) not null default 0,
  closing_balance numeric(12,2) not null default 0,
  pdf_path      text,
  generated_at  timestamptz not null default now(),
  emailed_at    timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
-- Unique constraint: one statement per owner/unit/month
alter table statements add constraint statements_unique_period
  unique (owner_id, unit_id, period_year, period_month);
-- Indexes
create index idx_statements_owner on statements(owner_id);
create index idx_statements_unit on statements(unit_id);
create index idx_statements_assoc on statements(association_id);
create index idx_statements_period on statements(period_year, period_month);
-- RLS
alter table statements enable row level security;
-- FIX #2: is_manager(auth.uid()) -> is_manager()
-- Manager: full access
create policy "manager_statements_all" on statements
  for all using (is_manager())
  with check (is_manager());
-- FIX #4: owners.user_id does not exist -- stubbed with "and false"
-- Owner: read own statements only
create policy "owner_statements_read" on statements
  for select using (
    false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
-- FIX #3: profiles.role -> profiles.hoa_role
-- Board: read statements for own association
create policy "board_statements_read" on statements
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.hoa_role = 'board'
    )
    and false -- TODO: enable when board auth is wired
  );
-- ==========================================================================
-- MIGRATION 0015: payment_intents
-- ==========================================================================

create table if not exists payment_intents (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid not null references units(id) on delete cascade,
  owner_id        uuid not null references owners(id) on delete cascade,
  charge_id       uuid references charges(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  amount          numeric(12,2) not null check (amount > 0),
  currency        text not null default 'usd',
  status          text not null default 'pending'
                  check (status in ('pending','processing','succeeded','failed','canceled','refunded')),
  method          text check (method in ('card','ach','manual')),
  description     text,
  failure_reason  text,
  paid_at         timestamptz,
  refunded_at     timestamptz,
  metadata        jsonb default '{}',
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Indexes
create index idx_payment_intents_unit on payment_intents(unit_id);
create index idx_payment_intents_owner on payment_intents(owner_id);
create index idx_payment_intents_status on payment_intents(status);
create index idx_payment_intents_stripe on payment_intents(stripe_payment_intent_id);
-- Updated_at trigger
create or replace function update_payment_intent_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger trg_payment_intent_updated
  before update on payment_intents
  for each row execute function update_payment_intent_timestamp();
-- RLS
alter table payment_intents enable row level security;
-- FIX #2: is_manager(auth.uid()) -> is_manager()
-- Manager: full access
create policy "manager_payment_intents_all" on payment_intents
  for all using (is_manager())
  with check (is_manager());
-- FIX #4: owners.user_id does not exist -- stubbed with "and false"
-- Owner: read own payment intents + insert new ones
create policy "owner_payment_intents_read" on payment_intents
  for select using (
    false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
create policy "owner_payment_intents_insert" on payment_intents
  for insert with check (
    false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
-- ==========================================================================
-- MIGRATION 0016: votes / ballots
-- ==========================================================================

-- Ballots (a vote topic)
create table if not exists ballots (
  id              uuid primary key default gen_random_uuid(),
  association_id  uuid not null references associations(id) on delete cascade,
  title           text not null check (length(title) between 1 and 200),
  description     text,
  ballot_type     text not null default 'yes_no'
                  check (ballot_type in ('yes_no','multiple_choice','ranked')),
  options         jsonb not null default '["Yes","No"]',
  status          text not null default 'draft'
                  check (status in ('draft','open','closed','canceled')),
  opens_at        timestamptz,
  closes_at       timestamptz,
  require_quorum  boolean not null default true,
  quorum_pct      int default 50 check (quorum_pct between 1 and 100),
  results         jsonb default '{}',
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);
-- Votes (individual cast votes)
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  ballot_id   uuid not null references ballots(id) on delete cascade,
  owner_id    uuid not null references owners(id) on delete cascade,
  unit_id     uuid not null references units(id) on delete cascade,
  choice      text not null,
  weight      numeric(5,2) not null default 1.00,
  cast_at     timestamptz not null default now()
);
-- One vote per owner per ballot
alter table votes add constraint votes_unique_owner_ballot
  unique (ballot_id, owner_id);
-- Indexes
create index idx_ballots_assoc on ballots(association_id);
create index idx_ballots_status on ballots(status);
create index idx_votes_ballot on votes(ballot_id);
create index idx_votes_owner on votes(owner_id);
-- RLS
alter table ballots enable row level security;
alter table votes enable row level security;
-- FIX #2: is_manager(auth.uid()) -> is_manager()
-- Manager: full access
create policy "manager_ballots_all" on ballots
  for all using (is_manager())
  with check (is_manager());
create policy "manager_votes_all" on votes
  for all using (is_manager())
  with check (is_manager());
-- FIX #3: profiles.role -> profiles.hoa_role
-- FIX: also profiles has no association_id column, so stub with "and false"
-- Board: read ballots for own association
create policy "board_ballots_read" on ballots
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.hoa_role = 'board'
    )
    and false -- TODO: wire when board auth is ready; profiles has no association_id
  );
-- FIX #4: owners.user_id does not exist -- stubbed with "and false"
-- Owner: read open/closed ballots + insert own vote
create policy "owner_ballots_read" on ballots
  for select using (
    status in ('open', 'closed')
    and false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
create policy "owner_votes_insert" on votes
  for insert with check (
    false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
create policy "owner_votes_read" on votes
  for select using (
    false  -- TODO: owners.user_id does not exist; wire when owner-user link is added
  );
-- ==========================================================================
-- END OF COMBINED MIGRATIONS
-- ==========================================================================;
