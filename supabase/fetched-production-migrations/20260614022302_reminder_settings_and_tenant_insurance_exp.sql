-- Per-company reminder configuration: which alerts are on and how many days
-- in advance to surface them on the dashboard.
create table public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  alert_type text not null,
  enabled boolean not null default true,
  lead_days integer not null default 30,
  updated_at timestamptz not null default now(),
  unique (portfolio_id, alert_type)
);

alter table public.reminder_settings enable row level security;
create policy reminder_settings_staff_all on public.reminder_settings
  for all to authenticated
  using (can_access_portfolio(portfolio_id) or is_platform_operator())
  with check (can_access_portfolio(portfolio_id) or is_platform_operator());

-- Renters insurance expiry, so it can drive an alert like owner insurance does.
alter table public.tenants
  add column if not exists insurance_expiration date,
  add column if not exists insurance_policy_number text;;
