-- Per-company email sender domains (white label): a company's mail can go out
-- from its own domain (notices@stellarpropertygroup.com) instead of
-- hello@portier369.com once that domain is verified with the email provider
-- (Resend). One row per company. Platform admins set it up; the company's
-- staff can see the status. Delivery (/api/email/process-queue, service role)
-- uses the domain only while status = 'verified' and enabled.
-- Additive only: nothing is dropped or deleted.

create table if not exists public.portfolio_email_domains (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  domain text not null
    check (char_length(domain) <= 253
       and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$'),
  -- The part before @ for company mail (notices -> notices@domain).
  from_local_part text not null default 'notices'
    check (from_local_part ~ '^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$'),
  provider_domain_id text,
  status text not null default 'not_started'
    check (status in ('not_started', 'pending', 'verified', 'failed', 'partially_verified', 'partially_failed', 'temporary_failure')),
  records jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A sending domain belongs to one company.
create unique index if not exists portfolio_email_domains_domain_key on public.portfolio_email_domains (domain);

alter table public.portfolio_email_domains enable row level security;

create policy portfolio_email_domains_platform_admin_all on public.portfolio_email_domains
  for all to authenticated
  using (public.is_platform_operator() and public.is_platform_admin())
  with check (public.is_platform_operator() and public.is_platform_admin());

create policy portfolio_email_domains_platform_read on public.portfolio_email_domains
  for select to authenticated using (public.is_platform_operator());

create policy portfolio_email_domains_company_read on public.portfolio_email_domains
  for select to authenticated
  using ((public.is_any_staff() or public.is_company_admin()) and portfolio_id = public.current_portfolio_id());

revoke all on public.portfolio_email_domains from anon, authenticated;
grant select, insert, update on public.portfolio_email_domains to authenticated;

create trigger trg_portfolio_email_domains_updated
  before update on public.portfolio_email_domains
  for each row execute function public.touch_updated_at();
