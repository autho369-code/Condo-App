-- Signed-in users can no longer call 10 SECURITY DEFINER functions that
-- nothing uses.
--
-- Checked on production 2026-10-12: none of these is called by the app
-- (app/, lib/, components/, scripts/, supabase/functions), a row-level
-- security policy, a view, a CHECK constraint, a cron job or another
-- function. Each one already checks permissions itself, but an unused
-- function that bypasses row-level security is attack surface with no use:
--   bank_account_check_numbers - returns a bank account's FULL routing and
--     account numbers to finance staff, although the bank_accounts columns
--     are hidden from them (only *_last4 are granted, 20261003160000). It
--     was added for printing the MICR line; checks print on pre-printed
--     MICR stock, so nothing calls it.
--   delete_budget_line, upsert_budget_line, link_year_end_signature,
--   record_meeting_attendance - writes; the app uses other paths.
--   has_role, is_accountant, is_assistant_manager, is_manager,
--   tenant_service_request_scope_valid - checks about the caller that
--     nothing reads.
-- (can_access_association_mvp is also unused by the app but stays callable:
-- supabase/tests/meeting_governance.sql calls it as a signed-in user.)
--
-- Only EXECUTE for authenticated (and public) is revoked; the functions
-- stay, so a later need is one GRANT away. Functions called by other
-- SECURITY DEFINER functions run as their owner and are unaffected.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'bank_account_check_numbers', 'delete_budget_line', 'upsert_budget_line',
         'link_year_end_signature', 'record_meeting_attendance',
         'has_role', 'is_accountant',
         'is_assistant_manager', 'is_manager', 'tenant_service_request_scope_valid'
       )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end
$$;
