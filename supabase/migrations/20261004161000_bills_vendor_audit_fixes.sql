-- Bills / vendor payment audit fixes.
--  1. Vendor "Hold payments" is enforced: held vendors leave the check-writing
--     queue, and the check run and the eCheck/ACH/online payment RPC refuse
--     their bills.
--  2. Changing a vendor's bank routing or account number resets ACH to
--     'pending' (clears verification/activation and auto-pay), so money can't
--     go to new bank details nobody verified.
--  3. Void reversals are dated in the association's local day, not UTC.
--  4. The check run's check-number guard also checks payable_checks.
-- Every function below is the live definition with a minimal change.

-- 1a. Check-writing queue: skip vendors on hold (same columns, same order).
create or replace view public.v_check_writing_queue
with (security_invoker = true) as
 SELECT pb.id AS bill_id,
    pb.portfolio_id,
    pb.vendor_id,
    v.name AS vendor_name,
    v.address_street,
    v.address_city,
    v.address_state,
    v.address_zip,
    pb.association_id,
    a.name AS association_name,
    (pb.amount - pb.credit_applied)::numeric(14,2) AS amount,
    pb.bill_date,
    pb.due_date,
    pb.memo,
    pb.gl_account_id,
    pb.bank_account_id,
    CURRENT_DATE - pb.due_date AS days_past_due,
    pb.amount AS bill_amount,
    pb.credit_applied
   FROM payable_bills pb
     JOIN vendors v ON v.id = pb.vendor_id
     LEFT JOIN associations a ON a.id = pb.association_id
  WHERE pb.archived_at IS NULL AND pb.status = 'approved'::payable_bill_status AND pb.paid_at IS NULL AND v.payment_type = 'check'::vendor_payment_type AND NOT v.is_auto_pay
    AND NOT v.hold_payments
  ORDER BY pb.due_date, v.name;

-- 1b + 4. Check run: refuse held vendors; check numbers already on a
-- payable_checks row of this bank account are rejected with a clear message.
CREATE OR REPLACE FUNCTION public.record_check_run_legacy(p_bank_account_id uuid, p_bill_ids uuid[], p_starting_check_number integer, p_payment_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    if bill_row.amount - coalesce(bill_row.credit_applied, 0) <= 0 then raise exception 'Bill % has a non-positive amount', bill_id; end if;
    if exists (select 1 from public.vendors v where v.id = bill_row.vendor_id and v.hold_payments) then
      raise exception 'Payments to % are on hold. Clear "Hold payments" on the vendor first.',
        coalesce((select v.name from public.vendors v where v.id = bill_row.vendor_id), 'this vendor') using errcode = '22023';
    end if;
    if exists (select 1 from public.journal_entries where source_type = 'check_payment' and source_id = bill_id) then raise exception 'Bill % already has a check-payment ledger entry', bill_id; end if;
    perform public.ensure_payable_bill_accrual(bill_id);
  end loop;
  if exists (select 1 from public.payable_bills where bank_account_id = p_bank_account_id and check_number between p_starting_check_number and p_starting_check_number + cardinality(p_bill_ids) - 1)
     or exists (select 1 from public.payable_checks pc where pc.bank_account_id = p_bank_account_id and pc.check_number between p_starting_check_number and p_starting_check_number + cardinality(p_bill_ids) - 1) then
    raise exception 'Check number already used: one or more of checks #% to #% were already written from this bank account. Choose a different starting check number.',
      p_starting_check_number, p_starting_check_number + cardinality(p_bill_ids) - 1 using errcode = '22023';
  end if;

  foreach bill_id in array p_bill_ids loop
    select * into bill_row from public.payable_bills where id = bill_id;
    select jl.gl_account_id into ap_account_id from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
     where je.source_type = 'payable_bill' and je.source_id = bill_id and je.posted and jl.credit_amount > 0
     order by je.created_at desc limit 1;
    ap_account_id := coalesce(ap_account_id, public.app_ap_account(bill_row.portfolio_id, bill_row.association_id));

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
      (payment_entry_id, bill_row.association_id, ap_account_id, bill_row.amount - coalesce(bill_row.credit_applied, 0), 0, bill_row.memo, 1),
      (payment_entry_id, bill_row.association_id, bank_row.gl_account_id, 0, bill_row.amount - coalesce(bill_row.credit_applied, 0), bill_row.memo, 2);

    update public.payable_bills set status = 'paid'::public.payable_bill_status, paid_at = (p_payment_date::timestamp + interval '12 hours') at time zone 'UTC',
      bank_account_id = p_bank_account_id, check_number = p_starting_check_number + idx, updated_at = now() where id = bill_id;
    results := results || jsonb_build_object('bill_id', bill_id, 'check_number', p_starting_check_number + idx, 'journal_entry_id', payment_entry_id);
    idx := idx + 1;
  end loop;
  update public.bank_accounts set next_check_number = p_starting_check_number + idx, updated_at = now() where id = p_bank_account_id;
  return jsonb_build_object('checks_written', idx, 'starting_check_number', p_starting_check_number,
    'next_check_number', p_starting_check_number + idx, 'results', results);
end;
$function$;

-- 1c. eCheck / ACH / online payments: refuse held vendors.
CREATE OR REPLACE FUNCTION public.record_bill_payment(p_bank_account_id uuid, p_bill_ids uuid[], p_payment_date date, p_reference text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_bank public.bank_accounts;
  v_bill public.payable_bills;
  v_vendor public.vendors;
  v_id uuid;
  v_ap uuid;
  v_entry uuid;
  v_check uuid;
  v_amount numeric;
  v_method text;
  v_label text;
  n integer := 0;
begin
  if p_bank_account_id is null or coalesce(cardinality(p_bill_ids), 0) = 0 then
    raise exception 'Choose a bank account and at least one bill' using errcode = '22023';
  end if;
  if p_payment_date is null then raise exception 'Choose the payment date' using errcode = '22023'; end if;
  select * into v_bank from public.bank_accounts where id = p_bank_account_id and archived_at is null for update;
  if not found or not public.can_manage_finance(v_bank.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if v_bank.gl_account_id is null then raise exception 'The bank account has no cash GL account' using errcode = '22023'; end if;
  if (select count(distinct x) from unnest(p_bill_ids) x) <> cardinality(p_bill_ids) then
    raise exception 'A bill is selected twice' using errcode = '22023';
  end if;

  foreach v_id in array p_bill_ids loop
    select * into v_bill from public.payable_bills where id = v_id for update;
    if not found or v_bill.portfolio_id is distinct from v_bank.portfolio_id then raise exception 'Bill not found' using errcode = 'P0002'; end if;
    if v_bank.association_id is not null and v_bill.association_id is distinct from v_bank.association_id then
      raise exception 'Bill % is not in the bank account''s association', coalesce(v_bill.bill_number, v_id::text) using errcode = '22023';
    end if;
    if v_bill.status <> 'approved' or v_bill.paid_at is not null or v_bill.archived_at is not null then
      raise exception 'Bill % is not approved and unpaid', coalesce(v_bill.bill_number, v_id::text) using errcode = '22023';
    end if;
    select * into v_vendor from public.vendors where id = v_bill.vendor_id;
    if coalesce(v_vendor.hold_payments, false) then
      raise exception 'Payments to % are on hold. Clear "Hold payments" on the vendor first.', coalesce(v_vendor.name, 'this vendor') using errcode = '22023';
    end if;
    if v_vendor.payment_type::text = 'check' and not coalesce(v_vendor.is_auto_pay, false) then
      raise exception '% is paid by check; pay this bill in the check run', v_vendor.name using errcode = '22023';
    end if;
    v_method := case when v_vendor.payment_type::text = 'check' then 'online' else v_vendor.payment_type::text end;
    v_label := case v_method when 'echeck' then 'eCheck' when 'ach' then 'ACH' else 'Online payment' end;
    v_amount := v_bill.amount - coalesce(v_bill.credit_applied, 0);
    if v_amount <= 0 then raise exception 'Bill % has nothing left to pay', coalesce(v_bill.bill_number, v_id::text) using errcode = '22023'; end if;

    perform public.ensure_payable_bill_accrual(v_id);
    -- Pay from the A/P account the accrual credited.
    select jl.gl_account_id into v_ap from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
     where je.source_type = 'payable_bill' and je.source_id = v_id and jl.credit_amount > 0 limit 1;

    insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted, posted_at)
    values (v_bill.portfolio_id, p_payment_date, v_label || ': ' || coalesce(v_bill.bill_number, v_vendor.name), v_bill.memo,
            nullif(btrim(coalesce(p_reference, '')), ''), 'check_payment', v_id, auth.uid(), true, now())
    returning id into v_entry;
    insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
    values (v_entry, v_bill.association_id, v_ap, v_amount, 0, v_bill.memo, 1),
           (v_entry, v_bill.association_id, v_bank.gl_account_id, 0, v_amount, v_bill.memo, 2);

    insert into public.payable_checks (portfolio_id, association_id, bill_id, vendor_id, bank_account_id, check_number, amount,
                                       payment_date, payment_entry_id, issued_by, payment_method, reference)
    values (v_bill.portfolio_id, v_bill.association_id, v_id, v_bill.vendor_id, v_bank.id, null, v_amount,
            p_payment_date, v_entry, auth.uid(), v_method, nullif(btrim(coalesce(p_reference, '')), ''))
    returning id into v_check;
    -- Payment entries belong to the payment record, as for printed checks.
    update public.journal_entries set source_id = v_check where id = v_entry;
    update public.payable_bills set status = 'paid', paid_at = (p_payment_date::timestamp + interval '12 hours') at time zone 'UTC', bank_account_id = v_bank.id,
           check_number = null, updated_at = now()
     where id = v_id;
    n := n + 1;
  end loop;
  return n;
end $function$;

-- 2a. Bank details changed through vendor_financial_details (the vendor edit
-- form upserts this table directly): reset ACH approval.
CREATE OR REPLACE FUNCTION public.vendor_financial_details_sync_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v uuid := coalesce(new.vendor_id, old.vendor_id);
  -- Routing or account number differs from what was stored (a first insert or
  -- a delete counts as a change against nothing).
  v_bank_changed boolean :=
    (case when tg_op = 'INSERT' then null else old.bank_routing_number end)
      is distinct from (case when tg_op = 'DELETE' then null else new.bank_routing_number end)
    or (case when tg_op = 'INSERT' then null else old.bank_account_number end)
      is distinct from (case when tg_op = 'DELETE' then null else new.bank_account_number end);
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  update public.vendors
     set has_taxpayer_id = coalesce(tg_op <> 'DELETE' and nullif(btrim(new.taxpayer_id), '') is not null, false),
         has_bank_account = coalesce(tg_op <> 'DELETE' and nullif(btrim(new.bank_routing_number), '') is not null
                                     and nullif(btrim(new.bank_account_number), '') is not null, false)
   where id = v;
  -- New bank details must be verified again before ACH or auto-pay uses them.
  if v_bank_changed then
    update public.vendors
       set ach_status = 'pending', ach_verified_at = null, ach_verified_by = null,
           ach_activated_at = null, ach_activated_by = null, is_auto_pay = false
     where id = v
       and (ach_status <> 'pending' or ach_verified_at is not null or ach_verified_by is not null
            or ach_activated_at is not null or ach_activated_by is not null or is_auto_pay);
  end if;
  return null;
end $function$;

-- 2b. Bank details written through the legacy vendors columns are moved to
-- the private table by this BEFORE trigger (the flag trigger above is skipped
-- at that depth), so reset ACH approval here as well.
CREATE OR REPLACE FUNCTION public.vendors_move_financials_to_private()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  f jsonb := '{}'::jsonb;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    -- New vendors start with no flags; the AFTER INSERT pass sets them from
    -- whatever tax/bank values were supplied.
    new.has_taxpayer_id := false;
    new.has_bank_account := false;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.taxpayer_id is distinct from old.taxpayer_id and new.taxpayer_id is not null then f := f || jsonb_build_object('taxpayer_id', new.taxpayer_id); end if;
    if new.tax_account_number is distinct from old.tax_account_number and new.tax_account_number is not null then f := f || jsonb_build_object('tax_account_number', new.tax_account_number); end if;
    if new.bank_routing_number is distinct from old.bank_routing_number and new.bank_routing_number is not null then f := f || jsonb_build_object('bank_routing_number', new.bank_routing_number); end if;
    if new.bank_account_number is distinct from old.bank_account_number and new.bank_account_number is not null then f := f || jsonb_build_object('bank_account_number', new.bank_account_number); end if;
    if f <> '{}'::jsonb then
      insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number, updated_by)
      values (new.id, new.portfolio_id, f ->> 'taxpayer_id', f ->> 'tax_account_number', f ->> 'bank_routing_number', f ->> 'bank_account_number', auth.uid())
      on conflict (vendor_id) do update set
        taxpayer_id         = case when f ? 'taxpayer_id' then excluded.taxpayer_id else vendor_financial_details.taxpayer_id end,
        tax_account_number  = case when f ? 'tax_account_number' then excluded.tax_account_number else vendor_financial_details.tax_account_number end,
        bank_routing_number = case when f ? 'bank_routing_number' then excluded.bank_routing_number else vendor_financial_details.bank_routing_number end,
        bank_account_number = case when f ? 'bank_account_number' then excluded.bank_account_number else vendor_financial_details.bank_account_number end,
        updated_at = now(), updated_by = excluded.updated_by;
    end if;
    -- New bank details must be verified again before ACH or auto-pay uses them.
    if f ? 'bank_routing_number' or f ? 'bank_account_number' then
      new.ach_status := 'pending';
      new.ach_verified_at := null; new.ach_verified_by := null;
      new.ach_activated_at := null; new.ach_activated_by := null;
      new.is_auto_pay := false;
    end if;
    new.taxpayer_id := null; new.tax_account_number := null;
    new.bank_routing_number := null; new.bank_account_number := null;
    -- Flags are always derived from the private row (never trusted from the
    -- caller), and set here because the private table's flag trigger can't
    -- update the row this BEFORE trigger is already modifying.
    new.has_taxpayer_id := coalesce((select nullif(btrim(d.taxpayer_id), '') is not null
                                       from public.vendor_financial_details d where d.vendor_id = new.id), false);
    new.has_bank_account := coalesce((select nullif(btrim(d.bank_routing_number), '') is not null
                                             and nullif(btrim(d.bank_account_number), '') is not null
                                        from public.vendor_financial_details d where d.vendor_id = new.id), false);
    return new;
  end if;
  -- AFTER INSERT: the vendor row exists now, so the private row can reference it.
  if new.taxpayer_id is not null or new.tax_account_number is not null
     or new.bank_routing_number is not null or new.bank_account_number is not null then
    insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number, updated_by)
    values (new.id, new.portfolio_id, new.taxpayer_id, new.tax_account_number, new.bank_routing_number, new.bank_account_number, auth.uid())
    on conflict (vendor_id) do nothing;
    update public.vendors
       set taxpayer_id = null, tax_account_number = null, bank_routing_number = null, bank_account_number = null,
           has_taxpayer_id = nullif(btrim(coalesce(new.taxpayer_id, '')), '') is not null,
           has_bank_account = nullif(btrim(coalesce(new.bank_routing_number, '')), '') is not null
                              and nullif(btrim(coalesce(new.bank_account_number, '')), '') is not null
     where id = new.id;
  end if;
  return null;
end $function$;

-- 3a. Void bill: reversal dated in the association's local day.
CREATE OR REPLACE FUNCTION public.void_payable_bill(p_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  bill_row public.payable_bills;
  accrual_id uuid;
  reversal_id uuid;
  line record;
begin
  if exists (select 1 from public.payable_bills where id = p_bill_id and credit_applied > 0) then
    raise exception 'A vendor credit is applied to this bill — it can''t be voided' using errcode = '22023';
  end if;
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
      bill_row.portfolio_id, coalesce(public.association_local_date(bill_row.association_id, now()), current_date),
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
$function$;

-- 3b. Void / stop payment on a check: reversal dated in the association's local day.
CREATE OR REPLACE FUNCTION public.void_payable_check(p_check_id uuid, p_reason text, p_stop_payment boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  check_row public.payable_checks;
  bill_row public.payable_bills;
  reversal_id uuid;
  line record;
  v_label text;
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

  v_label := case when check_row.check_number is not null then 'check #' || check_row.check_number::text
                  else 'payment' || coalesce(' ' || check_row.reference, '') end;
  insert into public.journal_entries (
    portfolio_id, entry_date, description, memo, reference_number,
    source_type, source_id, created_by, posted, posted_at
  ) values (
    check_row.portfolio_id, coalesce(public.association_local_date(coalesce(check_row.association_id, bill_row.association_id), now()), current_date),
    case when p_stop_payment then 'Stop payment ' else 'Void ' end || v_label,
    trim(p_reason), coalesce(check_row.check_number::text, check_row.reference),
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
$function$;

-- 3c. Owner payable reversals: dated in the association's local day.
CREATE OR REPLACE FUNCTION public.app_reverse_owner_payable_entry(r owner_payables, p_source text, p_reversal_source text, p_label text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_orig uuid;
  v_rev uuid;
  l record;
begin
  select id into v_orig from public.journal_entries where source_type = p_source and source_id = r.id order by created_at desc limit 1;
  if v_orig is null then return null; end if;
  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted, posted_at)
  values (r.portfolio_id, coalesce(public.association_local_date(r.association_id, now()), current_date), p_label, r.memo, r.payable_number, p_reversal_source, r.id, auth.uid(), true, now())
  returning id into v_rev;
  for l in select * from public.journal_lines where entry_id = v_orig order by sort_order loop
    insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
    values (v_rev, l.association_id, l.gl_account_id, l.credit_amount, l.debit_amount, 'Reversal: ' || coalesce(l.memo, ''), l.sort_order);
  end loop;
  return v_rev;
end $function$;
