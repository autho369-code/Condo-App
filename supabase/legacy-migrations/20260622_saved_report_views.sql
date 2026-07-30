-- User-defined Report Builder — saved views.
--
-- NOTE: the spec asked for a table named `saved_reports`, but that name is
-- already taken by the existing catalog-report system (saved_reports has a
-- definition_id FK to report_definitions and is in active use by
-- app/(app)/reports/page.tsx). To avoid clobbering it, the report-builder
-- saved views live in `saved_report_views`. Shape matches the spec otherwise.

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

-- Staff of the portfolio can do everything; platform operator full access.
-- Mirrors the owners_staff_all pattern.
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
  );
