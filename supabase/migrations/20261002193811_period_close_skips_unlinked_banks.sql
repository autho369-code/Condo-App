-- Closing a period requires every bank account to be reconciled through the
-- period end, but a bank account with no GL link can never be reconciled
-- (reconciliation needs the GL account), so one unlinked account blocked
-- every close. Unlinked accounts carry no ledger cash; only GL-linked
-- accounts must be reconciled. (Bank accounts can now be linked to a GL
-- account from their settings page.)
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.proname = 'set_accounting_period_status' and p.pronamespace = 'public'::regnamespace;
  -- The live definition was saved with CRLF line endings, a fresh database's
  -- with LF; normalise so the match works on both.
  v_def := replace(v_def, E'\r\n', E'\n');
  v_new := replace(v_def,
    E'where portfolio_id = period_row.portfolio_id\n      and archived_at is null\n      and (last_reconciliation_date is null or last_reconciliation_date < end_date);',
    E'where portfolio_id = period_row.portfolio_id\n      and archived_at is null\n      and gl_account_id is not null\n      and (last_reconciliation_date is null or last_reconciliation_date < end_date);');
  if v_new = v_def then
    raise exception 'set_accounting_period_status did not match the expected bank check';
  end if;
  execute v_new;
end $$;
