-- platform_remittance: only the server writes it (security review, 2026-10-27).
--
-- 20261027020000 let any platform operator insert or update the row through
-- the API. A support or read-only operator (or a stolen session) could then
-- swap in another bank account for every invoice and Billing page, skipping
-- saveRemittance's requirePlatformAdmin check and its audit row. The action
-- writes with the service key, so signed-in users need no write access at all.
-- Operators can still read it.

drop policy if exists platform_remittance_operator_insert on public.platform_remittance;
drop policy if exists platform_remittance_operator_update on public.platform_remittance;
revoke insert, update, delete, truncate on public.platform_remittance from authenticated, anon, public;
