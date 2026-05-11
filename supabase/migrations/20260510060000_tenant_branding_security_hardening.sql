-- =============================================================================
-- Security hardening for tenant branding migrations (20260510020000-50000)
-- =============================================================================
-- Triages the advisor findings raised after the brand identity drop:
--   1. tenant-logos public SELECT policy → drop (URL access still works)
--   2. trigger function exposed via RPC   → revoke EXECUTE
--   3. resolver function over-granted     → narrow to anon (middleware only)
-- =============================================================================

drop policy if exists "tenant-logos read public" on storage.objects;

revoke execute on function public._marketing_leads_touch_updated_at() from public, anon, authenticated;

revoke execute on function public.resolve_portfolio_for_host(text) from public, authenticated;
grant   execute on function public.resolve_portfolio_for_host(text) to anon;

comment on function public.resolve_portfolio_for_host(text) is
  'Resolves an HTTP host header to a portfolio. Called from Next.js middleware via the anon role to set tenant branding context BEFORE authentication. Granted to anon by design — see _REDESIGN_README.md.';
