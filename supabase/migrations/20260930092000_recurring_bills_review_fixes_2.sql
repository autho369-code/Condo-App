-- Second review pass on recurring bills / journal entries:
-- 1. Check run: an accounts_payable GL with a custom number/name (e.g. 2100
--    "Trade Payables") is accepted; the "2000 / Accounts Payable" identity is
--    only required for plain liability accounts (same rule as the accrual).
-- 2. Every recurring journal line must have exactly one positive side; a
--    zero line would fail journal_lines_check on every run.
-- 3. A recurring bill whose schedule has passed its end date is switched off,
--    so it stops counting as active.

do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.record_check_run_legacy(uuid, uuid[], integer, date)'::regprocedure) into v_def;
  v_old := 'and (number::text = ''2000'' or lower(name) = ''accounts payable'')';
  v_new := 'and (account_type = ''accounts_payable''::public.gl_account_type or number::text = ''2000'' or lower(name) = ''accounts payable'')';
  if position(v_old in v_def) = 0 then raise exception 'record_check_run_legacy AP identity predicate not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;

do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.save_recurring_journal_entry(uuid, text, text, text, integer, date, jsonb, boolean)'::regprocedure) into v_def;
  v_old := 'or (coalesce((l->>''debit'')::numeric, 0) > 0 and coalesce((l->>''credit'')::numeric, 0) > 0)';
  v_new := 'or ((coalesce((l->>''debit'')::numeric, 0) > 0) = (coalesce((l->>''credit'')::numeric, 0) > 0))';
  if position(v_old in v_def) = 0 then raise exception 'save_recurring_journal_entry side predicate not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;

do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.generate_recurring_bills()'::regprocedure) into v_def;
  v_old := 'set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now()';
  v_new := 'set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now(), auto_generate = (t.end_date is null or v_date <= t.end_date)';
  if position(v_old in v_def) = 0 then raise exception 'generate_recurring_bills schedule update not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;

update public.recurring_bills set auto_generate = false, updated_at = now()
 where auto_generate and end_date is not null and next_post_date > end_date;
