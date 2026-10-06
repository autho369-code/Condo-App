-- Which company each sending domain belongs to, kept after a company switches
-- to another domain (portfolio_email_domains holds only the current one). A
-- domain registered for one company is never reused for another: its provider
-- registration may still be verified, which would let the second company send
-- as the first without proving it controls the DNS. Platform admins only.
-- Additive only: nothing is dropped or deleted.

create table if not exists public.email_sender_domain_owners (
  domain text primary key,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  provider_domain_id text not null,
  created_at timestamptz not null default now()
);

alter table public.email_sender_domain_owners enable row level security;

create policy email_sender_domain_owners_platform_admin_all on public.email_sender_domain_owners
  for all to authenticated
  using (public.is_platform_operator() and public.is_platform_admin())
  with check (public.is_platform_operator() and public.is_platform_admin());

revoke all on public.email_sender_domain_owners from anon, authenticated;
-- Update only re-points the provider registration; portfolio_id never changes.
grant select, insert, update (provider_domain_id) on public.email_sender_domain_owners to authenticated;

insert into public.email_sender_domain_owners (domain, portfolio_id, provider_domain_id)
select domain, portfolio_id, provider_domain_id
  from public.portfolio_email_domains
 where provider_domain_id is not null
on conflict (domain) do nothing;
