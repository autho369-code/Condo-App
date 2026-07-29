-- Flows: teachable trigger→action automation engine (AppFolio Realm-X Flows
-- parity). Managers define rules like "when a dues charge is 15 days overdue →
-- email the owner AND apply the late fee"; /api/automation/run-flows executes
-- them hourly. A flow fires AT MOST ONCE per subject, ever — the unique
-- constraint on automation_flow_runs is the hard idempotence backstop.
-- NOT yet applied to the live database.

-- ── 1. Flow definitions ──────────────────────────────────────────────────────
create table if not exists public.automation_flows (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid not null references public.portfolios(id) on delete cascade,
  -- null = the flow applies to every association in the portfolio
  association_id uuid references public.associations(id) on delete cascade,
  name           text not null,
  enabled        boolean not null default true,
  trigger_type   text not null check (trigger_type in (
                   'charge_overdue','work_order_stale','violation_stale',
                   'insurance_expiring','arc_pending')),
  -- holds {"days": int} — the threshold the trigger compares against
  trigger_config jsonb not null default '{}'::jsonb,
  -- ordered array of {"type": text, "config": jsonb} executed top to bottom
  actions        jsonb not null default '[]'::jsonb,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_run_at    timestamptz,
  run_count      integer not null default 0
);

create index if not exists automation_flows_portfolio_idx
  on public.automation_flows (portfolio_id);
create index if not exists automation_flows_association_idx
  on public.automation_flows (association_id);
create index if not exists automation_flows_enabled_idx
  on public.automation_flows (enabled) where enabled;

create or replace function public.automation_flows_touch_updated_at()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'public' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_automation_flows_updated_at on public.automation_flows;
create trigger trg_automation_flows_updated_at
  before update on public.automation_flows
  for each row execute function public.automation_flows_touch_updated_at();

alter table public.automation_flows enable row level security;

-- Staff manage flows for portfolios they can access (can_access_portfolio
-- already includes platform operators, but the explicit operator policy below
-- keeps parity with the rest of the schema).
drop policy if exists automation_flows_staff_all on public.automation_flows;
create policy automation_flows_staff_all on public.automation_flows
  for all
  using (public.can_access_portfolio(portfolio_id))
  with check (public.can_access_portfolio(portfolio_id));

drop policy if exists automation_flows_operator_all on public.automation_flows;
create policy automation_flows_operator_all on public.automation_flows
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());

-- No resident/vendor access: no other policies.

-- ── 2. Run ledger (idempotence guarantee) ────────────────────────────────────
create table if not exists public.automation_flow_runs (
  id           uuid primary key default gen_random_uuid(),
  flow_id      uuid not null references public.automation_flows(id) on delete cascade,
  subject_type text not null,
  subject_id   uuid not null,
  fired_at     timestamptz not null default now(),
  status       text not null default 'success'
                 check (status in ('success','partial','failed')),
  detail       jsonb,
  -- A flow fires at most once per subject, EVER. The cron inserts this row
  -- first (placeholder status) and skips the subject on conflict.
  unique (flow_id, subject_type, subject_id)
);

create index if not exists automation_flow_runs_flow_fired_idx
  on public.automation_flow_runs (flow_id, fired_at desc);

alter table public.automation_flow_runs enable row level security;

-- Staff see/manage runs through the parent flow's portfolio.
drop policy if exists automation_flow_runs_staff_all on public.automation_flow_runs;
create policy automation_flow_runs_staff_all on public.automation_flow_runs
  for all
  using (exists (
    select 1 from public.automation_flows f
    where f.id = flow_id and public.can_access_portfolio(f.portfolio_id)
  ))
  with check (exists (
    select 1 from public.automation_flows f
    where f.id = flow_id and public.can_access_portfolio(f.portfolio_id)
  ));

drop policy if exists automation_flow_runs_operator_all on public.automation_flow_runs;
create policy automation_flow_runs_operator_all on public.automation_flow_runs
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());

-- No resident/vendor access: no other policies.
