-- Financial Accounts gaps (AppFolio parity):
-- 1. Bank deposits from receipts. Receipts already debit the bank's cash
--    account when recorded; a bank deposit groups the receipts that went to
--    the bank together, so the deposit can be matched to the one line on the
--    bank statement. Grouping posts nothing to the ledger.
-- 2. Bank feed: imported transactions can be matched to a ledger line of the
--    bank, posted as a new entry (bank fees, interest), or ignored. Matched
--    lines start cleared on the next reconciliation.
-- 3. Bank adjustments (bank-only items) appear on reconciliations.

-- ── 1. Bank deposits ─────────────────────────────────────────
create table if not exists public.bank_deposits (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id),
  association_id uuid references public.associations(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  deposit_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  receipt_count integer not null,
  memo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id)
);
create index if not exists bank_deposits_bank_idx on public.bank_deposits (bank_account_id, deposit_date desc);
alter table public.bank_deposits enable row level security;
revoke all on public.bank_deposits from anon, authenticated;
grant select on public.bank_deposits to authenticated;
create policy bank_deposits_finance_read on public.bank_deposits for select to authenticated
  using (public.can_manage_finance(portfolio_id));
create policy mgr_assoc_scope on public.bank_deposits as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

alter table public.payments add column if not exists bank_deposit_id uuid references public.bank_deposits(id);
alter table public.other_receipts add column if not exists bank_deposit_id uuid references public.bank_deposits(id);
create index if not exists payments_bank_deposit_idx on public.payments (bank_deposit_id) where bank_deposit_id is not null;
create index if not exists other_receipts_bank_deposit_idx on public.other_receipts (bank_deposit_id) where bank_deposit_id is not null;

create or replace function public.create_bank_deposit(
  p_bank_account_id uuid, p_deposit_date date, p_payment_ids uuid[], p_other_receipt_ids uuid[], p_memo text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_bank public.bank_accounts;
  v_id uuid;
  v_total numeric := 0;
  v_count integer := 0;
  v_n integer;
  v_sum numeric;
begin
  select * into v_bank from public.bank_accounts where id = p_bank_account_id and archived_at is null;
  if not found or not public.can_manage_finance(v_bank.portfolio_id)
     or (v_bank.association_id is not null and not public.can_view_association_row(v_bank.association_id)) then
    raise exception 'Bank account not found' using errcode = 'P0002';
  end if;
  if p_deposit_date is null then raise exception 'Choose the deposit date' using errcode = '22023'; end if;
  if coalesce(cardinality(p_payment_ids), 0) + coalesce(cardinality(p_other_receipt_ids), 0) = 0 then
    raise exception 'Select at least one receipt' using errcode = '22023';
  end if;

  insert into public.bank_deposits (portfolio_id, association_id, bank_account_id, deposit_date, amount, receipt_count, memo, created_by)
  values (v_bank.portfolio_id, v_bank.association_id, v_bank.id, p_deposit_date, 0.01, 0, nullif(btrim(coalesce(p_memo, '')), ''), auth.uid())
  returning id into v_id;

  if coalesce(cardinality(p_payment_ids), 0) > 0 then
    -- Only this bank's receipts that are live, received by the deposit date
    -- and not in another deposit; every selected one must qualify.
    with picked as (
      update public.payments p set bank_deposit_id = v_id
       where p.id = any (p_payment_ids) and p.bank_account_id = v_bank.id and p.bank_deposit_id is null
         and p.reversed_at is null and p.payment_date <= p_deposit_date
      returning p.amount)
    select count(*), coalesce(sum(amount), 0) into v_n, v_sum from picked;
    if v_n <> (select count(distinct x) from unnest(p_payment_ids) x) then
      raise exception 'A selected receipt is already deposited, reversed, dated after the deposit, or went to another bank account' using errcode = '22023';
    end if;
    v_count := v_count + v_n; v_total := v_total + v_sum;
  end if;

  if coalesce(cardinality(p_other_receipt_ids), 0) > 0 then
    with picked as (
      update public.other_receipts r set bank_deposit_id = v_id
       where r.id = any (p_other_receipt_ids) and r.bank_account_id = v_bank.id and r.bank_deposit_id is null
         and r.voided_at is null and r.receipt_date <= p_deposit_date
      returning r.amount)
    select count(*), coalesce(sum(amount), 0) into v_n, v_sum from picked;
    if v_n <> (select count(distinct x) from unnest(p_other_receipt_ids) x) then
      raise exception 'A selected receipt is already deposited, voided, dated after the deposit, or went to another bank account' using errcode = '22023';
    end if;
    v_count := v_count + v_n; v_total := v_total + v_sum;
  end if;

  if v_total <= 0 then raise exception 'The deposit total must be greater than zero' using errcode = '22023'; end if;
  update public.bank_deposits set amount = round(v_total, 2), receipt_count = v_count where id = v_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_bank.portfolio_id, 'bank_deposit', v_id, 'created', auth.uid(), jsonb_build_object('amount', round(v_total, 2), 'receipts', v_count));
  return v_id;
end $$;

-- Undo a deposit (the receipts become undeposited again). Not once any of
-- its receipts cleared the bank on a completed reconciliation.
create or replace function public.void_bank_deposit(p_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare d public.bank_deposits;
begin
  select * into d from public.bank_deposits where id = p_id and voided_at is null for update;
  if not found or not public.can_manage_finance(d.portfolio_id)
     or (d.association_id is not null and not public.can_view_association_row(d.association_id)) then
    raise exception 'Bank deposit not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.bank_reconciliation_items i
      join public.bank_reconciliations r on r.id = i.reconciliation_id and r.status = 'completed'
      join public.journal_lines jl on jl.id = i.journal_line_id
      join public.journal_entries je on je.id = jl.entry_id
     where i.is_cleared
       and ((je.source_type = 'payment' and je.source_id in (select id from public.payments where bank_deposit_id = p_id))
         or je.id in (select journal_entry_id from public.other_receipts where bank_deposit_id = p_id))) then
    raise exception 'This deposit cleared on a completed bank reconciliation and can no longer be undone' using errcode = '22023';
  end if;
  update public.payments set bank_deposit_id = null where bank_deposit_id = p_id;
  update public.other_receipts set bank_deposit_id = null where bank_deposit_id = p_id;
  update public.bank_deposits set voided_at = now(), voided_by = auth.uid() where id = p_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (d.portfolio_id, 'bank_deposit', p_id, 'voided', auth.uid(), jsonb_build_object('amount', d.amount));
end $$;

-- ── 2. Bank feed ─────────────────────────────────────────────
alter table public.bank_transactions add column if not exists matched_journal_line_id uuid references public.journal_lines(id);
alter table public.bank_transactions add column if not exists ignored_at timestamptz;
create unique index if not exists bank_transactions_matched_line_uidx on public.bank_transactions (matched_journal_line_id) where matched_journal_line_id is not null;

-- Locks the transaction and checks the caller may act on its bank account.
create or replace function public.app_bank_transaction_for_update(p_id uuid)
returns public.bank_transactions language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare t public.bank_transactions; b public.bank_accounts;
begin
  select * into t from public.bank_transactions where id = p_id for update;
  if not found then raise exception 'Bank transaction not found' using errcode = 'P0002'; end if;
  select * into b from public.bank_accounts where id = t.bank_account_id;
  if b.id is null or not public.can_manage_finance(b.portfolio_id)
     or (b.association_id is not null and not public.can_view_association_row(b.association_id)) then
    raise exception 'Bank transaction not found' using errcode = 'P0002';
  end if;
  if b.gl_account_id is null then raise exception 'Link the bank account to a GL account first' using errcode = '22023'; end if;
  if t.matched_journal_line_id is not null then raise exception 'This transaction is already matched' using errcode = '22023'; end if;
  if t.pending then raise exception 'Wait until the bank posts this transaction' using errcode = '22023'; end if;
  return t;
end $$;
revoke all on function public.app_bank_transaction_for_update(uuid) from public, anon, authenticated;

-- Match to an existing posted line of the bank. Bank amounts are positive for
-- money leaving the account, so the line's net (debit - credit) is -amount.
create or replace function public.match_bank_transaction(p_id uuid, p_journal_line_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  t public.bank_transactions := public.app_bank_transaction_for_update(p_id);
  b public.bank_accounts;
begin
  select * into b from public.bank_accounts where id = t.bank_account_id;
  if not exists (select 1 from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
                  where jl.id = p_journal_line_id and je.posted and je.portfolio_id = b.portfolio_id
                    and jl.gl_account_id = b.gl_account_id and jl.association_id is not distinct from b.association_id
                    and round(jl.debit_amount - jl.credit_amount, 2) = round(-t.amount, 2)) then
    raise exception 'That ledger line is not on this bank account for the same amount' using errcode = '22023';
  end if;
  if exists (select 1 from public.bank_transactions where matched_journal_line_id = p_journal_line_id) then
    raise exception 'That ledger line is already matched to another bank transaction' using errcode = '22023';
  end if;
  update public.bank_transactions set matched_journal_line_id = p_journal_line_id, matched_at = now(),
         match_method = 'manual', reviewed = true, ignored_at = null
   where id = t.id;
end $$;

-- Post a transaction the books don't have yet (bank fee, interest) to a GL
-- account, and match it to the new bank line.
create or replace function public.post_bank_transaction(p_id uuid, p_gl_account_id uuid, p_memo text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  t public.bank_transactions := public.app_bank_transaction_for_update(p_id);
  b public.bank_accounts;
  v_entry uuid;
  v_line uuid;
  v_amt numeric;
  v_memo text;
begin
  select * into b from public.bank_accounts where id = t.bank_account_id;
  if p_gl_account_id = b.gl_account_id or not exists (
       select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = b.portfolio_id and g.active
          and (g.association_id is null or g.association_id is not distinct from b.association_id)) then
    raise exception 'Choose another GL account of this bank account''s association' using errcode = '22023';
  end if;
  v_amt := abs(round(t.amount, 2));
  if v_amt = 0 then raise exception 'This transaction has no amount' using errcode = '22023'; end if;
  v_memo := coalesce(nullif(btrim(coalesce(p_memo, '')), ''), coalesce(t.merchant_name, t.name));
  insert into public.journal_entries (portfolio_id, entry_date, description, memo, source_type, source_id, created_by, posted, posted_at)
  values (b.portfolio_id, t.date, 'Bank transaction: ' || coalesce(t.name, 'bank feed'), v_memo, 'bank_transaction', t.id, auth.uid(), true, now())
  returning id into v_entry;
  -- Money out (positive) credits the bank; money in debits it.
  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, b.association_id, b.gl_account_id, case when t.amount < 0 then v_amt else 0 end, case when t.amount > 0 then v_amt else 0 end, v_memo, 0)
  returning id into v_line;
  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, b.association_id, p_gl_account_id, case when t.amount > 0 then v_amt else 0 end, case when t.amount < 0 then v_amt else 0 end, v_memo, 1);
  update public.bank_transactions set matched_journal_line_id = v_line, matched_at = now(), match_method = 'posted',
         gl_account_id = p_gl_account_id, reviewed = true, ignored_at = null
   where id = t.id;
  return v_entry;
end $$;

-- Ignore (not a bank account movement the books track) or bring back.
create or replace function public.set_bank_transaction_ignored(p_id uuid, p_ignored boolean)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare t public.bank_transactions := public.app_bank_transaction_for_update(p_id);
begin
  update public.bank_transactions
     set ignored_at = case when p_ignored then now() end, reviewed = coalesce(p_ignored, false)
   where id = t.id;
end $$;

-- ── 3. Bank adjustments on reconciliations ───────────────────
alter table public.bank_reconciliation_items add column if not exists bank_adjustment_id uuid references public.bank_adjustments(id);

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_bank_deposit(uuid, date, uuid[], uuid[], text)',
    'public.void_bank_deposit(uuid)',
    'public.match_bank_transaction(uuid, uuid)',
    'public.post_bank_transaction(uuid, uuid, text)',
    'public.set_bank_transaction_ignored(uuid, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
