-- Complete the payable lifecycle: approval accrues expense/AP, check writing
-- clears AP/cash, and voiding an unpaid bill reverses its accrual.
create unique index if not exists journal_entries_payable_source_unique
  on public.journal_entries (source_type, source_id)
  where source_id is not null
    and source_type in ('payable_bill', 'check_payment', 'payable_bill_void');

create or replace function public.ensure_payable_bill_accrual(p_bill_id uuid)
returns uuid
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  bill_row public.payable_bills;
  ap_account_id uuid;
  entry_id uuid;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('approved'::public.payable_bill_status, 'paid'::public.payable_bill_status) then
    raise exception 'Bill must be approved before posting';
  end if;
  if bill_row.association_id is null or bill_row.gl_account_id is null then
    raise exception 'Bill requires an association and expense GL account before posting';
  end if;

  select id into entry_id from public.journal_entries
   where source_type = 'payable_bill' and source_id = p_bill_id;
  if found then return entry_id; end if;

  perform 1 from public.gl_accounts
   where id = bill_row.gl_account_id
     and portfolio_id = bill_row.portfolio_id
     and active
     and (association_id is null or association_id = bill_row.association_id);
  if not found then raise exception 'Bill expense GL account is not active in this portfolio/association'; end if;

  select id into ap_account_id from public.gl_accounts
   where portfolio_id = bill_row.portfolio_id
     and active
     and account_type = 'liability'::public.gl_account_type
     and (association_id is null or association_id = bill_row.association_id)
     and (number::text = '2000' or lower(name) = 'accounts payable')
   order by (association_id = bill_row.association_id) desc, id
   limit 1;
  if ap_account_id is null then raise exception 'No active Accounts Payable GL account is configured'; end if;

  insert into public.journal_entries (
    portfolio_id, entry_date, description, memo, reference_number,
    source_type, source_id, created_by, posted, posted_at
  ) values (
    bill_row.portfolio_id, bill_row.bill_date,
    'Bill accrued: ' || coalesce(bill_row.bill_number, p_bill_id::text), bill_row.memo,
    bill_row.bill_number, 'payable_bill', p_bill_id, auth.uid(), true, now()
  ) returning id into entry_id;

  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values
    (entry_id, bill_row.association_id, bill_row.gl_account_id, bill_row.amount, 0, bill_row.memo, 1),
    (entry_id, bill_row.association_id, ap_account_id, 0, bill_row.amount, bill_row.memo, 2);
  return entry_id;
end;
$$;

create or replace function public.approve_payable_bill(p_bill_id uuid)
returns uuid
language plpgsql
set search_path = pg_catalog, public
as $$
declare entry_id uuid; bill_portfolio uuid;
begin
  select portfolio_id into bill_portfolio from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_portfolio) then raise exception 'Permission denied'; end if;
  update public.payable_bills
     set status = 'approved'::public.payable_bill_status, approved_at = now(), approved_by = auth.uid(), updated_at = now()
   where id = p_bill_id and status in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status, 'approved'::public.payable_bill_status);
  if not found then raise exception 'Paid or void bills cannot be approved'; end if;
  entry_id := public.ensure_payable_bill_accrual(p_bill_id);
  return entry_id;
end;
$$;

create or replace function public.void_payable_bill(p_bill_id uuid)
returns uuid
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  bill_row public.payable_bills;
  accrual_id uuid;
  reversal_id uuid;
  line record;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if bill_row.status = 'paid'::public.payable_bill_status or bill_row.paid_at is not null then
    raise exception 'Paid bills require a check void/stop-payment workflow';
  end if;
  if bill_row.status = 'void'::public.payable_bill_status then
    select id into reversal_id from public.journal_entries where source_type = 'payable_bill_void' and source_id = p_bill_id;
    return reversal_id;
  end if;

  select id into accrual_id from public.journal_entries where source_type = 'payable_bill' and source_id = p_bill_id;
  if accrual_id is not null then
    insert into public.journal_entries (
      portfolio_id, entry_date, description, memo, reference_number,
      source_type, source_id, created_by, posted, posted_at
    ) values (
      bill_row.portfolio_id, current_date,
      'Void bill: ' || coalesce(bill_row.bill_number, p_bill_id::text), bill_row.memo,
      bill_row.bill_number, 'payable_bill_void', p_bill_id, auth.uid(), true, now()
    ) returning id into reversal_id;
    for line in select * from public.journal_lines where entry_id = accrual_id order by sort_order loop
      insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
      values (reversal_id, line.association_id, line.gl_account_id, line.credit_amount, line.debit_amount, 'Reversal: ' || coalesce(line.memo, ''), line.sort_order);
    end loop;
  end if;
  update public.payable_bills set status = 'void'::public.payable_bill_status, updated_at = now() where id = p_bill_id;
  return reversal_id;
end;
$$;

-- Replace the hardened check writer to add balanced ledger posting.
create or replace function public.record_check_run(
  p_bank_account_id uuid,
  p_bill_ids uuid[],
  p_starting_check_number integer,
  p_payment_date date default current_date
) returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  bill_id uuid;
  bill_row public.payable_bills;
  bank_row public.bank_accounts;
  ap_account_id uuid;
  payment_entry_id uuid;
  idx integer := 0;
  expected_count integer;
  results jsonb := '[]'::jsonb;
begin
  if p_bank_account_id is null or coalesce(cardinality(p_bill_ids), 0) = 0 then raise exception 'A bank account and at least one bill are required'; end if;
  if p_starting_check_number is null or p_starting_check_number < 1 then raise exception 'Starting check number must be positive'; end if;
  if p_payment_date is null then raise exception 'Payment date is required'; end if;
  select * into bank_row from public.bank_accounts where id = p_bank_account_id and archived_at is null for update;
  if not found then raise exception 'Bank account not found or archived'; end if;
  if not public.can_manage_finance(bank_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if bank_row.gl_account_id is null then raise exception 'Bank account requires a cash GL account'; end if;
  if bank_row.next_check_number is not null and p_starting_check_number <> bank_row.next_check_number then
    raise exception 'Starting check number must match the bank account next check number (%)', bank_row.next_check_number;
  end if;
  select count(distinct id)::integer into expected_count from public.payable_bills where id = any(p_bill_ids);
  if expected_count <> cardinality(p_bill_ids) then raise exception 'Bill selection contains a duplicate or unknown bill'; end if;

  foreach bill_id in array p_bill_ids loop
    select * into bill_row from public.payable_bills where id = bill_id for update;
    if bill_row.portfolio_id is distinct from bank_row.portfolio_id then raise exception 'Bill % is not in the bank account portfolio', bill_id; end if;
    if bank_row.association_id is not null and bill_row.association_id is distinct from bank_row.association_id then raise exception 'Bill % is not in the bank account association', bill_id; end if;
    if bill_row.status <> 'approved'::public.payable_bill_status or bill_row.paid_at is not null or bill_row.check_number is not null then raise exception 'Bill % is not approved and unpaid', bill_id; end if;
    if bill_row.amount <= 0 then raise exception 'Bill % has a non-positive amount', bill_id; end if;
    if exists (select 1 from public.journal_entries where source_type = 'check_payment' and source_id = bill_id) then raise exception 'Bill % already has a check-payment ledger entry', bill_id; end if;
    perform public.ensure_payable_bill_accrual(bill_id);
  end loop;
  if exists (select 1 from public.payable_bills where bank_account_id = p_bank_account_id and check_number between p_starting_check_number and p_starting_check_number + cardinality(p_bill_ids) - 1) then
    raise exception 'One or more check numbers are already in use for this bank account';
  end if;

  foreach bill_id in array p_bill_ids loop
    select * into bill_row from public.payable_bills where id = bill_id;
    select id into ap_account_id from public.gl_accounts
     where portfolio_id = bill_row.portfolio_id and active and account_type = 'liability'::public.gl_account_type
       and (association_id is null or association_id = bill_row.association_id)
       and (number::text = '2000' or lower(name) = 'accounts payable')
     order by (association_id = bill_row.association_id) desc, id limit 1;

    insert into public.journal_entries (
      portfolio_id, entry_date, description, memo, reference_number,
      source_type, source_id, created_by, posted, posted_at
    ) values (
      bill_row.portfolio_id, p_payment_date,
      'Check #' || (p_starting_check_number + idx)::text || ': ' || coalesce(bill_row.bill_number, bill_id::text),
      bill_row.memo, (p_starting_check_number + idx)::text,
      'check_payment', bill_id, auth.uid(), true, now()
    ) returning id into payment_entry_id;
    insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
    values
      (payment_entry_id, bill_row.association_id, ap_account_id, bill_row.amount, 0, bill_row.memo, 1),
      (payment_entry_id, bill_row.association_id, bank_row.gl_account_id, 0, bill_row.amount, bill_row.memo, 2);

    update public.payable_bills set status = 'paid'::public.payable_bill_status, paid_at = p_payment_date::timestamptz,
      bank_account_id = p_bank_account_id, check_number = p_starting_check_number + idx, updated_at = now() where id = bill_id;
    results := results || jsonb_build_object('bill_id', bill_id, 'check_number', p_starting_check_number + idx, 'journal_entry_id', payment_entry_id);
    idx := idx + 1;
  end loop;
  update public.bank_accounts set next_check_number = p_starting_check_number + idx, updated_at = now() where id = p_bank_account_id;
  return jsonb_build_object('checks_written', idx, 'starting_check_number', p_starting_check_number,
    'next_check_number', p_starting_check_number + idx, 'results', results);
end;
$$;

revoke all on function public.ensure_payable_bill_accrual(uuid) from public, anon;
revoke all on function public.approve_payable_bill(uuid) from public, anon;
revoke all on function public.void_payable_bill(uuid) from public, anon;
revoke all on function public.record_check_run(uuid, uuid[], integer, date) from public, anon;
grant execute on function public.ensure_payable_bill_accrual(uuid) to authenticated, service_role;
grant execute on function public.approve_payable_bill(uuid) to authenticated, service_role;
grant execute on function public.void_payable_bill(uuid) to authenticated, service_role;
grant execute on function public.record_check_run(uuid, uuid[], integer, date) to authenticated, service_role;
