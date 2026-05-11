-- =============================================================================
-- Tenant brand identity — manager-facing self-service
-- =============================================================================
-- Extends portfolios with brand contact fields, creates the tenant-logos
-- storage bucket, and locks down RLS so each manager can only upload into
-- their own portfolio's folder. Reuses the project's existing
-- current_portfolio_id() helper.
-- =============================================================================

alter table public.portfolios
  add column if not exists website            text,
  add column if not exists brand_email        text,
  add column if not exists billing_email_from text;

comment on column public.portfolios.website            is 'Public-facing website. Shown on the portal and owner statements.';
comment on column public.portfolios.brand_email        is 'Public-facing inbox (e.g. info@beacon.co). Shown on the owner portal & invoices.';
comment on column public.portfolios.billing_email_from is 'From: address on outbound statements (defaults to billing@portier369.com if blank).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-logos',
  'tenant-logos',
  true,
  2 * 1024 * 1024,
  array['image/png','image/jpeg','image/svg+xml','image/webp']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tenant-logos read public" on storage.objects;
create policy "tenant-logos read public"
  on storage.objects
  for select
  to anon, authenticated
  using ( bucket_id = 'tenant-logos' );

drop policy if exists "tenant-logos insert own portfolio" on storage.objects;
create policy "tenant-logos insert own portfolio"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-logos'
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__')
  );

drop policy if exists "tenant-logos update own portfolio" on storage.objects;
create policy "tenant-logos update own portfolio"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tenant-logos'
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__')
  );

drop policy if exists "tenant-logos delete own portfolio" on storage.objects;
create policy "tenant-logos delete own portfolio"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tenant-logos'
    and (storage.foldername(name))[1] = coalesce(public.current_portfolio_id()::text, '__none__')
  );
