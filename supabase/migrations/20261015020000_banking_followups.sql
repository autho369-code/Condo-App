-- Banking follow-ups (Status Next gaps, from the banking deep check).
--
-- 1. Undo a reconciliation (as in AppFolio): finance staff who can reconcile
--    the account can reopen its LATEST completed reconciliation, with a
--    reason, unless a closed month falls in the period it covers. It goes
--    back to in progress with its cleared items as they were; the account's
--    reconciled-through date steps back to the previous one. Audited, and the
--    reconciliation keeps who undid it, when and why. Replaces the earlier
--    rule that a completed reconciliation is final (Decisions).
-- 2. Year-end: a package is finalized only once all its months are closed;
--    now a month inside a finalized package can't be reopened until the
--    package is superseded. Months are company-wide, so one association's
--    finalized year keeps that month closed for the company.
-- 3. An item cleared on a completed reconciliation can't change under it:
--    a journal line's amounts, account, association or entry, or a journal
--    entry's date, company or posting (and none can be deleted) until that
--    reconciliation is undone. A bank adjustment can't change while any
--    reconciliation (in progress or completed) lists it (the item keeps its
--    amount). A reversal
--    (a new entry) is still the way to correct a posted entry. Signed-in
--    users already can't change posted entries; this also covers server
--    functions.

-- 1. ----------------------------------------------------------------------------
alter table public.bank_reconciliations
  add column if not exists undone_at timestamptz,
  add column if not exists undone_by uuid,
  add column if not exists undo_reason text;

comment on column public.bank_reconciliations.undone_at is
  'When this reconciliation was last undone (reopened); undone_by and undo_reason say who and why.';

-- The reconciliation guard: only undo_bank_reconciliation reopens a completed
-- reconciliation (it sets a transaction-local flag naming the row, which no
-- client request can set), and the undo columns are the function's only.
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.app_guard_bank_reconciliation()'::regprocedure), E'\r\n', E'\n');
  v_ins_old text := E'    new.portfolio_id := v_bank.portfolio_id;\n';
  v_ins_new text := E'    new.portfolio_id := v_bank.portfolio_id;\n'
                 || E'    new.undone_at := null; new.undone_by := null; new.undo_reason := null;\n';
  v_undo_old text := E'  if old.status in (''completed'', ''void'') then\n';
  v_undo_new text := E'  -- Undo (undo_bank_reconciliation only): back to in progress, as it was.\n'
                  || E'  if old.status = ''completed'' and new.status = ''in_progress''\n'
                  || E'     and current_setting(''app.bank_reconciliation_undo'', true) = old.id::text then\n'
                  || E'    if new.bank_account_id is distinct from old.bank_account_id or new.statement_date is distinct from old.statement_date then\n'
                  || E'      raise exception ''The account and statement date of a reconciliation cannot change'' using errcode = ''23514'';\n'
                  || E'    end if;\n'
                  || E'    new.portfolio_id := old.portfolio_id;\n'
                  || E'    new.ending_book_balance := public.app_bank_book_balance(new.bank_account_id, new.statement_date);\n'
                  || E'    new.difference := new.ending_book_balance - coalesce(new.statement_balance, 0);\n'
                  || E'    new.reconciled_balance := null;\n'
                  || E'    new.completed_at := null;\n'
                  || E'    new.completed_by := null;\n'
                  || E'    return new;\n'
                  || E'  end if;\n'
                  || E'  if old.status in (''completed'', ''void'') then\n';
  -- Two spaces: the undo branch's own copy is indented further.
  v_upd_old text := E'\n  new.portfolio_id := old.portfolio_id;\n';
  v_upd_new text := E'\n  new.portfolio_id := old.portfolio_id;\n'
                 || E'  new.undone_at := old.undone_at; new.undone_by := old.undone_by; new.undo_reason := old.undo_reason;\n';
begin
  if position('app.bank_reconciliation_undo' in v_def) > 0 then
    raise notice 'app_guard_bank_reconciliation already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_ins_old), 1) <> 2
     or array_length(string_to_array(v_def, v_undo_old), 1) <> 2
     or array_length(string_to_array(v_def, v_upd_old), 1) <> 2 then
    raise exception 'app_guard_bank_reconciliation: expected text not found exactly once';
  end if;
  v_def := replace(v_def, v_ins_old, v_ins_new);
  v_def := replace(v_def, v_undo_old, v_undo_new);
  v_def := replace(v_def, v_upd_old, v_upd_new);
  execute v_def;
end
$do$;

create or replace function public.undo_bank_reconciliation(p_reconciliation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  r public.bank_reconciliations;
  v_bank public.bank_accounts;
  v_previous date;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 10 then
    raise exception 'Give a reason of at least 10 characters for undoing the reconciliation.' using errcode = '23514';
  end if;
  select * into r from public.bank_reconciliations where id = p_reconciliation_id;
  if not found then
    raise exception 'Reconciliation not found.' using errcode = '42501';
  end if;
  -- Access first, before anything is locked.
  select * into v_bank from public.bank_accounts where id = r.bank_account_id;
  if not found or not public.app_can_reconcile_bank(v_bank) then
    raise exception 'Reconciliation not found.' using errcode = '42501';
  end if;
  -- Then the account row: two undos, or an undo and a new reconciliation,
  -- can't interleave.
  perform 1 from public.bank_accounts where id = v_bank.id for update;
  select * into r from public.bank_reconciliations where id = p_reconciliation_id for update;
  if r.status <> 'completed' then
    raise exception 'Only a completed reconciliation can be undone.' using errcode = '55000';
  end if;
  if exists (select 1 from public.bank_reconciliations x
              where x.bank_account_id = r.bank_account_id and x.status = 'completed'
                and x.statement_date > r.statement_date) then
    raise exception 'Undo the latest reconciliation of this account first.' using errcode = '55000';
  end if;
  if exists (select 1 from public.bank_reconciliations x
              where x.bank_account_id = r.bank_account_id and x.status = 'in_progress') then
    raise exception 'A reconciliation of this account is in progress. Complete or discard it first.' using errcode = '55000';
  end if;
  -- No closed month may end after the previous reconciliation: the account's
  -- reconciled-through date steps back to it, and a closed month must stay
  -- reconciled through its end.
  -- The company's months, shared: a month close (which locks its month)
  -- waits for this undo, or this undo sees the month closed.
  perform 1 from public.accounting_periods where portfolio_id = r.portfolio_id for share;
  select max(x.statement_date) into v_previous from public.bank_reconciliations x
   where x.bank_account_id = r.bank_account_id and x.status = 'completed' and x.id <> r.id;
  if exists (select 1 from public.accounting_periods p
              where p.portfolio_id = r.portfolio_id and p.status = 'closed'
                and (make_date(p.fiscal_year, p.period_month, 1) + interval '1 month' - interval '1 day')::date
                    > coalesce(v_previous, '-infinity'::date)) then
    raise exception 'A month this reconciliation covers is closed. Reopen the month before undoing it.' using errcode = '55000';
  end if;

  perform set_config('app.bank_reconciliation_undo', r.id::text, true);
  update public.bank_reconciliations
     set status = 'in_progress', undone_at = now(), undone_by = auth.uid(), undo_reason = left(v_reason, 500)
   where id = r.id;
  perform set_config('app.bank_reconciliation_undo', '', true);

  update public.bank_accounts
     set last_reconciliation_date = v_previous, updated_at = now()
   where id = v_bank.id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (r.portfolio_id, 'bank_reconciliation', r.id, 'bank_reconciliation_undone', auth.uid(),
          jsonb_build_object('bank_account_id', r.bank_account_id, 'statement_date', r.statement_date,
                             'statement_balance', r.statement_balance, 'completed_at', r.completed_at,
                             'reconciled_through_now', v_previous, 'reason', left(v_reason, 500)));
end $function$;

revoke all on function public.undo_bank_reconciliation(uuid, text) from public, anon;
grant execute on function public.undo_bank_reconciliation(uuid, text) to authenticated, service_role;

-- 2. ----------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.set_accounting_period_status(uuid,text,text)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'\n  update public.accounting_periods\n  set status = p_status::public.period_status,\n';
  v_new text := E'\n  -- A month in a finalized year-end package stays closed until the package\n'
             || E'  -- is superseded (months are company-wide).\n'
             || E'  if period_row.status = ''closed'' and p_status <> ''closed'' and exists (\n'
             || E'       select 1 from public.year_end_packages y\n'
             || E'        where y.portfolio_id = period_row.portfolio_id and y.status = ''finalized''\n'
             || E'          and start_date <= y.period_end and end_date >= y.period_start) then\n'
             || E'    raise exception ''This month is part of a finalized year-end package. Supersede the package before reopening the month.'' using errcode = ''55000'';\n'
             || E'  end if;\n'
             || E'\n  update public.accounting_periods\n  set status = p_status::public.period_status,\n';
begin
  if position('part of a finalized year-end package' in v_def) > 0 then
    raise notice 'set_accounting_period_status already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'set_accounting_period_status: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- Finalizing a package locks the company's months (shared) before checking
-- they are closed: a reopen (which locks its month) can't slip in between.
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.finalize_year_end_package(uuid)'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  v_readiness := public.year_end_readiness(pkg.association_id, pkg.fiscal_year);\n';
  v_new text := E'  perform 1 from public.accounting_periods where portfolio_id = pkg.portfolio_id for share;\n'
             || E'  v_readiness := public.year_end_readiness(pkg.association_id, pkg.fiscal_year);\n';
begin
  if position('from public.accounting_periods where portfolio_id = pkg.portfolio_id for share' in v_def) > 0 then
    raise notice 'finalize_year_end_package already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'finalize_year_end_package: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 3. ----------------------------------------------------------------------------
-- Lookups from a ledger line or adjustment to its reconciliation items (the
-- guards below, foreign-key checks, the item guard's "already cleared").
create index if not exists bank_reconciliation_items_journal_line_idx
  on public.bank_reconciliation_items(journal_line_id) where journal_line_id is not null;
create index if not exists bank_reconciliation_items_bank_adjustment_idx
  on public.bank_reconciliation_items(bank_adjustment_id) where bank_adjustment_id is not null;

-- The completed reconciliation (statement date) that cleared a ledger line or
-- a bank adjustment, if any.
create or replace function public.app_cleared_reconciliation_date(p_journal_line_id uuid, p_bank_adjustment_id uuid)
returns date
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select max(r.statement_date)
    from public.bank_reconciliation_items i
    join public.bank_reconciliations r on r.id = i.reconciliation_id
   where i.is_cleared and r.status = 'completed'
     and ((p_journal_line_id is not null and i.journal_line_id = p_journal_line_id)
       or (p_bank_adjustment_id is not null and i.bank_adjustment_id = p_bank_adjustment_id))
$function$;

revoke all on function public.app_cleared_reconciliation_date(uuid, uuid) from public, anon, authenticated;

create or replace function public.app_guard_reconciled_bank_adjustment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_through date;
begin
  if public.app_is_repair_session() then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.amount is not distinct from old.amount
     and new.adjustment_date is not distinct from old.adjustment_date
     and new.bank_account_id is not distinct from old.bank_account_id then
    return new;
  end if;
  -- An item keeps the adjustment's amount, so the adjustment can't change
  -- while any reconciliation (in progress or completed) lists it.
  select max(r.statement_date) into v_through
    from public.bank_reconciliation_items i
    join public.bank_reconciliations r on r.id = i.reconciliation_id
   where i.bank_adjustment_id = old.id and r.status in ('in_progress', 'completed');
  if v_through is not null then
    raise exception 'This adjustment is on the bank reconciliation for %. Discard that reconciliation if it is in progress, or undo it (and any later ones) if it is completed, before changing the adjustment.', to_char(v_through, 'FMMonth FMDD, YYYY')
      using errcode = '55000';
  end if;
  return coalesce(new, old);
end $function$;

create or replace function public.app_guard_reconciled_journal_line()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_through date;
begin
  if public.app_is_repair_session() then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.debit_amount is not distinct from old.debit_amount
     and new.credit_amount is not distinct from old.credit_amount
     and new.gl_account_id is not distinct from old.gl_account_id
     and new.association_id is not distinct from old.association_id
     and new.entry_id is not distinct from old.entry_id then
    return new;
  end if;
  v_through := public.app_cleared_reconciliation_date(old.id, null);
  if v_through is not null then
    raise exception 'This transaction was cleared on the bank reconciliation for %. Undo that reconciliation (and any later ones), or reverse the entry.', to_char(v_through, 'FMMonth FMDD, YYYY')
      using errcode = '55000';
  end if;
  return coalesce(new, old);
end $function$;

create or replace function public.app_guard_reconciled_journal_entry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_through date;
begin
  if public.app_is_repair_session() then return coalesce(new, old); end if;
  -- A draft's lines can't be cleared (posting flips posted, often).
  if not old.posted then return coalesce(new, old); end if;
  -- Linking a reversal, a description or memo is fine; the date, company and
  -- posting of a cleared entry are not.
  if tg_op = 'UPDATE' and new.posted is not distinct from old.posted
     and new.entry_date is not distinct from old.entry_date
     and new.portfolio_id is not distinct from old.portfolio_id then
    return new;
  end if;
  select max(public.app_cleared_reconciliation_date(l.id, null)) into v_through
    from public.journal_lines l where l.entry_id = old.id;
  if v_through is not null then
    raise exception 'This entry was cleared on the bank reconciliation for %. Undo that reconciliation (and any later ones), or reverse the entry.', to_char(v_through, 'FMMonth FMDD, YYYY')
      using errcode = '55000';
  end if;
  return coalesce(new, old);
end $function$;

revoke all on function public.app_guard_reconciled_bank_adjustment() from public, anon, authenticated;
revoke all on function public.app_guard_reconciled_journal_line() from public, anon, authenticated;
revoke all on function public.app_guard_reconciled_journal_entry() from public, anon, authenticated;

drop trigger if exists trg_guard_reconciled_bank_adjustment on public.bank_adjustments;
create trigger trg_guard_reconciled_bank_adjustment
  before update or delete on public.bank_adjustments
  for each row execute function public.app_guard_reconciled_bank_adjustment();

drop trigger if exists trg_guard_reconciled_journal_line on public.journal_lines;
create trigger trg_guard_reconciled_journal_line
  before update or delete on public.journal_lines
  for each row execute function public.app_guard_reconciled_journal_line();

drop trigger if exists trg_guard_reconciled_journal_entry on public.journal_entries;
create trigger trg_guard_reconciled_journal_entry
  before update or delete on public.journal_entries
  for each row execute function public.app_guard_reconciled_journal_entry();
