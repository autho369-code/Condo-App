-- Immutable issued-check history plus an accounting-safe paid-check void path.
create table if not exists public.payable_checks (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id),
  association_id uuid references public.associations(id),
  bill_id uuid not null references public.payable_bills(id),
  vendor_id uuid not null references public.vendors(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  check_number integer not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  status text not null default 'issued' check (status in ('issued', 'voided', 'stop_payment')),
  run_transaction_id bigint not null default txid_current(),
  payment_entry_id uuid not null references public.journal_entries(id),
  void_entry_id uuid references public.journal_entries(id),
  issued_by uuid references auth.users(id),
  issued_at timestamptz not null default transaction_timestamp(),
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  replaced_by_check_id uuid references public.payable_checks(id),
  unique (bank_account_id, check_number),
  unique (payment_entry_id)
);

create index if not exists payable_checks_bill_idx on public.payable_checks(bill_id, issued_at desc);
create index if not exists payable_checks_run_idx on public.payable_checks(run_transaction_id, check_number);
alter table public.payable_checks enable row level security;

drop policy if exists payable_checks_finance_read on public.payable_checks;
create policy payable_checks_finance_read on public.payable_checks for select to authenticated
using (public.can_manage_finance(portfolio_id));
drop policy if exists payable_checks_platform_all on public.payable_checks;
create policy payable_checks_platform_all on public.payable_checks to authenticated
using (public.is_platform_operator()) with check (public.is_platform_operator());

create or replace function public.capture_issued_payable_check()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare payment_id uuid; check_id uuid;
begin
  if new.status = 'paid'::public.payable_bill_status
     and new.paid_at is not null and new.bank_account_id is not null and new.check_number is not null
     and (old.status is distinct from new.status or old.check_number is distinct from new.check_number) then
    select id into payment_id from public.journal_entries
     where source_type = 'check_payment' and source_id = new.id
     order by created_at desc limit 1;
    if payment_id is null then raise exception 'Paid check is missing its payment journal entry'; end if;
    insert into public.payable_checks (
      portfolio_id, association_id, bill_id, vendor_id, bank_account_id,
      check_number, amount, payment_date, payment_entry_id, issued_by
    ) values (
      new.portfolio_id, new.association_id, new.id, new.vendor_id, new.bank_account_id,
      new.check_number, new.amount, new.paid_at::date, payment_id, auth.uid()
    ) returning id into check_id;
    -- Payment entries belong to checks, not bills. This permits a later reissue
    -- while retaining every original and reversal in the audit trail.
    update public.journal_entries set source_id = check_id where id = payment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_issued_payable_check on public.payable_bills;
create trigger trg_capture_issued_payable_check
after update of status, paid_at, bank_account_id, check_number on public.payable_bills
for each row execute function public.capture_issued_payable_check();

create or replace function public.void_payable_check(
  p_check_id uuid,
  p_reason text,
  p_stop_payment boolean default false
) returns uuid
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  check_row public.payable_checks;
  bill_row public.payable_bills;
  reversal_id uuid;
  line record;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A void/stop-payment reason is required'; end if;
  select * into check_row from public.payable_checks where id = p_check_id for update;
  if not found then raise exception 'Check not found'; end if;
  if not public.can_manage_finance(check_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if check_row.status <> 'issued' then raise exception 'Only an issued check can be voided or stopped'; end if;

  select * into bill_row from public.payable_bills where id = check_row.bill_id for update;
  if bill_row.status <> 'paid'::public.payable_bill_status
     or bill_row.bank_account_id is distinct from check_row.bank_account_id
     or bill_row.check_number::integer is distinct from check_row.check_number then
    raise exception 'Bill no longer matches this issued check';
  end if;

  insert into public.journal_entries (
    portfolio_id, entry_date, description, memo, reference_number,
    source_type, source_id, created_by, posted, posted_at
  ) values (
    check_row.portfolio_id, current_date,
    case when p_stop_payment then 'Stop payment' else 'Void check' end || ' #' || check_row.check_number::text,
    trim(p_reason), check_row.check_number::text,
    'check_payment_void', check_row.id, auth.uid(), true, now()
  ) returning id into reversal_id;
  for line in select * from public.journal_lines where entry_id = check_row.payment_entry_id order by sort_order loop
    insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
    values (reversal_id, line.association_id, line.gl_account_id, line.credit_amount, line.debit_amount,
      case when p_stop_payment then 'Stop payment: ' else 'Void: ' end || trim(p_reason), line.sort_order);
  end loop;

  update public.payable_checks set
    status = case when p_stop_payment then 'stop_payment' else 'voided' end,
    void_entry_id = reversal_id, voided_by = auth.uid(), voided_at = now(), void_reason = trim(p_reason)
   where id = p_check_id;
  update public.payable_bills set
    status = 'approved'::public.payable_bill_status,
    paid_at = null, bank_account_id = null, check_number = null, updated_at = now()
   where id = check_row.bill_id;
  return reversal_id;
end;
$$;

revoke all on function public.capture_issued_payable_check() from public, anon, authenticated;
revoke all on function public.void_payable_check(uuid, text, boolean) from public, anon;
grant execute on function public.void_payable_check(uuid, text, boolean) to authenticated, service_role;
grant select on public.payable_checks to authenticated;
