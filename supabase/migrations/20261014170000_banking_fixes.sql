-- Banking deep check (2026-10-13), rolled back on production at 20,000 bank
-- lines.
--
-- 1. The cross-fund (trust) guard never applied to real reserve accounts:
--    no form sets bank_accounts.fund_type, so a reserve account (purpose
--    'reserve') stayed fund_type 'operating' and a reserve -> operating
--    transfer needed no board authorization; reserve reports left it out.
--    fund_type now follows purpose where they map, and existing accounts are
--    backfilled.
-- 2. A closed month could be reopened or deleted with a plain UPDATE/DELETE
--    (no reason, no audit). accounting_periods is now written only by
--    initialize_accounting_year and set_accounting_period_status.
-- 3. A manager limited to some associations could close or reopen the whole
--    company's months (periods are company-wide). Now refused.
-- 4. Reconciliation rules lived only in the API routes, and the balance
--    check trusted the client's book balance: a reconciliation dated in the
--    future, or before a completed one, re-clearing the same lines, could be
--    created and completed directly, stamping the account reconciled. The
--    database now enforces them: statement not in the future, after the last
--    completed one, one in progress per account; the book balance is computed
--    in the database; items carry the ledger line's or adjustment's own
--    amount, belong to the account and statement date, and can't be cleared
--    twice. last_reconciliation_date is set only by completing one.
-- 5. A bank transfer could be voided with a date before the transfer.
-- 6. A receipt could be pulled out of a bank deposit with a plain UPDATE,
--    leaving the deposit's total wrong; only the deposit functions change it.
-- Plus bank_reconcilable_lines: the unreconciled lines of an account through
-- a statement date, filtered in the database (the API paged through every
-- line ever posted and every cleared item).

-- 1.
create or replace function public.bank_accounts_fund_type_from_purpose()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  -- The fund follows the account's purpose where one maps to the other, so
  -- a reserve account can't be relabelled operating to skip the trust guard.
  if new.purpose::text in ('operating', 'reserve', 'special_assessment') then
    new.fund_type := new.purpose::text;
  end if;
  return new;
end
$function$;

revoke all on function public.bank_accounts_fund_type_from_purpose() from public, anon, authenticated;

create or replace trigger trg_bank_accounts_fund_type_from_purpose
  before insert or update of purpose, fund_type on public.bank_accounts
  for each row execute function public.bank_accounts_fund_type_from_purpose();

update public.bank_accounts
   set fund_type = purpose::text
 where purpose::text in ('reserve', 'special_assessment')
   and fund_type is distinct from purpose::text;

-- 2.
revoke insert, update, delete on public.accounting_periods from anon, authenticated;

-- 3.
do $$
declare
  v_def text := pg_get_functiondef('public.set_accounting_period_status(uuid, text, text)'::regprocedure);
  v_old text := $o$    raise exception 'Not authorized to manage this accounting period';
  end if;$o$;
  v_new text := $n$    raise exception 'Not authorized to manage this accounting period';
  end if;
  -- Months are company-wide: closing or reopening one affects every
  -- association, so a manager limited to some associations can't.
  if public.manager_is_scoped() is true and not public.is_platform_operator() then
    raise exception 'Months are closed for the whole company. Ask a company admin or a manager who is not limited to specific associations.' using errcode = '42501';
  end if;$n$;
begin
  if position('Months are closed for the whole company' in v_def) > 0 then
    return;  -- already applied
  end if;
  v_def := replace(v_def, E'\r\n', E'\n');
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'set_accounting_period_status: authorization check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 4.
-- Book balance of a bank account through a date: its cash GL account,
-- limited to its association when it has one (same as journal_line_totals).
create or replace function public.app_bank_book_balance(p_bank_account_id uuid, p_through date)
returns numeric
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce(sum(jl.debit_amount - jl.credit_amount), 0)
    from public.bank_accounts b
    join public.journal_lines jl
      on jl.gl_account_id = b.gl_account_id
     and (b.association_id is null or jl.association_id = b.association_id)
    join public.journal_entries je on je.id = jl.entry_id and je.posted and je.entry_date <= p_through
   where b.id = p_bank_account_id
$function$;

revoke all on function public.app_bank_book_balance(uuid, date) from public, anon, authenticated;

create or replace function public.app_guard_bank_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_bank public.bank_accounts%rowtype;
  v_last date;
  v_outstanding numeric;
  v_bank_only numeric;
  v_difference numeric;
begin
  if public.app_is_repair_session() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'completed' then
      raise exception 'A completed reconciliation cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      raise exception 'A reconciliation starts in progress; complete it after clearing its items' using errcode = '23514';
    end if;
    -- One account at a time: lock it so two starts can't both pass.
    select * into v_bank from public.bank_accounts where id = new.bank_account_id for update;
    if not found or v_bank.gl_account_id is null then
      raise exception 'Bank account not found or has no linked GL account' using errcode = '23514';
    end if;
    if new.statement_date is null
       or new.statement_date > coalesce(public.association_local_date(v_bank.association_id, now()), current_date) then
      raise exception 'The statement date is in the future' using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliations r
                where r.bank_account_id = new.bank_account_id and r.status = 'in_progress') then
      raise exception 'A reconciliation of this account is already in progress. Finish it before starting another.' using errcode = '23514';
    end if;
    select max(r.statement_date) into v_last from public.bank_reconciliations r
     where r.bank_account_id = new.bank_account_id and r.status = 'completed';
    if v_last is not null and new.statement_date <= v_last then
      raise exception 'This account is reconciled through %. Choose a later statement date.', v_last using errcode = '23514';
    end if;
    new.ending_book_balance := public.app_bank_book_balance(new.bank_account_id, new.statement_date);
    new.difference := new.ending_book_balance - coalesce(new.statement_balance, 0);
    return new;
  end if;

  if old.status = 'completed' then
    raise exception 'A completed reconciliation cannot be changed' using errcode = '55000';
  end if;
  if new.bank_account_id is distinct from old.bank_account_id or new.statement_date is distinct from old.statement_date then
    raise exception 'The account and statement date of a reconciliation cannot change' using errcode = '23514';
  end if;
  -- The book balance always comes from the ledger, never the request.
  new.ending_book_balance := public.app_bank_book_balance(new.bank_account_id, new.statement_date);
  if new.status = 'completed' then
    select coalesce(sum(i.amount) filter (where not i.is_cleared and i.type is distinct from 'bank_only'), 0),
           coalesce(sum(i.amount) filter (where i.is_cleared and i.type = 'bank_only'), 0)
      into v_outstanding, v_bank_only
      from public.bank_reconciliation_items i
     where i.reconciliation_id = new.id;
    v_difference := coalesce(new.statement_balance, 0)
                  - (new.ending_book_balance - v_outstanding + v_bank_only);
    if abs(v_difference) >= 0.01 then
      raise exception 'The reconciliation is out of balance by %', round(abs(v_difference), 2) using errcode = '23514';
    end if;
    new.difference := 0;
  else
    new.difference := new.ending_book_balance - coalesce(new.statement_balance, 0);
  end if;
  return new;
end
$function$;

revoke all on function public.app_guard_bank_reconciliation() from public, anon, authenticated;

create or replace function public.app_guard_bank_reconciliation_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_status text;
  v_recon public.bank_reconciliations%rowtype;
  v_bank public.bank_accounts%rowtype;
  v_amount numeric;
begin
  if public.app_is_repair_session() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  for v_status in
    select r.status::text from public.bank_reconciliations r
     where r.id in (case when tg_op = 'INSERT' then null else old.reconciliation_id end,
                    case when tg_op = 'DELETE' then null else new.reconciliation_id end)
     for share
  loop
    if v_status = 'completed' then
      raise exception 'Items of a completed reconciliation cannot be changed' using errcode = '55000';
    end if;
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Only clearing changes; what the item is stays fixed.
    new.reconciliation_id := old.reconciliation_id;
    new.journal_line_id := old.journal_line_id;
    new.bank_adjustment_id := old.bank_adjustment_id;
    new.amount := old.amount;
    new.type := old.type;
    return new;
  end if;

  select * into v_recon from public.bank_reconciliations where id = new.reconciliation_id;
  select * into v_bank from public.bank_accounts where id = v_recon.bank_account_id;
  if new.journal_line_id is not null then
    -- A posted line of this account's cash GL (and association) through the
    -- statement date, not already cleared on a completed reconciliation.
    select jl.debit_amount - jl.credit_amount into v_amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.entry_date <= v_recon.statement_date
     where jl.id = new.journal_line_id
       and jl.gl_account_id = v_bank.gl_account_id
       and (v_bank.association_id is null or jl.association_id = v_bank.association_id);
    if not found then
      raise exception 'That ledger line is not on this bank account by the statement date' using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliation_items i
                 join public.bank_reconciliations r on r.id = i.reconciliation_id
                where i.journal_line_id = new.journal_line_id and i.is_cleared
                  and r.status = 'completed' and r.bank_account_id = v_bank.id) then
      raise exception 'That ledger line was already cleared on an earlier reconciliation' using errcode = '23514';
    end if;
    new.amount := v_amount;
  elsif new.bank_adjustment_id is not null then
    select a.amount into v_amount from public.bank_adjustments a
     where a.id = new.bank_adjustment_id and a.bank_account_id = v_bank.id
       and a.adjustment_date <= v_recon.statement_date;
    if not found then
      raise exception 'That bank adjustment is not on this account by the statement date' using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliation_items i
                 join public.bank_reconciliations r on r.id = i.reconciliation_id
                where i.bank_adjustment_id = new.bank_adjustment_id and i.is_cleared
                  and r.status = 'completed' and r.bank_account_id = v_bank.id) then
      raise exception 'That bank adjustment was already cleared on an earlier reconciliation' using errcode = '23514';
    end if;
    new.amount := v_amount;
  else
    raise exception 'A reconciliation item is a ledger line or a bank adjustment' using errcode = '23514';
  end if;
  return new;
end
$function$;

revoke all on function public.app_guard_bank_reconciliation_item() from public, anon, authenticated;

-- The reconciled date is stamped by completing a reconciliation; it runs as
-- the owner so the column guard below lets it through.
alter function public.update_bank_account_reconciliation_date() security definer;
revoke all on function public.update_bank_account_reconciliation_date() from public, anon, authenticated;

-- 4 and 6: columns only database functions change. A signed-in request
-- writes as "authenticated"; the SECURITY DEFINER functions that own these
-- columns run as their owner.
create or replace function public.app_guard_function_owned_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  -- Nested ifs: PL/pgSQL resolves every field in a condition, so a check of
  -- one table's column must not run for the other table.
  if current_user in ('authenticated', 'anon') then
    if tg_table_name = 'bank_accounts' then
      if new.last_reconciliation_date is distinct from old.last_reconciliation_date then
        raise exception 'The reconciled date is set by completing a bank reconciliation' using errcode = '42501';
      end if;
    elsif tg_table_name = 'payments' then
      if new.bank_deposit_id is distinct from old.bank_deposit_id then
        raise exception 'Add or remove receipts through the bank deposit' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.app_guard_function_owned_columns() from public, anon, authenticated;

create or replace trigger trg_bank_accounts_function_owned_columns
  before update of last_reconciliation_date on public.bank_accounts
  for each row execute function public.app_guard_function_owned_columns();

create or replace trigger trg_payments_function_owned_columns
  before update of bank_deposit_id on public.payments
  for each row execute function public.app_guard_function_owned_columns();

-- 5.
do $$
declare
  v_def text := pg_get_functiondef('public.void_bank_transfer(uuid, date, text)'::regprocedure);
  v_old text := $o$  if t.voided_at is not null then raise exception 'This transfer is already void' using errcode = '22023'; end if;$o$;
  v_new text := $n$  if t.voided_at is not null then raise exception 'This transfer is already void' using errcode = '22023'; end if;
  if coalesce(p_void_date, current_date) < t.transfer_date then
    raise exception 'The void date can''t be before the transfer date (%)', t.transfer_date using errcode = '22023';
  end if;$n$;
begin
  if position('before the transfer date' in v_def) > 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'void_bank_transfer: void check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- Unreconciled lines of a bank account through a statement date (caller's
-- access rules apply).
create or replace function public.bank_reconcilable_lines(p_bank_account_id uuid, p_statement_date date)
returns table (
  id uuid, debit_amount numeric, credit_amount numeric, memo text,
  entry_id uuid, entry_date date, reference_number text, description text,
  source_type text, source_id uuid
)
language sql
stable
set search_path = pg_catalog, public
as $function$
  select jl.id, jl.debit_amount, jl.credit_amount, jl.memo,
         je.id, je.entry_date, je.reference_number, je.description, je.source_type, je.source_id
    from public.bank_accounts b
    join public.journal_lines jl
      on jl.gl_account_id = b.gl_account_id
     and (b.association_id is null or jl.association_id = b.association_id)
    join public.journal_entries je on je.id = jl.entry_id and je.posted and je.entry_date <= p_statement_date
   where b.id = p_bank_account_id
     and not exists (
       select 1 from public.bank_reconciliation_items i
         join public.bank_reconciliations r on r.id = i.reconciliation_id
        where i.journal_line_id = jl.id and i.is_cleared
          and r.status = 'completed' and r.bank_account_id = b.id)
$function$;

revoke all on function public.bank_reconcilable_lines(uuid, date) from public, anon;
grant execute on function public.bank_reconcilable_lines(uuid, date) to authenticated;

-- Security review on this migration. The reconciliation guards above run as
-- the owner (to compute the book balance from the whole ledger), so they
-- must check the caller's access to the bank account themselves first:
--   * a bank_reconciliations row could name another company's bank account
--     (RLS checks only the row's portfolio_id), which returned that account's
--     book balance and, completed, stamped it reconciled;
--   * a manager limited to some associations could reconcile a company-wide
--     account (no association) and see the cash total of every association;
--   * the item guard read any reconciliation's status before RLS.
-- Also: other_receipts.bank_deposit_id gets the same guard as payments, and
-- a scoped manager can't create the company's months either.
create or replace function public.app_can_reconcile_bank(p_bank public.bank_accounts)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select (public.is_platform_operator() or public.can_manage_finance(p_bank.portfolio_id))
     and public.can_view_association_row(p_bank.association_id)
     -- A company-wide account holds every association's cash.
     and not (p_bank.association_id is null and public.manager_is_scoped() is true and not public.is_platform_operator())
$function$;

revoke all on function public.app_can_reconcile_bank(public.bank_accounts) from public, anon, authenticated;

create or replace function public.app_guard_bank_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_bank public.bank_accounts%rowtype;
  v_last date;
  v_outstanding numeric;
  v_bank_only numeric;
  v_difference numeric;
begin
  if public.app_is_repair_session() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- The caller's access to the account comes first, before anything about
  -- it is read or locked.
  select * into v_bank from public.bank_accounts
   where id = case when tg_op = 'DELETE' then old.bank_account_id else new.bank_account_id end;
  if not found or not public.app_can_reconcile_bank(v_bank)
     or (tg_op <> 'INSERT' and old.portfolio_id is distinct from v_bank.portfolio_id) then
    raise exception 'Bank account not found' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'completed' then
      raise exception 'A completed reconciliation cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      raise exception 'A reconciliation starts in progress; complete it after clearing its items' using errcode = '23514';
    end if;
    -- One account at a time: lock it so two starts can't both pass.
    perform 1 from public.bank_accounts where id = v_bank.id for update;
    if v_bank.gl_account_id is null then
      raise exception 'Bank account has no linked GL account' using errcode = '23514';
    end if;
    new.portfolio_id := v_bank.portfolio_id;
    if new.statement_date is null
       or new.statement_date > coalesce(public.association_local_date(v_bank.association_id, now()), current_date) then
      raise exception 'The statement date is in the future' using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliations r
                where r.bank_account_id = new.bank_account_id and r.status = 'in_progress') then
      raise exception 'A reconciliation of this account is already in progress. Finish it before starting another.' using errcode = '23514';
    end if;
    select max(r.statement_date) into v_last from public.bank_reconciliations r
     where r.bank_account_id = new.bank_account_id and r.status = 'completed';
    if v_last is not null and new.statement_date <= v_last then
      raise exception 'This account is reconciled through %. Choose a later statement date.', v_last using errcode = '23514';
    end if;
    new.ending_book_balance := public.app_bank_book_balance(new.bank_account_id, new.statement_date);
    new.difference := new.ending_book_balance - coalesce(new.statement_balance, 0);
    return new;
  end if;

  if old.status in ('completed', 'void') then
    raise exception 'A completed or void reconciliation cannot be changed' using errcode = '55000';
  end if;
  if new.bank_account_id is distinct from old.bank_account_id or new.statement_date is distinct from old.statement_date then
    raise exception 'The account and statement date of a reconciliation cannot change' using errcode = '23514';
  end if;
  new.portfolio_id := old.portfolio_id;
  -- The book balance always comes from the ledger, never the request.
  new.ending_book_balance := public.app_bank_book_balance(new.bank_account_id, new.statement_date);
  if new.status = 'completed' then
    -- Re-checked at completion too (a reconciliation started before these
    -- rules, or before another one completed, must still be in order).
    select max(r.statement_date) into v_last from public.bank_reconciliations r
     where r.bank_account_id = new.bank_account_id and r.status = 'completed' and r.id <> new.id;
    if v_last is not null and new.statement_date <= v_last then
      raise exception 'This account is reconciled through %. This reconciliation can''t be completed.', v_last using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliation_items i
                 join public.bank_reconciliation_items j
                   on (j.journal_line_id = i.journal_line_id or j.bank_adjustment_id = i.bank_adjustment_id)
                 join public.bank_reconciliations r on r.id = j.reconciliation_id
                where i.reconciliation_id = new.id and i.is_cleared and j.is_cleared
                  and r.status = 'completed' and r.bank_account_id = new.bank_account_id and r.id <> new.id) then
      raise exception 'An item on this reconciliation was already cleared on an earlier one' using errcode = '23514';
    end if;
    select coalesce(sum(i.amount) filter (where not i.is_cleared and i.type is distinct from 'bank_only'), 0),
           coalesce(sum(i.amount) filter (where i.is_cleared and i.type = 'bank_only'), 0)
      into v_outstanding, v_bank_only
      from public.bank_reconciliation_items i
     where i.reconciliation_id = new.id;
    v_difference := coalesce(new.statement_balance, 0)
                  - (new.ending_book_balance - v_outstanding + v_bank_only);
    if abs(v_difference) >= 0.01 then
      raise exception 'The reconciliation is out of balance by %', round(abs(v_difference), 2) using errcode = '23514';
    end if;
    new.difference := 0;
    new.reconciled_balance := round(new.ending_book_balance - v_outstanding + v_bank_only, 2);
    new.completed_at := now();
    new.completed_by := coalesce(auth.uid(), new.completed_by);
  else
    new.difference := new.ending_book_balance - coalesce(new.statement_balance, 0);
  end if;
  return new;
end
$function$;

create or replace function public.app_guard_bank_reconciliation_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_recon public.bank_reconciliations%rowtype;
  v_bank public.bank_accounts%rowtype;
  v_amount numeric;
begin
  if public.app_is_repair_session() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- The caller's access to the reconciliation's account comes first.
  select * into v_recon from public.bank_reconciliations
   where id = case when tg_op = 'DELETE' then old.reconciliation_id else new.reconciliation_id end;
  if found then
    select * into v_bank from public.bank_accounts where id = v_recon.bank_account_id;
  end if;
  if v_recon.id is null or v_bank.id is null or not public.app_can_reconcile_bank(v_bank)
     or v_recon.portfolio_id is distinct from v_bank.portfolio_id then
    raise exception 'Reconciliation not found' using errcode = '42501';
  end if;
  perform 1 from public.bank_reconciliations where id = v_recon.id for share;
  if v_recon.status in ('completed', 'void') then
    raise exception 'Items of a completed or void reconciliation cannot be changed' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Only clearing changes; what the item is stays fixed.
    new.reconciliation_id := old.reconciliation_id;
    new.journal_line_id := old.journal_line_id;
    new.bank_adjustment_id := old.bank_adjustment_id;
    new.amount := old.amount;
    new.type := old.type;
    return new;
  end if;

  if new.journal_line_id is not null and new.bank_adjustment_id is not null then
    raise exception 'A reconciliation item is either a ledger line or a bank adjustment' using errcode = '23514';
  end if;
  -- The kind follows what the item is: a ledger line is on the books, an
  -- adjustment is on the bank's side only.
  new.type := case when new.journal_line_id is not null then 'book' else 'bank_only' end;

  if new.journal_line_id is not null then
    select jl.debit_amount - jl.credit_amount into v_amount
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.entry_date <= v_recon.statement_date
     where jl.id = new.journal_line_id
       and jl.gl_account_id = v_bank.gl_account_id
       and (v_bank.association_id is null or jl.association_id = v_bank.association_id);
    if not found then
      raise exception 'That ledger line is not on this bank account by the statement date' using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliation_items i
                 join public.bank_reconciliations r on r.id = i.reconciliation_id
                where i.journal_line_id = new.journal_line_id and i.is_cleared
                  and r.status = 'completed' and r.bank_account_id = v_bank.id) then
      raise exception 'That ledger line was already cleared on an earlier reconciliation' using errcode = '23514';
    end if;
    new.amount := v_amount;
  elsif new.bank_adjustment_id is not null then
    select a.amount into v_amount from public.bank_adjustments a
     where a.id = new.bank_adjustment_id and a.bank_account_id = v_bank.id
       and a.adjustment_date <= v_recon.statement_date;
    if not found then
      raise exception 'That bank adjustment is not on this account by the statement date' using errcode = '23514';
    end if;
    if exists (select 1 from public.bank_reconciliation_items i
                 join public.bank_reconciliations r on r.id = i.reconciliation_id
                where i.bank_adjustment_id = new.bank_adjustment_id and i.is_cleared
                  and r.status = 'completed' and r.bank_account_id = v_bank.id) then
      raise exception 'That bank adjustment was already cleared on an earlier reconciliation' using errcode = '23514';
    end if;
    new.amount := v_amount;
  else
    raise exception 'A reconciliation item is a ledger line or a bank adjustment' using errcode = '23514';
  end if;
  return new;
end
$function$;

create or replace function public.update_bank_account_reconciliation_date()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.bank_accounts
       set last_reconciliation_date = greatest(coalesce(last_reconciliation_date, new.statement_date), new.statement_date),
           updated_at = now()
     where id = new.bank_account_id
       and portfolio_id = new.portfolio_id;
  end if;
  return new;
end;
$function$;

revoke all on function public.update_bank_account_reconciliation_date() from public, anon, authenticated;

create or replace function public.app_guard_function_owned_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  -- Nested ifs: PL/pgSQL resolves every field in a condition, so a check of
  -- one table's column must not run for the other tables.
  if current_user in ('authenticated', 'anon') then
    if tg_table_name = 'bank_accounts' then
      if new.last_reconciliation_date is distinct from old.last_reconciliation_date then
        raise exception 'The reconciled date is set by completing a bank reconciliation' using errcode = '42501';
      end if;
    elsif tg_table_name in ('payments', 'other_receipts') then
      if new.bank_deposit_id is distinct from old.bank_deposit_id then
        raise exception 'Add or remove receipts through the bank deposit' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end
$function$;

create or replace trigger trg_other_receipts_function_owned_columns
  before update of bank_deposit_id on public.other_receipts
  for each row execute function public.app_guard_function_owned_columns();

do $$
declare
  v_def text := pg_get_functiondef('public.initialize_accounting_year(uuid, integer)'::regprocedure);
  v_old text := $o$    raise exception 'Not authorized to initialize accounting periods';
  end if;$o$;
  v_new text := $n$    raise exception 'Not authorized to initialize accounting periods';
  end if;
  if public.manager_is_scoped() is true and not public.is_platform_operator() then
    raise exception 'Months are set up for the whole company. Ask a company admin or a manager who is not limited to specific associations.' using errcode = '42501';
  end if;$n$;
begin
  if position('Months are set up for the whole company' in v_def) > 0 then
    return;  -- already applied
  end if;
  v_def := replace(v_def, E'\r\n', E'\n');
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'initialize_accounting_year: authorization check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- Migration review: the fund rule overrides only the fund types it owns, so
-- an explicit insurance_proceeds or construction_escrow account keeps its
-- trust protection.
create or replace function public.bank_accounts_fund_type_from_purpose()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.purpose::text in ('operating', 'reserve', 'special_assessment')
     and (new.fund_type is null or new.fund_type in ('operating', 'reserve', 'special_assessment')) then
    new.fund_type := new.purpose::text;
  end if;
  return new;
end
$function$;

-- One item per ledger line or adjustment on a reconciliation.
create unique index if not exists bank_reconciliation_items_one_line
  on public.bank_reconciliation_items (reconciliation_id, journal_line_id) where journal_line_id is not null;
create unique index if not exists bank_reconciliation_items_one_adjustment
  on public.bank_reconciliation_items (reconciliation_id, bank_adjustment_id) where bank_adjustment_id is not null;

-- Clearer wording for the scoped-manager refusal on closing months.
do $$
declare
  v_def text := pg_get_functiondef('public.set_accounting_period_status(uuid, text, text)'::regprocedure);
begin
  if position('Ask a company admin or a manager of every association.' in v_def) > 0 then
    execute replace(v_def, 'Ask a company admin or a manager of every association.',
      'Ask a company admin or a manager who is not limited to specific associations.');
  end if;
end
$$;
