create table if not exists public.saved_report_views (
  id          uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null,
  created_by  uuid,
  name        text not null,
  source_key  text not null,
  columns     jsonb not null default '[]'::jsonb,
  filters     jsonb not null default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists saved_report_views_portfolio_idx
  on public.saved_report_views (portfolio_id);

alter table public.saved_report_views enable row level security;

drop policy if exists saved_report_views_staff_all on public.saved_report_views;
create policy saved_report_views_staff_all
  on public.saved_report_views
  for all
  using (
    is_platform_operator()
    or (is_any_staff() and can_access_portfolio(portfolio_id))
  )
  with check (
    is_platform_operator()
    or (is_any_staff() and can_access_portfolio(portfolio_id))
  );;
