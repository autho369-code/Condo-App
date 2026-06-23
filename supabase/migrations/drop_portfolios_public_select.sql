-- portfolios had a public SELECT USING(true) exposing EVERY column (incl.
-- ai_api_key) to anon. Branding now goes through tenant_branding() (safe cols),
-- so drop the public policy. Remaining policies: staff read own portfolio,
-- full-access staff manage own, platform operator all. Applied to remote 2026-06-22.
drop policy if exists "Public can read tenant branding" on public.portfolios;
