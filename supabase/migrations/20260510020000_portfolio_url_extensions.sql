-- =============================================================================
-- Portfolio URL extensions — multi-tenant routing for white-glove deployments
-- =============================================================================
-- Each management company gets its own URL extension, two ways:
--
--   1. SUBDOMAIN (default)   beacon.portier369.com         → portfolios.slug = 'beacon'
--   2. CUSTOM DOMAIN (vanity) managebeacon.com              → portfolios.custom_domain = 'managebeacon.com'
--
-- Tenant identity is established at the URL layer for branding only —
-- the data isolation is unchanged: every query still goes through RLS,
-- which scopes by the authenticated user's portfolio_id.
-- =============================================================================

-- --- columns ----------------------------------------------------------------
alter table public.portfolios
  add column if not exists slug          text,
  add column if not exists custom_domain text;

-- --- constraints ------------------------------------------------------------
-- Slug must be url-safe (lowercase letters / digits / hyphens, 2–32 chars)
alter table public.portfolios
  drop constraint if exists portfolios_slug_format;
alter table public.portfolios
  add constraint portfolios_slug_format
  check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$');

create unique index if not exists portfolios_slug_key
  on public.portfolios (slug)
  where slug is not null;

create unique index if not exists portfolios_custom_domain_key
  on public.portfolios (lower(custom_domain))
  where custom_domain is not null;

-- --- backfill ---------------------------------------------------------------
update public.portfolios
   set slug = lower(regexp_replace(
                regexp_replace(company_name, '[^A-Za-z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'))
 where slug is null
   and company_name is not null;

update public.portfolios
   set slug = 'p-' || left(id::text, 8)
 where slug is null or slug = '';

alter table public.portfolios
  alter column slug set not null;

-- --- helper RPC -------------------------------------------------------------
-- One SELECT with both match strategies; custom_domain wins via the order by.
create or replace function public.resolve_portfolio_for_host(p_host text)
returns table (id uuid, slug text, company_name text)
language sql
stable
security definer
set search_path = public
as $$
  with h as (
    select lower(split_part(p_host, ':', 1)) as host
  )
  select p.id, p.slug, p.company_name
    from public.portfolios p, h
   where p.archived_at is null
     and (
       lower(p.custom_domain) = h.host
       or (
         h.host like '%.portier369.com'
         and p.slug = split_part(h.host, '.', 1)
       )
     )
   order by case when lower(p.custom_domain) = h.host then 0 else 1 end
   limit 1;
$$;

grant execute on function public.resolve_portfolio_for_host(text) to anon, authenticated;

comment on column public.portfolios.slug          is 'URL-safe identifier used as a subdomain on portier369.com (e.g. "beacon" → beacon.portier369.com).';
comment on column public.portfolios.custom_domain is 'Optional vanity domain mapped via CNAME to Vercel (e.g. "app.managebeacon.com").';
comment on function public.resolve_portfolio_for_host(text) is
  'Resolves an HTTP host header to a portfolio. Used by the Next.js middleware to set tenant context for branding.';
