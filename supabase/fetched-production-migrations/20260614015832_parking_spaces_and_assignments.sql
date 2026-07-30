-- Association-owned parking spaces, treated as first-class assets because they
-- turn over and carry deposits. Each space links to the unit currently using it.

create table public.parking_spaces (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  label text not null,                       -- space number / name
  space_type text not null default 'standard', -- standard | covered | garage | tandem | accessible | other
  monthly_fee numeric not null default 0,
  deposit_amount numeric not null default 0,
  notes text,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index parking_spaces_assoc_idx on public.parking_spaces(association_id);
create index parking_spaces_portfolio_idx on public.parking_spaces(portfolio_id);

alter table public.parking_spaces enable row level security;
create policy parking_spaces_staff_all on public.parking_spaces
  for all to authenticated
  using (can_access_portfolio(portfolio_id) or is_platform_operator())
  with check (can_access_portfolio(portfolio_id) or is_platform_operator());

-- Current + historical occupancy of a space, with deposit + vehicle + insurance.
create table public.parking_assignments (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  parking_space_id uuid not null references public.parking_spaces(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  occupant_name text,
  start_date date not null default current_date,
  end_date date,
  monthly_fee numeric,
  deposit_amount numeric,
  deposit_paid boolean not null default false,
  deposit_paid_at date,
  deposit_returned boolean not null default false,
  deposit_returned_at date,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  license_plate text,
  insurance_company text,
  insurance_policy_number text,
  status text not null default 'active' check (status in ('active','ended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index parking_assignments_space_idx on public.parking_assignments(parking_space_id);
create index parking_assignments_unit_idx on public.parking_assignments(unit_id);
create index parking_assignments_portfolio_idx on public.parking_assignments(portfolio_id);
-- At most one active assignment per space.
create unique index parking_assignments_one_active_per_space
  on public.parking_assignments(parking_space_id) where status = 'active';

alter table public.parking_assignments enable row level security;
create policy parking_assignments_staff_all on public.parking_assignments
  for all to authenticated
  using (can_access_portfolio(portfolio_id) or is_platform_operator())
  with check (can_access_portfolio(portfolio_id) or is_platform_operator());;
