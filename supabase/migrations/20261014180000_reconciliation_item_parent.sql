-- Codex on #361: an update to a reconciliation item was checked against the
-- reconciliation named in the request (new.reconciliation_id), then reset to
-- the item's own. Naming an open reconciliation let a finance user change an
-- item of a completed one. Updates and deletes are now checked against the
-- reconciliation the item belongs to.
--
-- Also from Codex on #361 (not changed here): the fund_type backfill in
-- 20261014170000 would overwrite an explicit insurance_proceeds or
-- construction_escrow type on a reserve or special-assessment account. On
-- production no account had such a type when it ran (checked beforehand:
-- only operating/operating and reserve/operating), so nothing was lost.

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
   -- An existing item is checked against the reconciliation it belongs to
   -- (an update keeps that one), never one named in the request.
   where id = case when tg_op = 'INSERT' then new.reconciliation_id else old.reconciliation_id end;
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

revoke all on function public.app_guard_bank_reconciliation_item() from public, anon, authenticated;
