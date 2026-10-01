-- Inventory (AppFolio Maintenance → Inventory). Until now inventory_items had
-- no company column and its only policy allowed platform operators, so staff
-- could neither see nor add items. Now:
--   * items belong to a company (portfolio_id, set from the caller on insert)
--   * every stock change is an inventory_movements row — opening, received,
--     used (optionally on a work order), adjusted — and quantity_on_hand only
--     changes through record_inventory_movement
--   * reports Inventory Status and Inventory Usage (AppFolio equivalents)
-- The table is empty in production (0 rows), so no backfill is needed.

alter table public.inventory_items
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete cascade,
  add column if not exists archived_at timestamptz;
create index if not exists inventory_items_portfolio_idx on public.inventory_items (portfolio_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  kind text not null check (kind in ('opening', 'received', 'used', 'adjusted')),
  quantity_change numeric not null check (quantity_change <> 0),
  quantity_after numeric not null,
  unit_cost numeric,
  work_order_id uuid references public.work_orders(id) on delete set null,
  association_id uuid references public.associations(id) on delete set null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);
create index if not exists inventory_movements_wo_idx on public.inventory_movements (work_order_id);
alter table public.inventory_movements enable row level security;
revoke all on public.inventory_movements from anon;

-- ------------------------------------------------------------ item guard
-- New items belong to the caller's company. quantity_on_hand changes only
-- through record_inventory_movement (which sets app.inventory_movement).
create or replace function public.inventory_items_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    if new.portfolio_id is null then
      new.portfolio_id := public.current_portfolio_id();
    end if;
    if new.portfolio_id is null then
      raise exception 'Inventory items belong to a management company' using errcode = '22023';
    end if;
    new.quantity_on_hand := greatest(coalesce(new.quantity_on_hand, 0), 0);
    return new;
  end if;
  new.portfolio_id := old.portfolio_id;
  if new.quantity_on_hand is distinct from old.quantity_on_hand
     and coalesce(current_setting('app.inventory_movement', true), '') <> 'on' then
    new.quantity_on_hand := old.quantity_on_hand;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_inventory_items_000_guard on public.inventory_items;
create trigger trg_inventory_items_000_guard before insert or update on public.inventory_items
  for each row execute function public.inventory_items_guard();

-- The quantity an item is created with is recorded as its opening movement.
create or replace function public.inventory_items_opening()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if coalesce(new.quantity_on_hand, 0) > 0 then
    insert into public.inventory_movements (portfolio_id, item_id, kind, quantity_change, quantity_after, unit_cost, note, created_by)
    values (new.portfolio_id, new.id, 'opening', new.quantity_on_hand, new.quantity_on_hand, new.unit_cost, 'Opening quantity', auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists trg_inventory_items_opening on public.inventory_items;
create trigger trg_inventory_items_opening after insert on public.inventory_items
  for each row execute function public.inventory_items_opening();

-- ------------------------------------------------------------ policies
drop policy if exists inventory_platform_only on public.inventory_items;
drop policy if exists inventory_items_staff_select on public.inventory_items;
create policy inventory_items_staff_select on public.inventory_items for select to authenticated
  using (public.is_platform_operator() or (public.is_any_staff() and portfolio_id = public.current_portfolio_id()));
drop policy if exists inventory_items_staff_insert on public.inventory_items;
create policy inventory_items_staff_insert on public.inventory_items for insert to authenticated
  with check (public.is_any_staff() and coalesce(portfolio_id, public.current_portfolio_id()) = public.current_portfolio_id());
drop policy if exists inventory_items_staff_update on public.inventory_items;
create policy inventory_items_staff_update on public.inventory_items for update to authenticated
  using (public.is_any_staff() and portfolio_id = public.current_portfolio_id())
  with check (public.is_any_staff() and portfolio_id = public.current_portfolio_id());

drop policy if exists inventory_movements_staff_select on public.inventory_movements;
create policy inventory_movements_staff_select on public.inventory_movements for select to authenticated
  using (public.is_platform_operator() or (public.is_any_staff() and portfolio_id = public.current_portfolio_id()));

-- ------------------------------------------------------------ movements
-- p_quantity is always positive; the kind decides the direction ('adjusted'
-- takes p_direction 'add' or 'remove'). A use can be tied to a work order of
-- an association the caller manages.
create or replace function public.record_inventory_movement(
  p_item_id uuid, p_kind text, p_quantity numeric, p_direction text, p_work_order_id uuid, p_unit_cost numeric, p_note text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  it public.inventory_items;
  wo record;
  v_assoc uuid;
  v_change numeric;
  v_after numeric;
  v_id uuid;
begin
  if not public.is_any_staff() then
    raise exception 'Only staff can record inventory' using errcode = '42501';
  end if;
  select * into it from public.inventory_items where id = p_item_id and archived_at is null for update;
  if it.id is null or it.portfolio_id is distinct from public.current_portfolio_id() then
    raise exception 'Inventory item not found' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Enter a quantity greater than zero' using errcode = '22023';
  end if;
  if p_kind = 'received' then
    v_change := p_quantity;
  elsif p_kind = 'used' then
    v_change := -p_quantity;
  elsif p_kind = 'adjusted' then
    if p_direction not in ('add', 'remove') then
      raise exception 'Choose whether the adjustment adds or removes stock' using errcode = '22023';
    end if;
    v_change := case when p_direction = 'add' then p_quantity else -p_quantity end;
  else
    raise exception 'Unknown inventory movement' using errcode = '22023';
  end if;

  if p_work_order_id is not null then
    if p_kind <> 'used' then
      raise exception 'Only stock used can be tied to a work order' using errcode = '22023';
    end if;
    select w.id, w.association_id, w.portfolio_id into wo from public.work_orders w where w.id = p_work_order_id;
    if wo.id is null or wo.portfolio_id is distinct from it.portfolio_id
       or (wo.association_id is not null and not public.can_manage_association(wo.association_id)) then
      raise exception 'Work order not found' using errcode = '42501';
    end if;
    v_assoc := wo.association_id;
  end if;

  v_after := coalesce(it.quantity_on_hand, 0) + v_change;
  if v_after < 0 then
    raise exception 'Only % on hand — you cannot use or remove more than that', coalesce(it.quantity_on_hand, 0) using errcode = '22023';
  end if;

  perform set_config('app.inventory_movement', 'on', true);
  update public.inventory_items
     set quantity_on_hand = v_after,
         unit_cost = case when p_kind = 'received' and p_unit_cost is not null and p_unit_cost >= 0 then p_unit_cost else unit_cost end
   where id = it.id;
  perform set_config('app.inventory_movement', 'off', true);

  insert into public.inventory_movements (portfolio_id, item_id, kind, quantity_change, quantity_after, unit_cost,
                                          work_order_id, association_id, note, created_by)
  values (it.portfolio_id, it.id, p_kind, v_change, v_after,
          case when p_kind = 'received' and p_unit_cost is not null and p_unit_cost >= 0 then p_unit_cost else it.unit_cost end,
          p_work_order_id, v_assoc, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.record_inventory_movement(uuid, text, numeric, text, uuid, numeric, text) from public, anon;
grant execute on function public.record_inventory_movement(uuid, text, numeric, text, uuid, numeric, text) to authenticated, service_role;
revoke all on function public.inventory_items_guard() from public, anon, authenticated;
revoke all on function public.inventory_items_opening() from public, anon, authenticated;

-- ------------------------------------------------------------ reports
create or replace function public.report_data_inventory_status(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    select i.name as item, i.sku, i.category, i.location, i.unit_of_measure as unit,
           i.quantity_on_hand, i.reorder_point,
           case when i.quantity_on_hand <= 0 then 'Out of stock'
                when i.reorder_point is not null and i.quantity_on_hand <= i.reorder_point then 'Reorder'
                else 'In stock' end as status,
           round(i.unit_cost, 2) as unit_cost,
           round(coalesce(i.unit_cost, 0) * i.quantity_on_hand, 2) as total_value
      from public.inventory_items i
     where i.portfolio_id = p_portfolio_id and i.archived_at is null
     order by i.category nulls last, i.name
  ) r;
$$;

create or replace function public.report_data_inventory_usage(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select m.created_at::date as date, i.name as item, i.category, -m.quantity_change as quantity_used,
           i.unit_of_measure as unit, round(m.unit_cost, 2) as unit_cost,
           round(coalesce(m.unit_cost, 0) * -m.quantity_change, 2) as total_cost,
           a.name as association, w.number as work_order, w.title as work_order_title, m.note,
           coalesce(pr.full_name, pr.email) as recorded_by
      from public.inventory_movements m
      cross join prm
      join public.inventory_items i on i.id = m.item_id
      left join public.work_orders w on w.id = m.work_order_id
      left join public.associations a on a.id = m.association_id
      left join public.profiles pr on pr.id = m.created_by
     where m.portfolio_id = p_portfolio_id and m.kind = 'used'
       and m.created_at::date between prm.df and prm.dt
       and (prm.aid is null or m.association_id = prm.aid)
     order by m.created_at desc
  ) r;
$$;

do $$
declare f text;
begin
  foreach f in array array['report_data_inventory_status', 'report_data_inventory_usage'] loop
    execute format('alter function public.%I(uuid, jsonb) owner to postgres', f);
    execute format('revoke all on function public.%I(uuid, jsonb) from public, anon, authenticated', f);
    execute format('grant execute on function public.%I(uuid, jsonb) to service_role', f);
  end loop;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_dispatch(uuid, text, jsonb)'::regprocedure);
  if def !~ 'case p_slug' then
    raise exception 'inventory_management: report_data_dispatch drifted';
  end if;
  def := regexp_replace(def, 'case p_slug',
    'case p_slug' || chr(10) ||
    '    when ''inventory_status'' then return public.report_data_inventory_status(p_portfolio_id, p_params);' || chr(10) ||
    '    when ''inventory_usage'' then return public.report_data_inventory_usage(p_portfolio_id, p_params);');
  execute def;
end $$;

insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active)
values
  ('inventory_status', 'Inventory Status', 'property_unit', 'Every inventory item: quantity on hand, reorder point, status and value.', '{}', '{}', '{pdf,csv}', true, true),
  ('inventory_usage', 'Inventory Usage', 'property_unit', 'Stock used in the period, with cost and the work order it went to.', '{}', '{}', '{pdf,csv}', true, true);

-- Replaced by Inventory Status / Inventory Usage.
update public.report_definitions set active = false, updated_at = now()
 where portfolio_id is null and slug = 'inventory_ledger';
