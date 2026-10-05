-- Plaid access tokens are bearer credentials for a bank login. The baseline
-- granted ALL on plaid_items to anon/authenticated, so any finance user could
-- read `plaid_access_token` (and the sync `cursor`) straight from PostgREST in
-- the browser. RLS limits which ROWS are visible, not which COLUMNS.
--
-- Column privileges cannot narrow a table-level grant, so drop the table-level
-- SELECT/INSERT/UPDATE grants and re-grant only the non-secret columns. The
-- API routes (/api/plaid/exchange-token, /api/plaid/transactions/sync) check
-- authorization with the caller's RLS-scoped client, then read/write the token
-- with the service role. DELETE (disconnect) is unchanged and still RLS-scoped.
-- Additive and idempotent: re-running only re-applies the same grants.

revoke select, insert, update on table public.plaid_items from anon, authenticated;

grant select (
  id,
  portfolio_id,
  bank_account_id,
  plaid_item_id,
  plaid_institution_id,
  plaid_institution_name,
  status,
  last_sync_at,
  error_message,
  created_at,
  updated_at
) on table public.plaid_items to authenticated;

grant update (
  bank_account_id,
  status,
  error_message
) on table public.plaid_items to authenticated;

grant select, insert, update on table public.plaid_items to service_role;

comment on column public.plaid_items.plaid_access_token is
  'Plaid bearer credential. Readable/writable by service_role only; never returned to the browser.';
