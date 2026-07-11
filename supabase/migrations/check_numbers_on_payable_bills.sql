-- Dedicated check number on payable bills: the check run was overloading
-- bill_number (the vendor invoice/reference), so printed checks and the MICR
-- line showed invoice numbers. check_number now records the real check.
alter table public.payable_bills add column if not exists check_number integer;

create or replace function public.record_check_run(
  p_bank_account_id uuid,
  p_bill_ids uuid[],
  p_starting_check_number integer,
  p_payment_date date default current_date
) returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  bill_id uuid;
  idx integer := 0;
  bank_row public.bank_accounts;
  results jsonb := '[]'::jsonb;
begin
  select * into bank_row from public.bank_accounts where id = p_bank_account_id for update;
  if not found then raise exception 'bank account not found'; end if;

  if not public.can_manage_finance(bank_row.portfolio_id) then
    raise exception 'permission denied';
  end if;

  foreach bill_id in array p_bill_ids loop
    update public.payable_bills
       set status = 'paid'::public.payable_bill_status,
           paid_at = p_payment_date::timestamptz,
           bank_account_id = p_bank_account_id,
           check_number = p_starting_check_number + idx,
           updated_at = now()
     where id = bill_id
       and public.can_manage_finance(portfolio_id);
    if found then
      results := results || jsonb_build_object(
        'bill_id', bill_id,
        'check_number', p_starting_check_number + idx
      );
      idx := idx + 1;
    end if;
  end loop;

  -- Advance bank_accounts.next_check_number
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
$function$;
