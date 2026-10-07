-- void_payable_bill, approve_payable_bill and request_payable_bill_approval
-- are SECURITY DEFINER, so they skip payable_bills' restrictive RLS policies:
--   mgr_assoc_scope              can_view_association_row(association_id)
--   operator_writes_need_admin_* operator_may_write(false)
-- and only checked can_manage_finance(portfolio_id). A finance user scoped to
-- some associations could void, approve or submit a bill in any association
-- of the company (void also posts the reversing journal entry), and a
-- support-only platform operator could change bills. Each function now applies
-- the same two checks as RLS; out-of-scope bills read as "Bill not found".
-- void_payable_bill checked credit_applied before any permission check,
-- which let any caller probe for bill ids; it now runs after them.
-- Bodies are otherwise the live definitions (read from production with
-- pg_get_functiondef). Em dashes are written as chr(8212).
-- Signatures, owners and grants are unchanged (CREATE OR REPLACE).
-- Additive only: no DROP, no DELETE.

create or replace function public.void_payable_bill(p_bill_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  bill_row public.payable_bills;
  accrual_id uuid;
  reversal_id uuid;
  line record;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if not public.can_view_association_row(bill_row.association_id) then raise exception 'Bill not found'; end if;
  if not public.operator_may_write(false) then raise exception 'Permission denied'; end if;
  if coalesce(bill_row.credit_applied, 0) > 0 then
    raise exception '%', 'A vendor credit is applied to this bill ' || chr(8212) || ' it can''t be voided' using errcode = '22023';
  end if;
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

create or replace function public.approve_payable_bill(p_bill_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  entry_id uuid;
  bill_row public.payable_bills;
  request_status public.approval_request_status;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if not public.can_view_association_row(bill_row.association_id) then raise exception 'Bill not found'; end if;
  if not public.operator_may_write(false) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('pending_approval'::public.payable_bill_status, 'approved'::public.payable_bill_status) then
    raise exception 'Only submitted, unpaid bills can be approved';
  end if;
  if bill_row.approval_required then
    if bill_row.approval_request_id is null then raise exception 'Board approval has not been requested'; end if;
    select status into request_status from public.approval_requests
     where id = bill_row.approval_request_id
       and portfolio_id = bill_row.portfolio_id
       and association_id = bill_row.association_id;
    if request_status is distinct from 'approved'::public.approval_request_status then
      raise exception 'Board approval is not complete';
    end if;
  end if;
  update public.payable_bills
     set status = 'approved'::public.payable_bill_status,
         approved_at = coalesce(approved_at, now()),
         approved_by = coalesce(approved_by, auth.uid()),
         updated_at = now()
   where id = p_bill_id;
  entry_id := public.ensure_payable_bill_accrual(p_bill_id);
  return entry_id;
end;
$function$;

create or replace function public.request_payable_bill_approval(p_bill_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  bill_row public.payable_bills;
  settings_row public.board_approval_settings;
  member_ids uuid[];
  member_count integer;
  required_count integer;
  request_id uuid;
  vendor_name text;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if not public.can_view_association_row(bill_row.association_id) then raise exception 'Bill not found'; end if;
  if not public.operator_may_write(false) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status) then
    raise exception 'Only draft or pending bills can be submitted for approval';
  end if;
  if bill_row.approval_request_id is not null then return bill_row.approval_request_id; end if;

  if not bill_row.approval_required then
    update public.payable_bills
       set status = 'pending_approval'::public.payable_bill_status, updated_at = now()
     where id = p_bill_id;
    return null;
  end if;
  if bill_row.association_id is null then
    raise exception 'Board-approved bills require an association';
  end if;

  select * into settings_row from public.board_approval_settings
   where association_id = bill_row.association_id;
  select coalesce(array_agg(bm.id order by bm.id), '{}'::uuid[])
    into member_ids
    from public.board_members bm
   where bm.association_id = bill_row.association_id
     and bm.active
     and (
       coalesce(cardinality(settings_row.default_board_member_ids), 0) = 0
       or bm.id = any(settings_row.default_board_member_ids)
     );
  member_count := coalesce(cardinality(member_ids), 0);
  if member_count = 0 then raise exception 'No active board approvers are configured'; end if;

  settings_row.default_voting_scheme := coalesce(settings_row.default_voting_scheme, 'majority_approval_required'::public.voting_scheme);
  settings_row.signatures_required := coalesce(settings_row.signatures_required, true);
  required_count := case settings_row.default_voting_scheme
    when 'any_one_approver'::public.voting_scheme then 1
    when 'unanimous_approval_required'::public.voting_scheme then member_count
    when 'percentage_required'::public.voting_scheme then greatest(1, ceil(member_count * coalesce(settings_row.default_percentage_required, 100) / 100.0)::integer)
    else floor(member_count / 2.0)::integer + 1
  end;
  select name into vendor_name from public.vendors where id = bill_row.vendor_id;

  insert into public.approval_requests (
    portfolio_id, association_id, vendor_id, request_type, title, description,
    requested_by_name, requested_by_email, amount, due_date, status,
    voting_scheme, required_votes, signatures_required, board_member_ids,
    percentage_required, requested_at
  ) values (
    bill_row.portfolio_id, bill_row.association_id, bill_row.vendor_id, 'expense',
    'Bill ' || coalesce(nullif(trim(bill_row.bill_number), ''), left(bill_row.id::text, 8)) || ' ' || chr(8212) || ' ' || coalesce(vendor_name, 'Vendor'),
    bill_row.memo, coalesce((select full_name from public.profiles where id = auth.uid()), 'Management staff'),
    (select email from auth.users where id = auth.uid()), bill_row.amount, bill_row.due_date, 'pending',
    settings_row.default_voting_scheme, required_count, settings_row.signatures_required,
    member_ids, settings_row.default_percentage_required, now()
  ) returning id into request_id;

  update public.payable_bills
     set status = 'pending_approval'::public.payable_bill_status,
         approval_request_id = request_id,
         updated_at = now()
   where id = p_bill_id;
  return request_id;
end;
$function$;
