-- Payables audit fixes.
-- 1. Homeowner payables: managers could not see or create them (the read policy
--    needed a JWT claim that is never issued), and approving, paying and voiding
--    were raw status updates that posted nothing to the ledger. They now go
--    through RPCs that check scope and status and post the same way bills do:
--    approval accrues (Dr chosen account, Cr A/P), payment clears it
--    (Dr A/P, Cr cash), voids post reversing entries.
-- 2. Bills for vendors paid by eCheck, ACH, online or auto-pay could never be
--    paid: only the check run marked bills paid. record_bill_payment records
--    those payments (one payable_checks row per bill, no check number) so the
--    check register, bill page and void flow treat them like checks.
-- 3. Bill RPCs are SECURITY DEFINER and skipped the association scope of
--    managers limited to some associations. A trigger now enforces it on every
--    bill and payment write.
-- 4. A voided management-fee bill kept its month marked as billed forever.

-- ── 1. Homeowner payables ─────────────────────────────────────
alter policy owner_payables_select on public.owner_payables
  using ((public.is_any_staff() and public.can_access_portfolio(portfolio_id)) or public.is_platform_operator());

-- Writes go through the RPCs below only.
revoke all on public.owner_payables from anon, authenticated;
grant select on public.owner_payables to authenticated;

create or replace function public.create_owner_payable(
  p_association_id uuid, p_owner_id uuid, p_gl_account_id uuid, p_bank_account_id uuid,
  p_payable_type text, p_payable_date date, p_due_date date, p_amount numeric, p_memo text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_id uuid;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_association_id is null or not exists (select 1 from public.associations a where a.id = p_association_id and a.portfolio_id = v_pid)
     or not public.can_manage_association(p_association_id) then
    raise exception 'Choose an association' using errcode = '22023';
  end if;
  if not exists (select 1 from public.owners o
                   join public.unit_owners uo on uo.owner_id = o.id
                   join public.units u on u.id = uo.unit_id
                   join public.buildings b on b.id = u.building_id
                  where o.id = p_owner_id and o.portfolio_id = v_pid and b.association_id = p_association_id) then
    raise exception 'Choose a homeowner of this association' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero' using errcode = '22023'; end if;
  if p_payable_type not in ('refund', 'settlement', 'distribution', 'other') then
    raise exception 'Choose a payable type' using errcode = '22023';
  end if;
  if p_gl_account_id is not null and not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid
             and g.active and (g.association_id is null or g.association_id = p_association_id)) then
    raise exception 'GL account does not belong to this association' using errcode = '22023';
  end if;
  if p_bank_account_id is not null and not exists (select 1 from public.bank_accounts b where b.id = p_bank_account_id and b.portfolio_id = v_pid
             and b.archived_at is null and (b.association_id is null or b.association_id = p_association_id)) then
    raise exception 'Bank account does not belong to this association' using errcode = '22023';
  end if;

  insert into public.owner_payables (portfolio_id, association_id, owner_id, gl_account_id, bank_account_id,
    payable_type, payable_date, due_date, amount, memo, status, created_by)
  values (v_pid, p_association_id, p_owner_id, p_gl_account_id, p_bank_account_id,
    p_payable_type::public.owner_payable_type, coalesce(p_payable_date, current_date), p_due_date, round(p_amount, 2),
    nullif(btrim(coalesce(p_memo, '')), ''), 'pending_approval', auth.uid())
  returning id into v_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_pid, 'owner_payable', v_id, 'created', auth.uid(), jsonb_build_object('amount', round(p_amount, 2), 'type', p_payable_type));
  return v_id;
end $$;

-- Locks the payable and checks the caller may act on it.
create or replace function public.app_owner_payable_for_update(p_id uuid)
returns public.owner_payables language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare r public.owner_payables;
begin
  select * into r from public.owner_payables where id = p_id and archived_at is null for update;
  if not found or not public.can_manage_finance(r.portfolio_id) or not public.can_manage_association(r.association_id) then
    raise exception 'Homeowner payable not found' using errcode = 'P0002';
  end if;
  return r;
end $$;
revoke all on function public.app_owner_payable_for_update(uuid) from public, anon, authenticated;

create or replace function public.approve_owner_payable(p_id uuid)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  r public.owner_payables := public.app_owner_payable_for_update(p_id);
  v_ap uuid;
  v_entry uuid;
  v_owner text := (select full_name from public.owners where id = r.owner_id);
begin
  if r.status not in ('draft', 'pending_approval') then
    raise exception 'Only a payable waiting for approval can be approved' using errcode = '22023';
  end if;
  if r.gl_account_id is null then raise exception 'Choose the GL account this payable is charged to before approving' using errcode = '22023'; end if;
  v_ap := public.app_ap_account(r.portfolio_id, r.association_id);
  if v_ap is null then raise exception 'No active Accounts Payable GL account is configured' using errcode = '22023'; end if;

  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted, posted_at)
  values (r.portfolio_id, coalesce(r.payable_date, current_date), 'Homeowner payable: ' || coalesce(v_owner, 'homeowner'), r.memo,
          r.payable_number, 'owner_payable', r.id, auth.uid(), true, now())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, r.association_id, r.gl_account_id, r.amount, 0, r.memo, 1),
         (v_entry, r.association_id, v_ap, 0, r.amount, r.memo, 2);

  update public.owner_payables set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now() where id = r.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (r.portfolio_id, 'owner_payable', r.id, 'approved', auth.uid(), jsonb_build_object('amount', r.amount));
  return v_entry;
end $$;

create or replace function public.pay_owner_payable(p_id uuid, p_bank_account_id uuid, p_payment_date date, p_method text, p_reference text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  r public.owner_payables := public.app_owner_payable_for_update(p_id);
  v_bank public.bank_accounts;
  v_ap uuid;
  v_entry uuid;
  v_owner text := (select full_name from public.owners where id = r.owner_id);
begin
  if r.status <> 'approved' or r.paid_at is not null then
    raise exception 'Only an approved, unpaid payable can be paid' using errcode = '22023';
  end if;
  if coalesce(p_method, '') not in ('check', 'echeck', 'ach', 'cash', 'other') then
    raise exception 'Choose how it was paid' using errcode = '22023';
  end if;
  if p_payment_date is null then raise exception 'Choose the payment date' using errcode = '22023'; end if;
  if exists (select 1 from public.owner_financial_details f where f.owner_id = r.owner_id and f.hold_payments) then
    raise exception 'Payments to % are on hold. Clear "Hold payments" on the homeowner first.', coalesce(v_owner, 'this homeowner') using errcode = '22023';
  end if;
  select * into v_bank from public.bank_accounts b
   where b.id = coalesce(p_bank_account_id, r.bank_account_id) and b.portfolio_id = r.portfolio_id and b.archived_at is null
     and (b.association_id is null or b.association_id = r.association_id);
  if not found then raise exception 'Choose a bank account of this association' using errcode = '22023'; end if;
  if v_bank.gl_account_id is null then raise exception 'The bank account has no cash GL account' using errcode = '22023'; end if;
  -- Pay from the same A/P account the approval credited.
  select jl.gl_account_id into v_ap from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
   where je.source_type = 'owner_payable' and je.source_id = r.id and jl.credit_amount > 0 limit 1;
  if v_ap is null then raise exception 'This payable was never posted to the ledger; void it and enter it again' using errcode = '22023'; end if;

  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted, posted_at)
  values (r.portfolio_id, p_payment_date, 'Homeowner payment: ' || coalesce(v_owner, 'homeowner'), r.memo,
          nullif(btrim(coalesce(p_reference, '')), ''), 'owner_payable_payment', r.id, auth.uid(), true, now())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, r.association_id, v_ap, r.amount, 0, r.memo, 1),
         (v_entry, r.association_id, v_bank.gl_account_id, 0, r.amount, r.memo, 2);

  update public.owner_payables set status = 'paid', paid_at = p_payment_date::timestamptz, bank_account_id = v_bank.id,
         payment_method = p_method, payment_reference = nullif(btrim(coalesce(p_reference, '')), ''), updated_at = now()
   where id = r.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (r.portfolio_id, 'owner_payable', r.id, 'paid', auth.uid(), jsonb_build_object('amount', r.amount, 'method', p_method, 'reference', p_reference));
  return v_entry;
end $$;

-- Reverses the latest entry of p_source for the payable.
create or replace function public.app_reverse_owner_payable_entry(r public.owner_payables, p_source text, p_reversal_source text, p_label text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_orig uuid;
  v_rev uuid;
  l record;
begin
  select id into v_orig from public.journal_entries where source_type = p_source and source_id = r.id order by created_at desc limit 1;
  if v_orig is null then return null; end if;
  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted, posted_at)
  values (r.portfolio_id, current_date, p_label, r.memo, r.payable_number, p_reversal_source, r.id, auth.uid(), true, now())
  returning id into v_rev;
  for l in select * from public.journal_lines where entry_id = v_orig order by sort_order loop
    insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
    values (v_rev, l.association_id, l.gl_account_id, l.credit_amount, l.debit_amount, 'Reversal: ' || coalesce(l.memo, ''), l.sort_order);
  end loop;
  return v_rev;
end $$;
revoke all on function public.app_reverse_owner_payable_entry(public.owner_payables, text, text, text) from public, anon, authenticated;

create or replace function public.void_owner_payable_payment(p_id uuid, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  r public.owner_payables := public.app_owner_payable_for_update(p_id);
  v_rev uuid;
begin
  if r.status <> 'paid' then raise exception 'This payable has not been paid' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for voiding the payment' using errcode = '22023'; end if;
  v_rev := public.app_reverse_owner_payable_entry(r, 'owner_payable_payment', 'owner_payable_payment_void', 'Void homeowner payment: ' || btrim(p_reason));
  update public.owner_payables set status = 'approved', paid_at = null, payment_method = null, payment_reference = null, updated_at = now() where id = r.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (r.portfolio_id, 'owner_payable', r.id, 'payment_voided', auth.uid(), jsonb_build_object('reason', btrim(p_reason)));
  return v_rev;
end $$;

create or replace function public.void_owner_payable(p_id uuid)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  r public.owner_payables := public.app_owner_payable_for_update(p_id);
  v_rev uuid;
begin
  if r.status = 'paid' then raise exception 'Void the payment first' using errcode = '22023'; end if;
  if r.status = 'void' then return null; end if;
  if r.status = 'approved' then
    v_rev := public.app_reverse_owner_payable_entry(r, 'owner_payable', 'owner_payable_void', 'Void homeowner payable');
  end if;
  update public.owner_payables set status = 'void', updated_at = now() where id = r.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (r.portfolio_id, 'owner_payable', r.id, 'voided', auth.uid(), '{}'::jsonb);
  return v_rev;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_owner_payable(uuid, uuid, uuid, uuid, text, date, date, numeric, text)',
    'public.approve_owner_payable(uuid)',
    'public.pay_owner_payable(uuid, uuid, date, text, text)',
    'public.void_owner_payable_payment(uuid, text)',
    'public.void_owner_payable(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ── 2. Bill payments other than printed checks ──────────────────
alter table public.payable_checks add column if not exists payment_method text not null default 'check';
alter table public.payable_checks add column if not exists reference text;
alter table public.payable_checks alter column check_number drop not null;
alter table public.payable_checks add constraint payable_checks_method_chk
  check (payment_method in ('check', 'echeck', 'ach', 'online') and (payment_method <> 'check' or check_number is not null));

create or replace function public.record_bill_payment(
  p_bank_account_id uuid, p_bill_ids uuid[], p_payment_date date, p_reference text)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
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
    update public.payable_bills set status = 'paid', paid_at = p_payment_date::timestamptz, bank_account_id = v_bank.id,
           check_number = null, updated_at = now()
     where id = v_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.record_bill_payment(uuid, uuid[], date, text) from public, anon;
grant execute on function public.record_bill_payment(uuid, uuid[], date, text) to authenticated;

-- Voiding works for any recorded payment; the label no longer assumes a check number.
create or replace function public.void_payable_check(p_check_id uuid, p_reason text, p_stop_payment boolean DEFAULT false)
returns uuid language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
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
    check_row.portfolio_id, current_date,
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

-- ── 3. Association scope on bill and payment writes ─────────────
-- The bill RPCs run as the definer, so the restrictive mgr_assoc_scope policy
-- never applied to them. This trigger applies the same rule to the caller.
create or replace function public.enforce_payable_association_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then return new; end if;  -- scheduled jobs
  if (new.association_id is not null and not public.can_view_association_row(new.association_id))
     or (tg_op = 'UPDATE' and old.association_id is not null and not public.can_view_association_row(old.association_id)) then
    raise exception 'You do not manage this association' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.enforce_payable_association_scope() from public, anon, authenticated;

create or replace trigger payable_bills_association_scope before insert or update on public.payable_bills
  for each row execute function public.enforce_payable_association_scope();
create or replace trigger payable_checks_association_scope before insert or update on public.payable_checks
  for each row execute function public.enforce_payable_association_scope();

-- ── 4. Management fees: a voided fee bill frees its month ───────
do $$
declare def text;
begin
  def := pg_get_functiondef('public.app_management_fee_calc(uuid, date)'::regprocedure);
  if position('left join public.management_fees mf on mf.association_id = a.id and mf.month = m.start_d' in def) = 0 then
    raise exception 'payables_audit_fixes: app_management_fee_calc drifted';
  end if;
  def := replace(def, 'left join public.management_fees mf on mf.association_id = a.id and mf.month = m.start_d',
    'left join public.management_fees mf on mf.association_id = a.id and mf.month = m.start_d' || chr(10) ||
    '       and exists (select 1 from public.payable_bills vb where vb.id = mf.bill_id and vb.status <> ''void''::public.payable_bill_status)');
  execute def;

  def := pg_get_functiondef('public.app_bill_management_fees(uuid, date, uuid[], uuid, uuid, date, uuid, text)'::regprocedure);
  if position('where public.management_fees.bill_id is null;' in def) = 0 then
    raise exception 'payables_audit_fixes: app_bill_management_fees drifted';
  end if;
  def := replace(def, 'where public.management_fees.bill_id is null;',
    'where public.management_fees.bill_id is null' || chr(10) ||
    '         or exists (select 1 from public.payable_bills vb where vb.id = public.management_fees.bill_id and vb.status = ''void''::public.payable_bill_status);');
  execute def;
end $$;

-- ── 5. Homeowner payables: owners come from unit_owners ─────────
-- The integrity trigger accepted only owners with an occupancy row; homeowners
-- are recorded in unit_owners, so it rejected real homeowners.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.validate_owner_payable_tenant_scope()'::regprocedure);
  if position('public.unit_owners uo' in def) > 0 then return; end if;
  if position('select 1 from public.occupancies o' in def) = 0 then
    raise exception 'payables_audit_fixes: validate_owner_payable_tenant_scope drifted';
  end if;
  def := replace(def, E'select 1 from public.occupancies o\r\n    where o.owner_id = new.owner_id\r\n      and o.association_id = new.association_id\r\n  )',
    E'select 1 from public.occupancies o\r\n    where o.owner_id = new.owner_id\r\n      and o.association_id = new.association_id\r\n  ) and not exists (\r\n    select 1 from public.unit_owners uo\r\n      join public.units u on u.id = uo.unit_id\r\n      join public.buildings b on b.id = u.building_id\r\n     where uo.owner_id = new.owner_id and b.association_id = new.association_id\r\n  )');
  if position('public.unit_owners uo' in def) = 0 then
    raise exception 'payables_audit_fixes: owner scope replacement did not apply';
  end if;
  execute def;
end $$;
