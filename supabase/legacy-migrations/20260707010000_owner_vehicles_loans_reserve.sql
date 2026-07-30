-- AppFolio-parity audit v2: person-level vehicles (2.9), association
-- loans/mortgages (2.5a), reserve fund tracking (2.5b).
-- Applied to prod 2026-07-07 via MCP (owner_vehicles_loans_reserve).

create table public.owner_vehicles (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  make text, model text, color text, year int,
  license_plate text, plate_state text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index owner_vehicles_owner_idx on public.owner_vehicles(owner_id);
alter table public.owner_vehicles enable row level security;
create policy ov_staff_all on public.owner_vehicles
  for all using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id))
  with check ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));

create table public.association_loans (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  lender text not null,
  loan_type text not null default 'mortgage' check (loan_type in ('mortgage','line_of_credit','note','other')),
  original_principal numeric,
  current_balance numeric,
  interest_rate numeric,
  term_months int,
  start_date date,
  maturity_date date,
  payment_amount numeric,
  payment_frequency text not null default 'monthly' check (payment_frequency in ('monthly','quarterly','annual')),
  next_payment_date date,
  gl_account_id uuid references public.gl_accounts(id),
  status text not null default 'active' check (status in ('active','paid_off','refinanced')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index association_loans_assoc_idx on public.association_loans(association_id);
alter table public.association_loans enable row level security;
create policy al_staff_all on public.association_loans
  for all using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id))
  with check ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));

create table public.reserve_fund_settings (
  association_id uuid primary key references public.associations(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  target_amount numeric,
  monthly_contribution numeric,
  percent_funded numeric,
  last_study_date date,
  next_study_due date,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.reserve_fund_settings enable row level security;
create policy rfs_staff_all on public.reserve_fund_settings
  for all using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id))
  with check ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));
