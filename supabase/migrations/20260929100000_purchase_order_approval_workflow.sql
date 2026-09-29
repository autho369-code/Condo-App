-- Purchase order approval workflow.
--
-- Mirrors the payable-bill workflow: every PO write goes through a
-- SECURITY DEFINER RPC, approval state cannot be forged with a direct table
-- write, and POs at or above the association's board threshold are routed to
-- a board vote (approval_requests, request_type 'purchase_order'). The board
-- decision finalizes the PO automatically. Vendors only ever see approved POs.

-- ── Association spending authority ──────────────────────────────────────────
alter table public.board_approval_settings
  add column if not exists sends_pos_to_board text not null default 'never',
  add column if not exists pos_threshold numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'board_approval_settings_sends_pos_to_board_check'
       and conrelid = 'public.board_approval_settings'::regclass
  ) then
    alter table public.board_approval_settings
      add constraint board_approval_settings_sends_pos_to_board_check
      check (sends_pos_to_board in ('never', 'always', 'over_threshold'));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'board_approval_settings_pos_threshold_check'
       and conrelid = 'public.board_approval_settings'::regclass
  ) then
    alter table public.board_approval_settings
      add constraint board_approval_settings_pos_threshold_check
      check (pos_threshold is null or pos_threshold >= 0);
  end if;
end $$;

-- ── PO approval state ───────────────────────────────────────────────────────
alter table public.purchase_orders
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_request_id uuid,
  add column if not exists description text,
  add column if not exists needed_by date,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists decided_at timestamptz,
  add column if not exists decision_note text,
  add column if not exists cancelled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'purchase_orders_approval_status_check'
       and conrelid = 'public.purchase_orders'::regclass
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_approval_status_check
      check (approval_status in ('draft', 'pending_approval', 'approved', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'purchase_orders_approval_request_id_fkey'
       and conrelid = 'public.purchase_orders'::regclass
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_approval_request_id_fkey
      foreign key (approval_request_id) references public.approval_requests(id) on delete set null;
  end if;
end $$;

create unique index if not exists purchase_orders_approval_request_unique
  on public.purchase_orders (approval_request_id)
  where approval_request_id is not null;
create index if not exists purchase_orders_approval_status_idx
  on public.purchase_orders (portfolio_id, approval_status)
  where archived_at is null;

-- ── Shared: open a board vote using the association's defaults ─────────────
create or replace function public.open_board_approval_request(
  p_portfolio_id uuid,
  p_association_id uuid,
  p_vendor_id uuid,
  p_request_type text,
  p_title text,
  p_description text,
  p_amount numeric,
  p_due_date date
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  settings_row public.board_approval_settings;
  member_ids uuid[];
  member_count integer;
  required_count integer;
  v_scheme public.voting_scheme;
  request_id uuid;
begin
  select * into settings_row from public.board_approval_settings
   where association_id = p_association_id;
  select coalesce(array_agg(bm.id order by bm.id), '{}'::uuid[])
    into member_ids
    from public.board_members bm
   where bm.association_id = p_association_id
     and bm.active
     and (
       coalesce(cardinality(settings_row.default_board_member_ids), 0) = 0
       or bm.id = any(settings_row.default_board_member_ids)
     );
  member_count := coalesce(cardinality(member_ids), 0);
  if member_count = 0 then raise exception 'No active board approvers are configured for this association'; end if;

  v_scheme := coalesce(settings_row.default_voting_scheme, 'majority_approval_required'::public.voting_scheme);
  required_count := case v_scheme
    when 'any_one_approver'::public.voting_scheme then 1
    when 'unanimous_approval_required'::public.voting_scheme then member_count
    when 'percentage_required'::public.voting_scheme then greatest(1, ceil(member_count * coalesce(settings_row.default_percentage_required, 100) / 100.0)::integer)
    else floor(member_count / 2.0)::integer + 1
  end;

  insert into public.approval_requests (
    portfolio_id, association_id, vendor_id, request_type, title, description,
    requested_by_name, requested_by_email, amount, due_date, status,
    voting_scheme, required_votes, signatures_required, board_member_ids,
    percentage_required, requested_at
  ) values (
    p_portfolio_id, p_association_id, p_vendor_id, p_request_type, p_title, p_description,
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Portier369 staff'),
    (select email from auth.users where id = auth.uid()), p_amount, p_due_date, 'pending',
    v_scheme, required_count, coalesce(settings_row.signatures_required, true),
    member_ids, settings_row.default_percentage_required, now()
  ) returning id into request_id;
  return request_id;
end;
$$;

-- ── Create / edit a draft PO with line items ───────────────────────────────
create or replace function public.save_purchase_order(
  p_purchase_order_id uuid,
  p_portfolio_id uuid,
  p_association_id uuid,
  p_vendor_id uuid,
  p_work_order_id uuid,
  p_number text,
  p_description text,
  p_needed_by date,
  p_notes text,
  p_lines jsonb,
  p_submit boolean
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  po_row public.purchase_orders;
  po_id uuid;
  line jsonb;
  v_qty numeric;
  v_price numeric;
  v_gl uuid;
  v_desc text;
  v_total numeric := 0;
  v_sort integer := 0;
  board_mode text := 'never';
  board_threshold numeric;
begin
  if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then
    raise exception 'Permission denied';
  end if;
  if p_association_id is null or not exists (
    select 1 from public.associations a
     where a.id = p_association_id and a.portfolio_id = p_portfolio_id and a.archived_at is null
  ) then
    raise exception 'Association is outside your portfolio or archived';
  end if;
  if p_vendor_id is null or not exists (
    select 1 from public.vendors v
     where v.id = p_vendor_id and v.portfolio_id = p_portfolio_id and v.archived_at is null
  ) then
    raise exception 'Vendor is outside your portfolio or archived';
  end if;
  if p_work_order_id is not null and not exists (
    select 1 from public.work_orders w
     where w.id = p_work_order_id and w.portfolio_id = p_portfolio_id
       and w.association_id = p_association_id
  ) then
    raise exception 'Work order does not belong to this association';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line item';
  end if;
  if jsonb_array_length(p_lines) > 100 then
    raise exception 'A purchase order can have at most 100 line items';
  end if;

  if p_purchase_order_id is not null then
    select * into po_row from public.purchase_orders where id = p_purchase_order_id for update;
    if not found or po_row.portfolio_id <> p_portfolio_id then raise exception 'Purchase order not found'; end if;
    if po_row.archived_at is not null or po_row.status = 'cancelled'::public.purchase_order_status then
      raise exception 'Cancelled purchase orders cannot be edited';
    end if;
    if po_row.approval_status not in ('draft', 'rejected') then
      raise exception 'Only draft or rejected purchase orders can be edited';
    end if;
  end if;

  -- Validate and total the lines before writing anything.
  for line in select * from jsonb_array_elements(p_lines) loop
    v_desc := nullif(btrim(coalesce(line ->> 'description', '')), '');
    v_qty := nullif(line ->> 'qty', '')::numeric;
    v_price := nullif(line ->> 'unit_price', '')::numeric;
    v_gl := nullif(line ->> 'gl_account_id', '')::uuid;
    if v_desc is null then raise exception 'Every line item needs a description'; end if;
    if v_qty is null or v_qty <= 0 then raise exception 'Line quantity must be greater than zero'; end if;
    if v_price is null or v_price < 0 then raise exception 'Line unit price cannot be negative'; end if;
    if v_gl is not null and not exists (
      select 1 from public.gl_accounts g
       where g.id = v_gl and g.portfolio_id = p_portfolio_id and g.active
         and (g.association_id is null or g.association_id = p_association_id)
    ) then
      raise exception 'GL account is outside this association or inactive';
    end if;
    v_total := v_total + round(v_qty * v_price, 2);
  end loop;
  if v_total <= 0 then raise exception 'Purchase order total must be greater than zero'; end if;

  select coalesce(s.sends_pos_to_board, 'never'), s.pos_threshold
    into board_mode, board_threshold
    from public.board_approval_settings s
   where s.association_id = p_association_id;
  board_mode := coalesce(board_mode, 'never');

  if p_purchase_order_id is null then
    insert into public.purchase_orders (
      portfolio_id, association_id, vendor_id, work_order_id, number, status,
      po_total, notes, description, needed_by, approval_status, approval_required, created_by
    ) values (
      p_portfolio_id, p_association_id, p_vendor_id, p_work_order_id,
      nullif(btrim(coalesce(p_number, '')), ''), 'open'::public.purchase_order_status,
      v_total, nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_description, '')), ''),
      p_needed_by, 'draft',
      board_mode = 'always' or (board_mode = 'over_threshold' and v_total >= coalesce(board_threshold, 0)),
      auth.uid()
    ) returning id into po_id;
  else
    po_id := p_purchase_order_id;
    update public.purchase_orders
       set association_id = p_association_id,
           vendor_id = p_vendor_id,
           work_order_id = p_work_order_id,
           number = nullif(btrim(coalesce(p_number, '')), ''),
           po_total = v_total,
           notes = nullif(btrim(coalesce(p_notes, '')), ''),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           needed_by = p_needed_by,
           approval_status = 'draft',
           approval_required = board_mode = 'always' or (board_mode = 'over_threshold' and v_total >= coalesce(board_threshold, 0)),
           approval_request_id = null,
           submitted_at = null,
           decided_at = null,
           updated_at = now()
     where id = po_id;
    delete from public.purchase_order_line_items where purchase_order_id = po_id;
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    v_qty := (line ->> 'qty')::numeric;
    v_price := (line ->> 'unit_price')::numeric;
    insert into public.purchase_order_line_items (
      purchase_order_id, description, qty, unit_price, gl_account_id, sort_order
    ) values (
      po_id, btrim(line ->> 'description'), v_qty, v_price,
      nullif(line ->> 'gl_account_id', '')::uuid, v_sort
    );
  end loop;

  if coalesce(p_submit, false) then
    perform public.submit_purchase_order(po_id);
  end if;
  return po_id;
end;
$$;

-- ── Submit: self-approve within manager authority, else route to board ─────
create or replace function public.submit_purchase_order(p_purchase_order_id uuid)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  po_row public.purchase_orders;
  vendor_name text;
  request_id uuid;
  line_count integer;
begin
  select * into po_row from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_manage_finance(po_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if po_row.archived_at is not null or po_row.status = 'cancelled'::public.purchase_order_status then
    raise exception 'Cancelled purchase orders cannot be submitted';
  end if;
  if po_row.approval_status not in ('draft', 'rejected') then
    raise exception 'This purchase order has already been submitted';
  end if;
  select count(*) into line_count from public.purchase_order_line_items where purchase_order_id = p_purchase_order_id;
  if line_count = 0 or po_row.po_total <= 0 then raise exception 'Add at least one priced line item before submitting'; end if;

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
$$;

-- ── Cancel ─────────────────────────────────────────────────────────────────
create or replace function public.cancel_purchase_order(p_purchase_order_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  po_row public.purchase_orders;
begin
  select * into po_row from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_manage_finance(po_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if po_row.status = 'cancelled'::public.purchase_order_status then return; end if;
  if po_row.status = 'billed'::public.purchase_order_status or po_row.po_billed > 0 then
    raise exception 'Purchase orders with billed amounts cannot be cancelled';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'A cancellation reason is required'; end if;

  if po_row.approval_request_id is not null then
    update public.approval_requests
       set status = 'cancelled'::public.approval_request_status,
           decision_at = now(), decision_by = auth.uid()
     where id = po_row.approval_request_id
       and status = 'pending'::public.approval_request_status;
  end if;
  update public.purchase_orders
     set status = 'cancelled'::public.purchase_order_status,
         cancelled_at = now(),
         decision_note = btrim(p_reason),
         updated_at = now()
   where id = p_purchase_order_id;
end;
$$;

-- ── Board decision finalizes the PO ─────────────────────────────────────────
create or replace function public.sync_purchase_order_board_decision()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.request_type <> 'purchase_order' or new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'approved'::public.approval_request_status then
    update public.purchase_orders
       set approval_status = 'approved',
           status = 'approved'::public.purchase_order_status,
           approved_at = now(),
           approved_by = new.decision_by,
           decided_at = now(),
           decision_note = 'Approved by board vote',
           updated_at = now()
     where approval_request_id = new.id
       and approval_status = 'pending_approval'
       and status = 'open'::public.purchase_order_status;
  elsif new.status = 'rejected'::public.approval_request_status then
    update public.purchase_orders
       set approval_status = 'rejected',
           decided_at = now(),
           decision_note = 'Rejected by board vote',
           updated_at = now()
     where approval_request_id = new.id
       and approval_status = 'pending_approval';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_purchase_order_board_decision on public.approval_requests;
create trigger trg_sync_purchase_order_board_decision
after update of status on public.approval_requests
for each row execute function public.sync_purchase_order_board_decision();

-- ── Edit an association's approval rules (audited) ─────────────────────────
create or replace function public.set_board_approval_settings(
  p_association_id uuid,
  p_signatures_required boolean,
  p_voting_scheme public.voting_scheme,
  p_percentage_required smallint,
  p_bills_mode text,
  p_bills_threshold numeric,
  p_pos_mode text,
  p_pos_threshold numeric
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  before_row jsonb;
begin
  select a.portfolio_id into v_portfolio from public.associations a
   where a.id = p_association_id and a.archived_at is null;
  if v_portfolio is null then raise exception 'Association not found'; end if;
  if not (public.is_platform_operator()
          or (public.is_full_access_staff() and v_portfolio = public.current_portfolio_id())) then
    raise exception 'Permission denied';
  end if;
  if p_bills_mode not in ('never', 'always', 'over_threshold')
     or p_pos_mode not in ('never', 'always', 'over_threshold') then
    raise exception 'Invalid approval routing mode';
  end if;
  if (p_bills_mode = 'over_threshold' and (p_bills_threshold is null or p_bills_threshold < 0))
     or (p_pos_mode = 'over_threshold' and (p_pos_threshold is null or p_pos_threshold < 0)) then
    raise exception 'Enter a dollar threshold of zero or more';
  end if;
  if p_voting_scheme = 'percentage_required'::public.voting_scheme
     and (p_percentage_required is null or p_percentage_required not between 1 and 100) then
    raise exception 'Enter a percentage between 1 and 100';
  end if;

  select to_jsonb(s) into before_row from public.board_approval_settings s where s.association_id = p_association_id;

  insert into public.board_approval_settings (
    association_id, signatures_required, default_voting_scheme, default_percentage_required,
    sends_bills_to_board, bills_threshold, sends_pos_to_board, pos_threshold
  ) values (
    p_association_id, coalesce(p_signatures_required, true), p_voting_scheme,
    case when p_voting_scheme = 'percentage_required'::public.voting_scheme then p_percentage_required end,
    p_bills_mode, case when p_bills_mode = 'over_threshold' then p_bills_threshold end,
    p_pos_mode, case when p_pos_mode = 'over_threshold' then p_pos_threshold end
  )
  on conflict (association_id) do update
     set signatures_required = excluded.signatures_required,
         default_voting_scheme = excluded.default_voting_scheme,
         default_percentage_required = excluded.default_percentage_required,
         sends_bills_to_board = excluded.sends_bills_to_board,
         bills_threshold = excluded.bills_threshold,
         sends_pos_to_board = excluded.sends_pos_to_board,
         pos_threshold = excluded.pos_threshold,
         updated_at = now();

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (
    v_portfolio, 'association', p_association_id, 'board_approval_settings_updated', auth.uid(),
    (select email from auth.users where id = auth.uid()),
    jsonb_build_object(
      'before', before_row,
      'after', (select to_jsonb(s) from public.board_approval_settings s where s.association_id = p_association_id)
    )
  );
end;
$$;

-- ── Lock direct writes; vendors see approved POs only ──────────────────────
revoke insert, update, delete on public.purchase_orders from authenticated;
revoke insert, update, delete on public.purchase_order_line_items from authenticated;

drop policy if exists purchase_orders_vendor_read on public.purchase_orders;
create policy purchase_orders_vendor_read on public.purchase_orders
  for select to authenticated
  using (
    vendor_id = public.current_vendor_id()
    and approval_status = 'approved'
    and archived_at is null
  );

drop policy if exists po_line_items_vendor_read on public.purchase_order_line_items;
create policy po_line_items_vendor_read on public.purchase_order_line_items
  for select to authenticated
  using (
    purchase_order_id in (
      select p.id from public.purchase_orders p
       where p.vendor_id = public.current_vendor_id()
         and p.approval_status = 'approved'
         and p.archived_at is null
    )
  );

alter function public.open_board_approval_request(uuid, uuid, uuid, text, text, text, numeric, date) owner to postgres;
alter function public.save_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, date, text, jsonb, boolean) owner to postgres;
alter function public.submit_purchase_order(uuid) owner to postgres;
alter function public.cancel_purchase_order(uuid, text) owner to postgres;
alter function public.sync_purchase_order_board_decision() owner to postgres;
alter function public.set_board_approval_settings(uuid, boolean, public.voting_scheme, smallint, text, numeric, text, numeric) owner to postgres;
revoke all on function public.set_board_approval_settings(uuid, boolean, public.voting_scheme, smallint, text, numeric, text, numeric) from public, anon;
grant execute on function public.set_board_approval_settings(uuid, boolean, public.voting_scheme, smallint, text, numeric, text, numeric) to authenticated, service_role;

revoke all on function public.open_board_approval_request(uuid, uuid, uuid, text, text, text, numeric, date) from public, anon, authenticated;
revoke all on function public.save_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, date, text, jsonb, boolean) from public, anon;
revoke all on function public.submit_purchase_order(uuid) from public, anon;
revoke all on function public.cancel_purchase_order(uuid, text) from public, anon;
revoke all on function public.sync_purchase_order_board_decision() from public, anon, authenticated;
grant execute on function public.save_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, date, text, jsonb, boolean) to authenticated, service_role;
grant execute on function public.submit_purchase_order(uuid) to authenticated, service_role;
grant execute on function public.cancel_purchase_order(uuid, text) to authenticated, service_role;
