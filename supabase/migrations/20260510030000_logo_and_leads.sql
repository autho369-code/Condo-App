-- =============================================================================
-- Tenant logo upload + marketing leads (sales-led white-glove onboarding)
-- =============================================================================
-- Two unrelated additions packaged together because they ship as one drop:
--   1. portfolios.logo_url  — tenant-uploaded brand mark for auth + portal pages
--   2. marketing_leads      — captures /request-access submissions for the
--                             concierge to qualify and convert
-- =============================================================================

-- --- 1. Tenant logo --------------------------------------------------------
alter table public.portfolios
  add column if not exists logo_url text;

comment on column public.portfolios.logo_url is
  'Public Supabase Storage URL for the tenant''s brand mark. Shown on auth pages and the resident portal when reached via the tenant''s subdomain or custom domain.';

-- --- 2. Marketing leads ----------------------------------------------------
create table if not exists public.marketing_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Capture data
  contact_name    text not null,
  contact_email   text not null,
  contact_phone   text,
  company_name    text not null,
  portfolio_size  text,                  -- e.g. "1–5 associations", "100+ units"
  current_platform text,                 -- e.g. "AppFolio", "Buildium", "spreadsheets"
  message         text,

  -- Origin
  source_url      text,                  -- referring page on portier369.com
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,

  -- Workflow
  status          text not null default 'new'
                    check (status in ('new', 'contacted', 'qualified', 'converted', 'declined', 'spam')),
  assigned_to     uuid,                  -- platform operator handling this lead
  notes           text,
  converted_portfolio_id uuid references public.portfolios(id)
);

create index if not exists marketing_leads_created_at_idx on public.marketing_leads (created_at desc);
create index if not exists marketing_leads_status_idx     on public.marketing_leads (status);

-- updated_at trigger
create or replace function public._marketing_leads_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists marketing_leads_touch_updated_at on public.marketing_leads;
create trigger marketing_leads_touch_updated_at
  before update on public.marketing_leads
  for each row execute function public._marketing_leads_touch_updated_at();

-- --- 3. RLS ----------------------------------------------------------------
alter table public.marketing_leads enable row level security;

-- Anyone (anon + authed) can submit a lead via the /request-access form
drop policy if exists marketing_leads_anon_insert on public.marketing_leads;
create policy marketing_leads_anon_insert
  on public.marketing_leads
  for insert
  to anon, authenticated
  with check (true);

-- Only platform operators can read / update / delete leads
drop policy if exists marketing_leads_platform_read on public.marketing_leads;
create policy marketing_leads_platform_read
  on public.marketing_leads
  for select
  to authenticated
  using (
    exists (select 1 from public.platform_operators po where po.auth_user_id = auth.uid() and po.active = true)
  );

drop policy if exists marketing_leads_platform_write on public.marketing_leads;
create policy marketing_leads_platform_write
  on public.marketing_leads
  for update
  to authenticated
  using (
    exists (select 1 from public.platform_operators po where po.auth_user_id = auth.uid() and po.active = true)
  )
  with check (
    exists (select 1 from public.platform_operators po where po.auth_user_id = auth.uid() and po.active = true)
  );

comment on table public.marketing_leads is
  'White-glove sales pipeline. Captured from /request-access on the marketing site, qualified by the concierge in /platform/leads, then converted into a provisioned portfolio.';
