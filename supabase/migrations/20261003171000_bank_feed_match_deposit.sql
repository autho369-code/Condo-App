-- A deposit on the bank statement is the total of the receipts grouped into a
-- bank deposit, so a bank feed transaction can also match a whole deposit.
alter table public.bank_transactions add column if not exists matched_bank_deposit_id uuid references public.bank_deposits(id);
create unique index if not exists bank_transactions_matched_deposit_uidx on public.bank_transactions (matched_bank_deposit_id) where matched_bank_deposit_id is not null;

create or replace function public.match_bank_transaction_to_deposit(p_id uuid, p_deposit_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare t public.bank_transactions := public.app_bank_transaction_for_update(p_id);
begin
  if t.matched_bank_deposit_id is not null then raise exception 'This transaction is already matched' using errcode = '22023'; end if;
  if t.amount >= 0 then raise exception 'Only money coming in can match a deposit' using errcode = '22023'; end if;
  if not exists (select 1 from public.bank_deposits d where d.id = p_deposit_id and d.bank_account_id = t.bank_account_id
                    and d.voided_at is null and round(d.amount, 2) = round(-t.amount, 2)) then
    raise exception 'That deposit is not on this bank account for the same amount' using errcode = '22023';
  end if;
  if exists (select 1 from public.bank_transactions where matched_bank_deposit_id = p_deposit_id) then
    raise exception 'That deposit is already matched to another bank transaction' using errcode = '22023';
  end if;
  update public.bank_transactions set matched_bank_deposit_id = p_deposit_id, matched_at = now(),
         match_method = 'deposit', reviewed = true, ignored_at = null
   where id = t.id;
end $$;
revoke all on function public.match_bank_transaction_to_deposit(uuid, uuid) from public, anon;
grant execute on function public.match_bank_transaction_to_deposit(uuid, uuid) to authenticated;

-- A transaction matched to a deposit is matched too.
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
  if t.matched_journal_line_id is not null or t.matched_bank_deposit_id is not null then
    raise exception 'This transaction is already matched' using errcode = '22023';
  end if;
  if t.pending then raise exception 'Wait until the bank posts this transaction' using errcode = '22023'; end if;
  return t;
end $$;
revoke all on function public.app_bank_transaction_for_update(uuid) from public, anon, authenticated;

-- A deposit the bank feed matched can't be undone.
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
  if exists (select 1 from public.bank_transactions where matched_bank_deposit_id = p_id) then
    raise exception 'The bank feed matched this deposit to a bank transaction; it can no longer be undone' using errcode = '22023';
  end if;
  update public.payments set bank_deposit_id = null where bank_deposit_id = p_id;
  update public.other_receipts set bank_deposit_id = null where bank_deposit_id = p_id;
  update public.bank_deposits set voided_at = now(), voided_by = auth.uid() where id = p_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (d.portfolio_id, 'bank_deposit', p_id, 'voided', auth.uid(), jsonb_build_object('amount', d.amount));
end $$;
