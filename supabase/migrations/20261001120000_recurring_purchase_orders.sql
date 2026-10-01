-- Recurring purchase orders (AppFolio: Purchase Orders -> Recurring Purchase Orders / PO templates).
-- A recurring PO is saved from an existing PO (vendor, association, scope, lines).
-- Each period the daily job creates a DRAFT purchase order from it; staff review and
-- submit it, so the association's board-approval rules still apply. "Create now"
-- makes one on demand, which also covers reusable PO templates (pause the schedule).

create table if not exists public.recurring_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  description text,
  notes text,
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 100),
  frequency public.recurring_frequency not null,
  interval_count integer not null default 1 check (interval_count between 1 and 60),
  start_date date not null,
  end_date date,
  next_post_date date,
  needed_by_days integer not null default 0 check (needed_by_days between 0 and 365),
  auto_generate boolean not null default true,
  last_generated_at timestamptz,
  last_error text,
  source_purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists recurring_purchase_orders_due_idx
  on public.recurring_purchase_orders (next_post_date) where archived_at is null and auto_generate;

alter table public.recurring_purchase_orders enable row level security;

drop policy if exists recurring_purchase_orders_finance_read on public.recurring_purchase_orders;
create policy recurring_purchase_orders_finance_read on public.recurring_purchase_orders
  for select to authenticated using (public.can_manage_finance(portfolio_id));
drop policy if exists mgr_assoc_scope on public.recurring_purchase_orders;
create policy mgr_assoc_scope on public.recurring_purchase_orders
  as restrictive for all to authenticated using (public.can_view_association_row(association_id));
-- Writes go through the RPCs below only.

alter table public.purchase_orders
  add column if not exists recurring_purchase_order_id uuid references public.recurring_purchase_orders(id) on delete set null,
  add column if not exists recurring_period date;

create unique index if not exists purchase_orders_recurring_period_uq
  on public.purchase_orders (recurring_purchase_order_id, recurring_period)
  where recurring_purchase_order_id is not null and recurring_period is not null;

-- Internal: create one draft PO from a recurring PO. Not callable by clients.
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
    coalesce(r.description, r.name), coalesce(p_period, current_date) + r.needed_by_days,
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

revoke all on function public.app_po_from_recurring(uuid, date) from public, anon, authenticated;

-- Save a recurring PO from an existing purchase order (copies vendor, association, scope and lines).
create or replace function public.save_recurring_purchase_order(
  p_source_po_id uuid, p_name text, p_frequency text, p_interval integer,
  p_start_date date, p_end_date date, p_needed_by_days integer)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  po public.purchase_orders;
  v_lines jsonb;
  v_id uuid;
begin
  select * into po from public.purchase_orders where id = p_source_po_id;
  if not found or not public.can_manage_finance(po.portfolio_id) or not public.can_manage_association(po.association_id) then
    raise exception 'Purchase order not found' using errcode = '42501';
  end if;
  if po.vendor_id is null then raise exception 'The purchase order has no vendor' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Name the recurring purchase order' using errcode = '22023'; end if;
  if p_frequency not in ('weekly', 'monthly', 'quarterly', 'annually') then raise exception 'Choose how often it repeats' using errcode = '22023'; end if;
  if p_start_date is null then raise exception 'Choose the first date' using errcode = '22023'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'End date is before the first date' using errcode = '22023'; end if;
  if coalesce(p_needed_by_days, 0) not between 0 and 365 then raise exception 'Needed-by days must be 0 to 365' using errcode = '22023'; end if;

  select jsonb_agg(jsonb_build_object('description', l.description, 'qty', l.qty, 'unit_price', l.unit_price,
                                      'gl_account_id', l.gl_account_id) order by l.sort_order)
    into v_lines
    from public.purchase_order_line_items l where l.purchase_order_id = po.id;
  if v_lines is null then raise exception 'The purchase order has no line items' using errcode = '22023'; end if;

  insert into public.recurring_purchase_orders (
    portfolio_id, association_id, vendor_id, name, description, notes, lines, frequency, interval_count,
    start_date, end_date, next_post_date, needed_by_days, source_purchase_order_id, created_by)
  values (
    po.portfolio_id, po.association_id, po.vendor_id, btrim(p_name), po.description, po.notes, v_lines,
    p_frequency::public.recurring_frequency, least(greatest(coalesce(p_interval, 1), 1), 60),
    p_start_date, p_end_date, p_start_date, coalesce(p_needed_by_days, 0), po.id, auth.uid())
  returning id into v_id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (po.portfolio_id, 'recurring_purchase_order', v_id, 'created', auth.uid(),
          jsonb_build_object('name', btrim(p_name), 'frequency', p_frequency, 'source_purchase_order_id', po.id));
  return v_id;
end $function$;

grant execute on function public.save_recurring_purchase_order(uuid, text, text, integer, date, date, integer) to authenticated;

-- Pause / resume / stop.
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
    -- Resume from today forward; skipped periods are not back-filled.
    update public.recurring_purchase_orders
       set auto_generate = true, last_error = null, updated_at = now(),
           next_post_date = greatest(coalesce(next_post_date, start_date), current_date)
     where id = p_id;
  elsif p_state = 'stop' then
    update public.recurring_purchase_orders set archived_at = now(), auto_generate = false, updated_at = now() where id = p_id;
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end $function$;

grant execute on function public.set_recurring_purchase_order_state(uuid, text) to authenticated;

-- Create a draft PO now (on demand / template use). Not tied to a schedule period.
create or replace function public.create_po_from_recurring(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.recurring_purchase_orders;
begin
  select * into r from public.recurring_purchase_orders where id = p_id and archived_at is null;
  if not found or not public.can_manage_finance(r.portfolio_id) or not public.can_manage_association(r.association_id) then
    raise exception 'Recurring purchase order not found' using errcode = '42501';
  end if;
  return public.app_po_from_recurring(p_id, null);
end $function$;

grant execute on function public.create_po_from_recurring(uuid) to authenticated;

-- Daily job: one draft PO per due period (catches up at most 12 periods).
create or replace function public.generate_recurring_purchase_orders()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t record;
  v_date date;
  v_guard integer;
  n integer := 0;
begin
  for t in
    select * from public.recurring_purchase_orders
     where auto_generate and archived_at is null and next_post_date is not null
       and next_post_date <= current_date
       and (end_date is null or next_post_date <= end_date)
  loop
    begin
      v_date := t.next_post_date;
      v_guard := 0;
      while v_date <= current_date and (t.end_date is null or v_date <= t.end_date) and v_guard < 12 loop
        if public.app_po_from_recurring(t.id, v_date) is not null then n := n + 1; end if;
        v_date := public.recurring_next_date(v_date, t.frequency::text, t.interval_count);
        v_guard := v_guard + 1;
      end loop;
      update public.recurring_purchase_orders
         set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now(),
             auto_generate = (t.end_date is null or v_date <= t.end_date)
       where id = t.id;
    exception when others then
      update public.recurring_purchase_orders set last_error = left(sqlerrm, 500), updated_at = now() where id = t.id;
    end;
  end loop;
  return n;
end $function$;

revoke all on function public.generate_recurring_purchase_orders() from public, anon, authenticated;

select cron.schedule('generate-recurring-purchase-orders-daily', '35 2 * * *',
  $$ select public.generate_recurring_purchase_orders(); $$);
