-- Tenant tracking for owner-rented condominium units, pets registry, and
-- emergency contacts. Units are never managed for the tenant directly; the
-- association needs to know who occupies each unit and hold lease records.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete set null,
  unit_id uuid not null references public.units(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  lease_start date,
  lease_end date,
  lease_document_url text,
  insurance_document_url text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  status text not null default 'active' check (status in ('active','ended')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_unit_idx on public.tenants(unit_id);
create index tenants_portfolio_idx on public.tenants(portfolio_id);
create index tenants_owner_idx on public.tenants(owner_id);

alter table public.tenants enable row level security;

create policy tenants_staff_all on public.tenants
  for all to authenticated
  using (can_access_portfolio(portfolio_id) or is_platform_operator())
  with check (can_access_portfolio(portfolio_id) or is_platform_operator());

-- Pets registered to a unit (owner's or tenant's)
create table public.unit_pets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  pet_type text not null,
  name text not null,
  breed text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index unit_pets_unit_idx on public.unit_pets(unit_id);
create index unit_pets_portfolio_idx on public.unit_pets(portfolio_id);

alter table public.unit_pets enable row level security;

create policy unit_pets_staff_all on public.unit_pets
  for all to authenticated
  using (can_access_portfolio(portfolio_id) or is_platform_operator())
  with check (can_access_portfolio(portfolio_id) or is_platform_operator());

-- Emergency contact on the owner record
alter table public.owners
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;;
