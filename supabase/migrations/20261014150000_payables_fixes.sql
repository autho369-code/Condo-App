-- Payables deep check (2026-10-13), rolled back on production at 10,000 bills.
--
-- 1. Invoices vendors send from their portal could never be approved or
--    paid: submit_vendor_invoice always required board approval and left the
--    expense account empty, and nothing could set it later (approving failed
--    with "Bill requires an association and expense GL account"). The bill
--    now follows the association's board-approval setting like a bill staff
--    enter, and finance staff set the expense account on a draft or pending
--    bill (set_payable_bill_expense_account, under their own GL account
--    permissions; a vendor never picks the account).
-- 2. Board approval had no working path: the board portal is read-only and
--    votes can't be cast, so a bill needing the board waited forever, while
--    any finance user could mark the request approved with a plain UPDATE.
--    Staff now record the board's decision with record_approval_decision
--    (who recorded it, when, and a note, kept in approval_decisions), and a
--    request can only become approved through it (or a repair session).
-- 3. Manual bill entry accepted the same vendor invoice number twice (both
--    could be paid); create_payable_bill now refuses it like import and the
--    vendor portal (same lock key).
-- 4. Payments accepted any date (10 years ahead, or before the bill); the
--    date must now be on or after the bill date and at most 90 days ahead.
-- 5. The 1099 report-builder data left out vendors archived after they were
--    paid; the 1099 page already counted them.
-- 6. Voiding a payment no longer clears the bill's bank account.

-- 2. Approval requests become approved only through a recorded decision.
create or replace function public.approval_requests_approve_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.status = 'approved'::public.approval_request_status
     and (tg_op = 'INSERT' or old.status is distinct from 'approved'::public.approval_request_status)
     and coalesce(current_setting('app.approval_decision', true), '') <> 'on'
     and not public.app_is_repair_session() then
    raise exception 'Record the board''s decision on the approval request to approve it' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.approval_requests_approve_guard() from public, anon, authenticated;

create or replace trigger trg_approval_requests_approve_guard
  before insert or update of status on public.approval_requests
  for each row execute function public.approval_requests_approve_guard();

create or replace function public.record_approval_decision(p_request_id uuid, p_decision text, p_note text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  r public.approval_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text;
  v_money boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approved or rejected' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'The note must be 1,000 characters or fewer' using errcode = '22023';
  end if;

  select * into r from public.approval_requests where id = p_request_id for update;
  if not found or r.archived_at is not null then
    raise exception 'Approval request not found' using errcode = 'P0002';
  end if;

  -- A request behind a bill or purchase order is a money decision.
  v_money := exists (select 1 from public.payable_bills b where b.approval_request_id = r.id)
          or exists (select 1 from public.purchase_orders po where po.approval_request_id = r.id);
  if not public.operator_may_write(false)
     or not (case when v_money
                  then public.can_manage_finance(r.portfolio_id) and public.can_view_association_row(r.association_id)
                  else public.can_edit_association_mvp(r.association_id) end) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if r.status is distinct from 'pending'::public.approval_request_status then
    raise exception 'This approval request is already decided' using errcode = '55000';
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'Management staff') into v_name from public.profiles where id = auth.uid();

  insert into public.approval_decisions (approval_request_id, decided_by, decision, signature_name, comment, decided_at)
  values (r.id, auth.uid(), case p_decision when 'approved' then 'approve' else 'reject' end,
          'Board decision recorded by ' || coalesce(v_name, 'management staff'), v_note, now())
  on conflict (approval_request_id, decided_by) do update
     set decision = excluded.decision, signature_name = excluded.signature_name,
         comment = excluded.comment, decided_at = excluded.decided_at;

  perform set_config('app.approval_decision', 'on', true);
  update public.approval_requests
     set status = p_decision::public.approval_request_status,
         decision_by = auth.uid(),
         decision_at = now(),
         notes = case when v_note is null then notes
                      else concat_ws(E'\n', nullif(notes, ''), 'Board decision: ' || v_note) end,
         updated_at = now()
   where id = r.id;
  perform set_config('app.approval_decision', 'off', true);
end
$function$;

revoke all on function public.record_approval_decision(uuid, text, text) from public, anon;
grant execute on function public.record_approval_decision(uuid, text, text) to authenticated;

-- Votes are no longer cast (the board portal is read-only), so the old vote
-- tally (approval_votes trigger, platform operator only) must not approve a
-- request either: it is left without the flag, and the guard refuses it
-- (security review). An earlier draft of this migration, applied once, gave
-- it the flag; this removes it again.
do $$
declare
  v_def text := pg_get_functiondef('public.tally_approval_vote()'::regprocedure);
begin
  if position('app.approval_decision' in v_def) = 0 then
    return;
  end if;
  v_def := replace(v_def, $o$  perform set_config('app.approval_decision', 'on', true);
$o$, '');
  v_def := replace(v_def, $o$  perform set_config('app.approval_decision', 'off', true);
$o$, '');
  if position('app.approval_decision' in v_def) > 0 then
    raise exception 'tally_approval_vote: flag lines not removed';
  end if;
  execute v_def;
end
$$;

-- 1. Vendor invoices follow the association's board setting.
do $$
declare
  v_def text := pg_get_functiondef('public.submit_vendor_invoice(uuid, text, date, date, numeric, text, text, text)'::regprocedure);
  v_parts text[][] := array[
    array[$o$  v_po_count integer;
begin$o$, $n$  v_po_count integer;
  v_board_mode text;
  v_board_threshold numeric;
  v_requires_board boolean;
begin$n$],
    array[$o$  insert into public.payable_bills ($o$,
          $n$  -- Board approval follows the association's setting, as for a bill staff
  -- enter. Staff set the expense account before approving.
  select coalesce(s.sends_bills_to_board, 'never'), s.bills_threshold
    into v_board_mode, v_board_threshold
    from public.board_approval_settings s
   where s.association_id = v_association_id;
  v_requires_board := coalesce(coalesce(v_board_mode, 'never') = 'always'
    or (v_board_mode = 'over_threshold' and p_amount >= coalesce(v_board_threshold, 0)), false);

  insert into public.payable_bills ($n$],
    array[$o$    'pending_approval', true, auth.uid()$o$, $n$    'pending_approval', v_requires_board, auth.uid()$n$]
  ];
  i integer;
begin
  if position('v_requires_board' in v_def) > 0 then
    return;
  end if;
  for i in 1 .. array_length(v_parts, 1) loop
    if (length(v_def) - length(replace(v_def, v_parts[i][1], ''))) / length(v_parts[i][1]) <> 1 then
      raise exception 'submit_vendor_invoice: part % not found exactly once', i;
    end if;
    v_def := replace(v_def, v_parts[i][1], v_parts[i][2]);
  end loop;
  execute v_def;
end
$$;

create or replace function public.set_payable_bill_expense_account(p_bill_id uuid, p_gl_account_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  b public.payable_bills%rowtype;
begin
  select * into b from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found' using errcode = 'P0002'; end if;
  if not public.can_manage_finance(b.portfolio_id) or not public.operator_may_write(false) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if not public.can_view_association_row(b.association_id) then
    raise exception 'Bill not found' using errcode = 'P0002';
  end if;
  if b.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status) or b.archived_at is not null then
    raise exception 'The expense account can be changed only before the bill is approved' using errcode = '55000';
  end if;
  perform 1 from public.gl_accounts g
   where g.id = p_gl_account_id
     and g.portfolio_id = b.portfolio_id
     and g.active
     and g.account_type in ('expense', 'cost_of_goods_sold', 'other_expense')
     and (g.association_id is null or g.association_id = b.association_id);
  if not found then
    raise exception 'Choose an active expense account for this association' using errcode = '22023';
  end if;
  update public.payable_bills set gl_account_id = p_gl_account_id, updated_at = now() where id = p_bill_id;
end
$function$;

revoke all on function public.set_payable_bill_expense_account(uuid, uuid) from public, anon;
grant execute on function public.set_payable_bill_expense_account(uuid, uuid) to authenticated;

-- 3. One bill per vendor invoice number.
do $$
declare
  v_def text := pg_get_functiondef('public.create_payable_bill(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text, boolean, boolean)'::regprocedure);
  v_old text := $o$    raise exception 'Vendor, bill date, and a positive amount are required';
  end if;$o$;
  v_new text := $n$    raise exception 'Vendor, bill date, and a positive amount are required';
  end if;
  -- One bill per vendor invoice number (same lock as import_bills and
  -- submit_vendor_invoice), so the same invoice can't be paid twice.
  if nullif(btrim(coalesce(p_bill_number, '')), '') is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_vendor_id::text || ':' || lower(btrim(p_bill_number)), 0));
    if exists (
      select 1 from public.payable_bills pb
       where pb.vendor_id = p_vendor_id
         and pb.archived_at is null
         and pb.status <> 'void'::public.payable_bill_status
         and lower(btrim(pb.bill_number)) = lower(btrim(p_bill_number))
    ) then
      raise exception 'Invoice number % already exists for this vendor', btrim(p_bill_number) using errcode = '23505';
    end if;
  end if;$n$;
begin
  if position('One bill per vendor invoice number' in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'create_payable_bill: amount check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 4. Payment dates within a sensible range.
do $$
declare
  v_def text := pg_get_functiondef('public.record_bill_payment(uuid, uuid[], date, text)'::regprocedure);
  v_old text := $o$    select * into v_vendor from public.vendors where id = v_bill.vendor_id;$o$;
  v_new text := $n$    if p_payment_date < v_bill.bill_date then
      raise exception 'The payment date can''t be before the date of bill %', coalesce(v_bill.bill_number, v_id::text) using errcode = '22023';
    end if;
    if p_payment_date > coalesce(public.association_local_date(v_bill.association_id, now()), current_date) + 90 then
      raise exception 'The payment date for bill % can be at most 90 days ahead', coalesce(v_bill.bill_number, v_id::text) using errcode = '22023';
    end if;
    select * into v_vendor from public.vendors where id = v_bill.vendor_id;$n$;
begin
  if position('at most 90 days ahead' in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'record_bill_payment: vendor lookup not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.record_check_run_legacy(uuid, uuid[], integer, date)'::regprocedure);
  v_old text := $o$    if bill_row.amount - coalesce(bill_row.credit_applied, 0) <= 0 then raise exception 'Bill % has a non-positive amount', bill_id; end if;$o$;
  v_new text := $n$    if bill_row.amount - coalesce(bill_row.credit_applied, 0) <= 0 then raise exception 'Bill % has a non-positive amount', bill_id; end if;
    if bill_row.archived_at is not null then raise exception 'Bill % is not approved and unpaid', bill_id; end if;
    if p_payment_date < bill_row.bill_date then
      raise exception 'The check date can''t be before the date of bill %', coalesce(bill_row.bill_number, bill_id::text) using errcode = '22023';
    end if;
    if p_payment_date > coalesce(public.association_local_date(bill_row.association_id, now()), current_date) + 90 then
      raise exception 'The check date for bill % can be at most 90 days ahead', coalesce(bill_row.bill_number, bill_id::text) using errcode = '22023';
    end if;$n$;
begin
  if position('at most 90 days ahead' in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'record_check_run_legacy: amount check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 5. Vendors archived after they were paid stay on the 1099 report.
do $$
declare
  v_def text := pg_get_functiondef('public.assemble_vendor_1099_data(uuid, integer)'::regprocedure);
  v_old text := $o$        and v.send_1099 = true
        and v.archived_at is null
$o$;
  v_new text := $n$        and v.send_1099 = true
$n$;
begin
  if position('v.archived_at is null' in v_def) = 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'assemble_vendor_1099_data: archived filter not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 6. A voided payment leaves the bill's bank account in place.
do $$
declare
  v_def text := pg_get_functiondef('public.void_payable_check(uuid, text, boolean)'::regprocedure);
  v_old text := $o$    paid_at = null, bank_account_id = null, check_number = null, updated_at = now()$o$;
  v_new text := $n$    paid_at = null, check_number = null, updated_at = now()$n$;
begin
  if position('bank_account_id = null' in v_def) = 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'void_payable_check: bill reset not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- Migration review: the 90-day errors name the bill (an earlier draft of
-- this migration, applied once, did not), and an invoice a vendor sends
-- can be dated at most 30 days ahead (otherwise it could not be paid until
-- that date, since a payment can't be dated before its bill).
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.record_bill_payment(uuid, uuid[], date, text)'::regprocedure);
  if position('The payment date can be at most 90 days ahead'' using' in v_def) > 0 then
    execute replace(v_def, 'The payment date can be at most 90 days ahead'' using',
      'The payment date for bill % can be at most 90 days ahead'', coalesce(v_bill.bill_number, v_id::text) using');
  end if;
  v_def := pg_get_functiondef('public.record_check_run_legacy(uuid, uuid[], integer, date)'::regprocedure);
  if position('The check date can be at most 90 days ahead'' using' in v_def) > 0 then
    execute replace(v_def, 'The check date can be at most 90 days ahead'' using',
      'The check date for bill % can be at most 90 days ahead'', coalesce(bill_row.bill_number, bill_id::text) using');
  end if;
end
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.submit_vendor_invoice(uuid, text, date, date, numeric, text, text, text)'::regprocedure);
  v_old text := $o$  if p_bill_date is null then
    raise exception 'Invoice date is required';
  end if;$o$;
  v_new text := $n$  if p_bill_date is null then
    raise exception 'Invoice date is required';
  end if;
  if p_bill_date > coalesce(public.association_local_date(v_association_id, now()), current_date) + 30 then
    raise exception 'Invoice date can''t be more than 30 days ahead';
  end if;$n$;
begin
  if position('more than 30 days ahead' in v_def) > 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'submit_vendor_invoice: invoice date check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
