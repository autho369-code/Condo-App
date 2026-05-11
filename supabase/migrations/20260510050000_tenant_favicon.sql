-- =============================================================================
-- Tenant favicon
-- =============================================================================
-- A small/square asset that appears in the browser tab when a resident or
-- staffer is on the tenant's URL. Stored in the same `tenant-logos` bucket
-- using a `favicons/` key prefix so we don't need additional RLS work.
-- =============================================================================

alter table public.portfolios
  add column if not exists favicon_url text;

comment on column public.portfolios.favicon_url is
  'Public Supabase Storage URL for the tenant''s favicon. Served via <link rel="icon"> when the request reaches us via the tenant''s subdomain or custom domain.';
