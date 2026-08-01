-- Check writing moves money and must be atomic, tenant-scoped, and number-safe.
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
  idx integer := 0;
  expected_count integer;
  results jsonb := '[]'::jsonb;
begin
  if p_bank_account_id is null or coalesce(cardinality(p_bill_ids), 0) = 0 then
    raise exception 'A bank account and at least one bill are required';
  end if;
  if p_starting_check_number is null or p_starting_check_number < 1 then
    raise exception 'Starting check number must be positive';
  end if;
  if p_payment_date is null then
    raise exception 'Payment date is required';
  end if;

  select * into bank_row
    from public.bank_accounts
   where id = p_bank_account_id
     and archived_at is null
   for update;
  if not found then raise exception 'Bank account not found or archived'; end if;
  if not public.can_manage_finance(bank_row.portfolio_id) then
    raise exception 'Permission denied';
  end if;
  if bank_row.next_check_number is not null and p_starting_check_number <> bank_row.next_check_number then
    raise exception 'Starting check number must match the bank account next check number (%)', bank_row.next_check_number;
  end if;

  select count(distinct id)::integer into expected_count
    from public.payable_bills
   where id = any(p_bill_ids);
  if expected_count <> cardinality(p_bill_ids) then
    raise exception 'Bill selection contains a duplicate or unknown bill';
  end if;

  -- Validate the entire batch before changing a single bill.
  foreach bill_id in array p_bill_ids loop
    select * into bill_row
      from public.payable_bills
     where id = bill_id
     for update;
    if bill_row.portfolio_id is distinct from bank_row.portfolio_id then
      raise exception 'Bill % is not in the bank account portfolio', bill_id;
    end if;
    if bank_row.association_id is not null and bill_row.association_id is distinct from bank_row.association_id then
      raise exception 'Bill % is not in the bank account association', bill_id;
    end if;
    if bill_row.status <> 'approved'::public.payable_bill_status or bill_row.paid_at is not null or bill_row.check_number is not null then
      raise exception 'Bill % is not approved and unpaid', bill_id;
    end if;
    if bill_row.amount <= 0 then
      raise exception 'Bill % has a non-positive amount', bill_id;
    end if;
  end loop;

  if exists (
    select 1 from public.payable_bills
     where bank_account_id = p_bank_account_id
       and check_number between p_starting_check_number and p_starting_check_number + cardinality(p_bill_ids) - 1
  ) then
    raise exception 'One or more check numbers are already in use for this bank account';
  end if;

  foreach bill_id in array p_bill_ids loop
    update public.payable_bills
       set status = 'paid'::public.payable_bill_status,
           paid_at = p_payment_date::timestamptz,
           bank_account_id = p_bank_account_id,
           check_number = p_starting_check_number + idx,
           updated_at = now()
     where id = bill_id;
    results := results || jsonb_build_object('bill_id', bill_id, 'check_number', p_starting_check_number + idx);
    idx := idx + 1;
  end loop;

  update public.bank_accounts
     set next_check_number = p_starting_check_number + idx,
         updated_at = now()
   where id = p_bank_account_id;

  return jsonb_build_object(
    'checks_written', idx,
    'starting_check_number', p_starting_check_number,
    'next_check_number', p_starting_check_number + idx,
    'results', results
  );
end;
$$;

revoke all on function public.record_check_run(uuid, uuid[], integer, date) from public, anon;
grant execute on function public.record_check_run(uuid, uuid[], integer, date) to authenticated, service_role;
