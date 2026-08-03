-- Component-level capital and reserve planning.
-- Extends reserve_fund_settings with auditable studies, component lifecycles,
-- and reusable funding scenarios while preserving portfolio/association scope.

create table if not exists public.reserve_studies (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'draft'
    check (status in ('draft', 'board_review', 'approved', 'superseded')),
  study_date date not null default current_date,
  base_year integer not null default extract(year from current_date)::integer
    check (base_year between 2000 and 2200),
  horizon_years integer not null default 30 check (horizon_years between 1 and 50),
  opening_balance numeric(16,2) not null default 0 check (opening_balance >= 0),
  annual_contribution numeric(16,2) not null default 0 check (annual_contribution >= 0),
  annual_contribution_growth_rate numeric(7,4) not null default 0
    check (annual_contribution_growth_rate between -25 and 100),
  annual_inflation_rate numeric(7,4) not null default 3
    check (annual_inflation_rate between 0 and 25),
  annual_interest_rate numeric(7,4) not null default 1
    check (annual_interest_rate between 0 and 25),
  funding_goal text not null default 'threshold'
    check (funding_goal in ('baseline', 'threshold', 'full_funding')),
  prepared_by text,
  notes text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reserve_components (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.reserve_studies(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  fixed_asset_id uuid references public.fixed_assets(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'building_envelope',
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  unit text not null default 'each' check (char_length(unit) between 1 and 40),
  current_age_years numeric(7,2) not null default 0 check (current_age_years >= 0),
  useful_life_years numeric(7,2) not null check (useful_life_years > 0),
  remaining_life_years numeric(7,2) not null check (remaining_life_years >= 0),
  current_replacement_cost numeric(16,2) not null check (current_replacement_cost >= 0),
  inflation_rate numeric(7,4) check (inflation_rate between 0 and 25),
  condition_score smallint check (condition_score between 1 and 5),
  priority text not null default 'standard'
    check (priority in ('critical', 'high', 'standard', 'deferred')),
  last_inspected_at date,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reserve_funding_scenarios (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.reserve_studies(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  opening_balance numeric(16,2) not null default 0 check (opening_balance >= 0),
  annual_contribution numeric(16,2) not null default 0 check (annual_contribution >= 0),
  annual_contribution_growth_rate numeric(7,4) not null default 0
    check (annual_contribution_growth_rate between -25 and 100),
  annual_interest_rate numeric(7,4) not null default 1
    check (annual_interest_rate between 0 and 25),
  special_assessments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(special_assessments) = 'array'),
  is_baseline boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reserve_studies_portfolio
  on public.reserve_studies(portfolio_id, updated_at desc);
create index if not exists idx_reserve_studies_association
  on public.reserve_studies(association_id, status);
create index if not exists idx_reserve_components_study
  on public.reserve_components(study_id, remaining_life_years);
create index if not exists idx_reserve_components_portfolio
  on public.reserve_components(portfolio_id, association_id);
create index if not exists idx_reserve_scenarios_study
  on public.reserve_funding_scenarios(study_id, created_at);
create unique index if not exists idx_reserve_scenarios_one_baseline
  on public.reserve_funding_scenarios(study_id) where is_baseline;

create or replace function public.enforce_reserve_study_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  association_portfolio uuid;
begin
  select portfolio_id into association_portfolio
  from public.associations
  where id = new.association_id;

  if association_portfolio is null or association_portfolio <> new.portfolio_id then
    raise exception 'Reserve study association must belong to the same portfolio';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_reserve_component_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  parent_portfolio uuid;
  parent_association uuid;
  asset_portfolio uuid;
  asset_association uuid;
begin
  select portfolio_id, association_id
    into parent_portfolio, parent_association
  from public.reserve_studies
  where id = new.study_id;

  if parent_portfolio is null
     or parent_portfolio <> new.portfolio_id
     or parent_association <> new.association_id then
    raise exception 'Reserve planning record must match its study scope';
  end if;

  if new.fixed_asset_id is not null then
    select portfolio_id, association_id
      into asset_portfolio, asset_association
    from public.fixed_assets
    where id = new.fixed_asset_id;

    if asset_portfolio is null
       or asset_portfolio <> new.portfolio_id
       or asset_association <> new.association_id then
      raise exception 'Linked fixed asset must match the reserve component scope';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_reserve_scenario_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  parent_portfolio uuid;
  parent_association uuid;
begin
  select portfolio_id, association_id
    into parent_portfolio, parent_association
  from public.reserve_studies
  where id = new.study_id;

  if parent_portfolio is null
     or parent_portfolio <> new.portfolio_id
     or parent_association <> new.association_id then
    raise exception 'Reserve funding scenario must match its study scope';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reserve_studies_scope on public.reserve_studies;
create trigger trg_reserve_studies_scope
before insert or update of portfolio_id, association_id
on public.reserve_studies
for each row execute function public.enforce_reserve_study_scope();

drop trigger if exists trg_reserve_components_scope on public.reserve_components;
create trigger trg_reserve_components_scope
before insert or update of study_id, portfolio_id, association_id, fixed_asset_id
on public.reserve_components
for each row execute function public.enforce_reserve_component_scope();

drop trigger if exists trg_reserve_scenarios_scope on public.reserve_funding_scenarios;
create trigger trg_reserve_scenarios_scope
before insert or update of study_id, portfolio_id, association_id
on public.reserve_funding_scenarios
for each row execute function public.enforce_reserve_scenario_scope();

drop trigger if exists trg_reserve_studies_updated on public.reserve_studies;
create trigger trg_reserve_studies_updated
before update on public.reserve_studies
for each row execute function public.touch_updated_at();

drop trigger if exists trg_reserve_components_updated on public.reserve_components;
create trigger trg_reserve_components_updated
before update on public.reserve_components
for each row execute function public.touch_updated_at();

drop trigger if exists trg_reserve_scenarios_updated on public.reserve_funding_scenarios;
create trigger trg_reserve_scenarios_updated
before update on public.reserve_funding_scenarios
for each row execute function public.touch_updated_at();

alter table public.reserve_studies enable row level security;
alter table public.reserve_components enable row level security;
alter table public.reserve_funding_scenarios enable row level security;

drop policy if exists reserve_studies_read on public.reserve_studies;
create policy reserve_studies_read on public.reserve_studies
for select to authenticated
using (
  public.is_platform_operator()
  or public.can_access_portfolio(portfolio_id)
  or (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and status in ('board_review', 'approved')
  )
);

drop policy if exists reserve_studies_staff_write on public.reserve_studies;
create policy reserve_studies_staff_write on public.reserve_studies
for all to authenticated
using (
  (public.is_any_staff() or public.is_company_admin())
  and public.can_access_portfolio(portfolio_id)
)
with check (
  (public.is_any_staff() or public.is_company_admin())
  and public.can_access_portfolio(portfolio_id)
);

drop policy if exists reserve_components_read on public.reserve_components;
create policy reserve_components_read on public.reserve_components
for select to authenticated
using (
  public.is_platform_operator()
  or public.can_access_portfolio(portfolio_id)
  or (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and exists (
      select 1 from public.reserve_studies study
      where study.id = reserve_components.study_id
        and study.status in ('board_review', 'approved')
    )
  )
);

drop policy if exists reserve_components_staff_write on public.reserve_components;
create policy reserve_components_staff_write on public.reserve_components
for all to authenticated
using (
  (public.is_any_staff() or public.is_company_admin())
  and public.can_access_portfolio(portfolio_id)
)
with check (
  (public.is_any_staff() or public.is_company_admin())
  and public.can_access_portfolio(portfolio_id)
);

drop policy if exists reserve_scenarios_read on public.reserve_funding_scenarios;
create policy reserve_scenarios_read on public.reserve_funding_scenarios
for select to authenticated
using (
  public.is_platform_operator()
  or public.can_access_portfolio(portfolio_id)
  or (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and exists (
      select 1 from public.reserve_studies study
      where study.id = reserve_funding_scenarios.study_id
        and study.status in ('board_review', 'approved')
    )
  )
);

drop policy if exists reserve_scenarios_staff_write on public.reserve_funding_scenarios;
create policy reserve_scenarios_staff_write on public.reserve_funding_scenarios
for all to authenticated
using (
  (public.is_any_staff() or public.is_company_admin())
  and public.can_access_portfolio(portfolio_id)
)
with check (
  (public.is_any_staff() or public.is_company_admin())
  and public.can_access_portfolio(portfolio_id)
);

grant select, insert, update, delete on public.reserve_studies to authenticated;
grant select, insert, update, delete on public.reserve_components to authenticated;
grant select, insert, update, delete on public.reserve_funding_scenarios to authenticated;

revoke all on function public.enforce_reserve_study_scope() from public, anon, authenticated;
revoke all on function public.enforce_reserve_component_scope() from public, anon, authenticated;
revoke all on function public.enforce_reserve_scenario_scope() from public, anon, authenticated;

comment on table public.reserve_studies is
  'Association reserve studies with auditable assumptions and approval state.';
comment on table public.reserve_components is
  'Component lifecycle and replacement-cost assumptions for a reserve study.';
comment on table public.reserve_funding_scenarios is
  'Alternative contribution, growth, interest, and special-assessment scenarios.';
