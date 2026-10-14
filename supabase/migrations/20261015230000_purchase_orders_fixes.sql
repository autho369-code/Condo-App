-- Deep check: purchase orders, projects, inventory, fixed assets (2026-10-14).
-- 1. bill_purchase_order copies the PO's work order to the bill, so a bill
--    from a PO counts toward the capital project's spend (it never did).
-- 2. submit_purchase_order routes by the association's board rules at
--    submit time, not the rules stored when the draft was saved.
-- 3. Signed-in users can't change, re-point or delete an approval request
--    directly (status, votes, scheme, members, amount, archive, type,
--    association, notes once decided); only record_approval_decision / the
--    board functions decide it. Signed-in users can't add board votes.
-- 4. A fixed asset can't move to another association (or company) while a
--    reserve component links to it, and an asset with no association no
--    longer matches every component.
-- 5. Association-local dates: bill date default, "Create now" needed-by,
--    resuming a recurring PO.
-- Bodies are the live ones plus the change (read with pg_get_functiondef).

-- 1 + 5. Bill from a PO.
create or replace function public.bill_purchase_order(p_po_id uuid, p_bill_number text, p_bill_date date, p_due_date date, p_amount numeric, p_gl_account_id uuid, p_memo text, p_submit_for_approval boolean)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  po public.purchase_orders;
  v_gl uuid;
  v_gl_count integer;
  v_uncategorized integer;
  v_amount numeric := round(p_amount, 2);
  v_bill uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to bill purchase orders' using errcode = '42501';
  end if;
  select * into po from public.purchase_orders where id = p_po_id and archived_at is null;
  if po.id is null then
    raise exception 'Purchase order not found';
  end if;
  if not ((public.can_manage_finance(po.portfolio_id) and (po.association_id is null or public.can_manage_association(po.association_id)))
          or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this purchase order' using errcode = '42501';
  end if;
  if po.vendor_id is null then
    raise exception 'Add a vendor to the purchase order before billing it' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Enter the bill amount' using errcode = '22023';
  end if;

  select count(distinct l.gl_account_id), min(l.gl_account_id::text)::uuid, count(*) filter (where l.gl_account_id is null)
    into v_gl_count, v_gl, v_uncategorized
    from public.purchase_order_line_items l where l.purchase_order_id = po.id;
  if p_gl_account_id is not null then
    if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = po.portfolio_id
                     and (g.association_id is null or g.association_id is not distinct from po.association_id)
                     and coalesce(g.active, true)) then
      raise exception 'Choose an active GL account of this association' using errcode = '22023';
    end if;
    v_gl := p_gl_account_id;
  elsif v_gl_count <> 1 or v_uncategorized > 0 then
    raise exception 'Choose the GL account for this bill — the purchase order''s lines don''t all use one account' using errcode = '22023';
  end if;

  if not exists (select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = po.portfolio_id and (g.association_id is null or g.association_id is not distinct from po.association_id) and coalesce(g.active, true) and g.account_type::text in ('expense', 'other_expense', 'cost_of_goods_sold')) then
    raise exception 'Choose an active expense account for this bill — the purchase order''s account is inactive or not an expense account' using errcode = '22023';
  end if;

  v_bill := public.create_payable_bill(po.portfolio_id, po.vendor_id, po.association_id, v_gl, null,
    p_bill_number,
    -- purchase_orders_fixes: the association's own day, not the database's.
    coalesce(p_bill_date, public.association_local_date(po.association_id), current_date),
    p_due_date, v_amount,
    coalesce(nullif(btrim(coalesce(p_memo, '')), ''), 'PO ' || coalesce(po.number, left(po.id::text, 8))), false, false);
  -- purchase_orders_fixes: the PO's work order follows to the bill, so the
  -- bill counts toward the work order's capital project.
  update public.payable_bills
     set purchase_order_id = po.id,
         work_order_id = coalesce(work_order_id, po.work_order_id)
   where id = v_bill;
  if coalesce(p_submit_for_approval, false) then
    perform public.request_payable_bill_approval(v_bill);
  end if;
  return v_bill;
end $function$;

-- Bills already made from a PO (none on production when written).
update public.payable_bills b
   set work_order_id = po.work_order_id
  from public.purchase_orders po
 where b.purchase_order_id = po.id
   and b.work_order_id is null
   and po.work_order_id is not null;

-- 2. Board routing at submit time.
create or replace function public.submit_purchase_order(p_purchase_order_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  po_row public.purchase_orders;
  vendor_name text;
  request_id uuid;
  line_count integer;
  v_mode text;
  v_threshold numeric;
begin
  select * into po_row from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_manage_finance(po_row.portfolio_id)
     or (po_row.association_id is not null and not public.can_manage_association(po_row.association_id)) then
    raise exception 'Permission denied';
  end if;
  if po_row.archived_at is not null or po_row.status = 'cancelled'::public.purchase_order_status then
    raise exception 'Cancelled purchase orders cannot be submitted';
  end if;
  if po_row.approval_status not in ('draft', 'rejected') then
    raise exception 'This purchase order has already been submitted';
  end if;
  select count(*) into line_count from public.purchase_order_line_items where purchase_order_id = p_purchase_order_id;
  if line_count = 0 or po_row.po_total <= 0 then raise exception 'Add at least one priced line item before submitting'; end if;

  -- purchase_orders_fixes: the association's board rules today decide, not
  -- the rules when the draft was saved (or generated from a recurring PO).
  select s.sends_pos_to_board, s.pos_threshold into v_mode, v_threshold
    from public.board_approval_settings s where s.association_id = po_row.association_id;
  v_mode := coalesce(v_mode, 'never');
  po_row.approval_required := v_mode = 'always' or (v_mode = 'over_threshold' and po_row.po_total >= coalesce(v_threshold, 0));
  update public.purchase_orders set approval_required = po_row.approval_required where id = p_purchase_order_id;

  if not po_row.approval_required then
    update public.purchase_orders
       set approval_status = 'approved',
           status = 'approved'::public.purchase_order_status,
           submitted_at = now(),
           approved_at = now(),
           approved_by = auth.uid(),
           decided_at = now(),
           decision_note = 'Approved within manager spending authority',
           updated_at = now()
     where id = p_purchase_order_id;
    return 'approved';
  end if;

  select name into vendor_name from public.vendors where id = po_row.vendor_id;
  request_id := public.open_board_approval_request(
    po_row.portfolio_id, po_row.association_id, po_row.vendor_id, 'purchase_order',
    'PO ' || coalesce(po_row.number, left(po_row.id::text, 8)) || ' — ' || coalesce(vendor_name, 'Vendor'),
    coalesce(po_row.description, po_row.notes), po_row.po_total, po_row.needed_by
  );
  update public.purchase_orders
     set approval_status = 'pending_approval',
         approval_request_id = request_id,
         submitted_at = now(),
         decided_at = null,
         decision_note = null,
         updated_at = now()
   where id = p_purchase_order_id;
  return 'pending_approval';
end;
$function$;

-- 5. "Create now" needed-by from the association's own day.
create or replace function public.app_po_from_recurring(p_id uuid, p_period date)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.recurring_purchase_orders;
  line jsonb;
  v_total numeric := 0;
  v_qty numeric;
  v_price numeric;
  v_gl uuid;
  v_mode text;
  v_threshold numeric;
  v_po uuid;
  v_sort integer := 0;
begin
  select * into r from public.recurring_purchase_orders where id = p_id;
  if not found or r.archived_at is not null then raise exception 'Recurring purchase order not found'; end if;
  if not exists (select 1 from public.associations a where a.id = r.association_id and a.portfolio_id = r.portfolio_id and a.archived_at is null) then
    raise exception 'The association is archived';
  end if;
  if not exists (select 1 from public.vendors v where v.id = r.vendor_id and v.portfolio_id = r.portfolio_id and v.archived_at is null) then
    raise exception 'The vendor is archived';
  end if;

  for line in select * from jsonb_array_elements(r.lines) loop
    v_qty := (line ->> 'qty')::numeric;
    v_price := (line ->> 'unit_price')::numeric;
    v_gl := nullif(line ->> 'gl_account_id', '')::uuid;
    if v_gl is not null and not exists (
      select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = r.portfolio_id and g.active
         and (g.association_id is null or g.association_id = r.association_id)) then
      raise exception 'A line''s GL account is inactive or outside this association';
    end if;
    v_total := v_total + round(v_qty * v_price, 2);
  end loop;
  if v_total <= 0 then raise exception 'Purchase order total must be greater than zero'; end if;

  select s.sends_pos_to_board, s.pos_threshold into v_mode, v_threshold
    from public.board_approval_settings s where s.association_id = r.association_id;
  v_mode := coalesce(v_mode, 'never');

  insert into public.purchase_orders (
    portfolio_id, association_id, vendor_id, status, po_total, notes, description, needed_by,
    approval_status, approval_required, created_by, recurring_purchase_order_id, recurring_period)
  values (
    r.portfolio_id, r.association_id, r.vendor_id, 'open'::public.purchase_order_status, v_total, r.notes,
    coalesce(r.description, r.name),
    -- purchase_orders_fixes: "Create now" counts from the association's day.
    coalesce(p_period, public.association_local_date(r.association_id), current_date) + r.needed_by_days,
    'draft', v_mode = 'always' or (v_mode = 'over_threshold' and v_total >= coalesce(v_threshold, 0)),
    coalesce(auth.uid(), r.created_by), r.id, p_period)
  on conflict (recurring_purchase_order_id, recurring_period)
    where recurring_purchase_order_id is not null and recurring_period is not null do nothing
  returning id into v_po;
  if v_po is null then return null; end if;

  for line in select * from jsonb_array_elements(r.lines) loop
    v_sort := v_sort + 1;
    insert into public.purchase_order_line_items (purchase_order_id, description, qty, unit_price, gl_account_id, sort_order)
    values (v_po, btrim(line ->> 'description'), (line ->> 'qty')::numeric, (line ->> 'unit_price')::numeric,
            nullif(line ->> 'gl_account_id', '')::uuid, v_sort);
  end loop;
  return v_po;
end $function$;

-- 5. Resuming a recurring PO starts no earlier than the association's day.
create or replace function public.set_recurring_purchase_order_state(p_id uuid, p_state text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.recurring_purchase_orders;
begin
  select * into r from public.recurring_purchase_orders where id = p_id and archived_at is null for update;
  if not found or not public.can_manage_finance(r.portfolio_id) or not public.can_manage_association(r.association_id) then
    raise exception 'Recurring purchase order not found' using errcode = '42501';
  end if;
  if p_state = 'pause' then
    update public.recurring_purchase_orders set auto_generate = false, updated_at = now() where id = p_id;
  elsif p_state = 'resume' then
    update public.recurring_purchase_orders
       set auto_generate = true, last_error = null, updated_at = now(),
           -- purchase_orders_fixes: the association's own day.
           next_post_date = greatest(coalesce(next_post_date, start_date),
                                     coalesce(public.association_local_date(r.association_id), current_date))
     where id = p_id;
  elsif p_state = 'stop' then
    update public.recurring_purchase_orders set archived_at = now(), auto_generate = false, updated_at = now() where id = p_id;
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end $function$;

-- 3. Approval request decisions only through the decision functions.
-- Invoker on purpose: current_user is the caller's role, so database
-- functions (record_approval_decision, open_board_approval_request, PO
-- cancel) pass and direct signed-in writes are checked. Signed-in users
-- can't delete a request (it would erase the recorded decision or strand
-- its bill or PO), can't re-point it (type, association, company, vendor,
-- owner, unit: the PO sync keys on request_type), and can't edit its notes
-- once decided (they hold the recorded decision).
create or replace function public.approval_requests_decision_guard()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon')
     or coalesce(current_setting('app.approval_decision', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Approval requests can''t be deleted' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     or new.required_votes is distinct from old.required_votes
     or new.voting_scheme is distinct from old.voting_scheme
     or new.board_member_ids is distinct from old.board_member_ids
     or new.percentage_required is distinct from old.percentage_required
     or new.signatures_required is distinct from old.signatures_required
     or new.amount is distinct from old.amount
     or new.votes_for is distinct from old.votes_for
     or new.votes_against is distinct from old.votes_against
     or new.votes_abstain is distinct from old.votes_abstain
     or new.decision_by is distinct from old.decision_by
     or new.decision_at is distinct from old.decision_at
     or new.archived_at is distinct from old.archived_at
     or new.request_type is distinct from old.request_type
     or new.association_id is distinct from old.association_id
     or new.portfolio_id is distinct from old.portfolio_id
     or new.vendor_id is distinct from old.vendor_id
     or new.owner_id is distinct from old.owner_id
     or new.unit_id is distinct from old.unit_id
     or (old.status is distinct from 'pending'::public.approval_request_status
         and new.notes is distinct from old.notes) then
    raise exception 'Record the board''s decision from the bill or purchase order page' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.approval_requests_decision_guard() from public, anon, authenticated;

drop trigger if exists trg_approval_requests_decision_guard on public.approval_requests;
create trigger trg_approval_requests_decision_guard
  before update or delete on public.approval_requests
  for each row execute function public.approval_requests_decision_guard();

-- Board votes are no longer cast (cast_board_approval is not callable by
-- signed-in users); a vote row would still tally a request through the
-- definer trigger, so signed-in users can't add one. Database functions
-- (definer) are unaffected.
drop policy if exists approval_votes_no_signed_in_insert on public.approval_votes;
create policy approval_votes_no_signed_in_insert on public.approval_votes
  as restrictive for insert to authenticated, anon
  with check (false);

-- 4. Reserve component <-> fixed asset scope, both directions.
create or replace function public.enforce_reserve_component_scope()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  parent_portfolio uuid;
  parent_association uuid;
  asset_portfolio uuid;
  asset_association uuid;
begin
  select portfolio_id, association_id
    into parent_portfolio, parent_association
  from public.reserve_studies
  where id = new.study_id;

  if parent_portfolio is null
     or parent_portfolio <> new.portfolio_id
     or parent_association <> new.association_id then
    raise exception 'Reserve planning record must match its study scope';
  end if;

  if new.fixed_asset_id is not null then
    select portfolio_id, association_id
      into asset_portfolio, asset_association
    from public.fixed_assets
    where id = new.fixed_asset_id;

    -- purchase_orders_fixes: an asset with no association matches nothing.
    if asset_portfolio is null
       or asset_portfolio <> new.portfolio_id
       or asset_association is distinct from new.association_id then
      raise exception 'The fixed asset must belong to the same association as this reserve study';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.fixed_assets_reserve_scope_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if exists (
    select 1 from public.reserve_components rc
     where rc.fixed_asset_id = new.id
       and (rc.association_id is distinct from new.association_id
            or rc.portfolio_id is distinct from new.portfolio_id)) then
    raise exception 'This asset is linked to a component in its association''s reserve study. Unlink it there before moving the asset to another association' using errcode = '23514';
  end if;
  return new;
end
$function$;

revoke all on function public.fixed_assets_reserve_scope_guard() from public, anon, authenticated;

drop trigger if exists trg_fixed_assets_reserve_scope_guard on public.fixed_assets;
create trigger trg_fixed_assets_reserve_scope_guard
  before update of association_id, portfolio_id on public.fixed_assets
  for each row
  when (new.association_id is distinct from old.association_id or new.portfolio_id is distinct from old.portfolio_id)
  execute function public.fixed_assets_reserve_scope_guard();
