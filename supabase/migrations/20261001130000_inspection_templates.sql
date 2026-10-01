-- Inspection templates + checklists (AppFolio: inspection templates, bulk-create inspections).
-- A template is a named checklist of (area, item) rows. Creating inspections from it copies
-- the checklist onto each inspection, where the inspector records a condition and note per row.
-- One call can schedule a property-wide inspection or one inspection for every unit.

create table if not exists public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  inspection_type text,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 300),
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inspection_templates enable row level security;
drop policy if exists inspection_templates_staff_read on public.inspection_templates;
create policy inspection_templates_staff_read on public.inspection_templates
  for select to authenticated using (public.is_any_staff() and public.can_access_portfolio(portfolio_id));
-- Writes go through save_inspection_template / archive_inspection_template.

create table if not exists public.inspection_checklist_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  area text,
  item text not null,
  condition text check (condition in ('good', 'fair', 'poor', 'na')),
  note text check (note is null or length(note) <= 1000),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists inspection_checklist_items_inspection_idx
  on public.inspection_checklist_items (inspection_id, sort_order);

alter table public.inspection_checklist_items enable row level security;
-- Same reach as inspection_items: staff through the (association-scoped) inspection row.
drop policy if exists inspection_checklist_items_staff_read on public.inspection_checklist_items;
create policy inspection_checklist_items_staff_read on public.inspection_checklist_items
  for select to authenticated using (exists (
    select 1 from public.inspections i
     where i.id = inspection_checklist_items.inspection_id and public.can_access_portfolio(i.portfolio_id)));
drop policy if exists inspection_checklist_items_vendor_read on public.inspection_checklist_items;
create policy inspection_checklist_items_vendor_read on public.inspection_checklist_items
  for select to authenticated using (inspection_id in (
    select i.id from public.inspections i where i.inspector_vendor_id = public.current_vendor_id()));
-- Writes go through save_inspection_checklist.

alter table public.inspections
  add column if not exists template_id uuid references public.inspection_templates(id) on delete set null;

-- Normalise template items: [{area, item}] with a non-empty item.
create or replace function public.app_inspection_template_items(p_items jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  r jsonb;
  out jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Add at least one checklist item' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p_items) loop
    if length(btrim(coalesce(r ->> 'item', ''))) > 0 then
      out := out || jsonb_build_array(jsonb_build_object(
        'area', nullif(left(btrim(coalesce(r ->> 'area', '')), 200), ''),
        'item', left(btrim(r ->> 'item'), 300)));
    end if;
  end loop;
  if jsonb_array_length(out) = 0 then raise exception 'Add at least one checklist item' using errcode = '22023'; end if;
  if jsonb_array_length(out) > 300 then raise exception 'A template can have at most 300 items' using errcode = '22023'; end if;
  return out;
end $function$;

create or replace function public.save_inspection_template(p_id uuid, p_name text, p_inspection_type text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pid uuid := public.current_portfolio_id();
  v_id uuid := p_id;
  v_items jsonb := public.app_inspection_template_items(p_items);
begin
  if v_pid is null or not public.is_any_staff() or not public.can_access_portfolio(v_pid) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'Name the template' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.inspection_templates (portfolio_id, name, inspection_type, items, created_by)
    values (v_pid, left(btrim(p_name), 200), nullif(left(btrim(coalesce(p_inspection_type, '')), 100), ''), v_items, auth.uid())
    returning id into v_id;
  else
    update public.inspection_templates
       set name = left(btrim(p_name), 200), inspection_type = nullif(left(btrim(coalesce(p_inspection_type, '')), 100), ''),
           items = v_items, updated_at = now()
     where id = v_id and portfolio_id = v_pid and archived_at is null;
    if not found then raise exception 'Template not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $function$;

grant execute on function public.save_inspection_template(uuid, text, text, jsonb) to authenticated;

create or replace function public.archive_inspection_template(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  update public.inspection_templates set archived_at = now(), updated_at = now()
   where id = p_id and archived_at is null and public.is_any_staff() and public.can_access_portfolio(portfolio_id);
  if not found then raise exception 'Template not found' using errcode = 'P0002'; end if;
end $function$;

grant execute on function public.archive_inspection_template(uuid) to authenticated;

-- Schedule inspections from a template: property-wide (no units, p_all_units false),
-- for the listed units, or for every active unit in the association. Returns the count.
create or replace function public.create_inspections_from_template(
  p_template_id uuid, p_association_id uuid, p_unit_ids uuid[], p_all_units boolean,
  p_scheduled_date date, p_inspection_type text, p_notes text)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t public.inspection_templates;
  v_pid uuid;
  v_units uuid[];
  v_unit uuid;
  v_insp uuid;
  n integer := 0;
begin
  select a.portfolio_id into v_pid from public.associations a where a.id = p_association_id and a.archived_at is null;
  if v_pid is null or not public.can_manage_association(p_association_id) then
    raise exception 'Choose an association you manage' using errcode = '42501';
  end if;
  select * into t from public.inspection_templates where id = p_template_id and portfolio_id = v_pid and archived_at is null;
  if not found then raise exception 'Template not found' using errcode = 'P0002'; end if;

  if coalesce(p_all_units, false) then
    select array_agg(u.id order by u.unit_number) into v_units
      from public.units u join public.buildings b on b.id = u.building_id
     where b.association_id = p_association_id and u.archived_at is null;
    if v_units is null then raise exception 'This association has no units' using errcode = '22023'; end if;
  elsif p_unit_ids is not null and cardinality(p_unit_ids) > 0 then
    if exists (select 1 from unnest(p_unit_ids) x(id)
                where not exists (select 1 from public.units u join public.buildings b on b.id = u.building_id
                                   where u.id = x.id and b.association_id = p_association_id and u.archived_at is null)) then
      raise exception 'A unit is not in this association' using errcode = '22023';
    end if;
    v_units := (select array_agg(distinct x) from unnest(p_unit_ids) x);
  else
    v_units := array[null::uuid];
  end if;
  if cardinality(v_units) > 2000 then raise exception 'At most 2,000 inspections at a time' using errcode = '22023'; end if;

  foreach v_unit in array v_units loop
    insert into public.inspections (portfolio_id, association_id, unit_id, inspection_type, scheduled_date, status, notes, created_by, template_id)
    values (v_pid, p_association_id, v_unit, coalesce(nullif(btrim(coalesce(p_inspection_type, '')), ''), t.inspection_type, t.name),
            p_scheduled_date, 'scheduled', nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(), t.id)
    returning id into v_insp;
    insert into public.inspection_checklist_items (inspection_id, area, item, sort_order)
    select v_insp, e ->> 'area', e ->> 'item', o::integer
      from jsonb_array_elements(t.items) with ordinality as x(e, o);
    n := n + 1;
  end loop;
  return n;
end $function$;

grant execute on function public.create_inspections_from_template(uuid, uuid, uuid[], boolean, date, text, text) to authenticated;

-- Record conditions/notes: p_rows = [{id, condition, note}].
create or replace function public.save_inspection_checklist(p_inspection_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_assoc uuid;
  r jsonb;
  v_cond text;
  n integer := 0;
begin
  select i.association_id into v_assoc from public.inspections i where i.id = p_inspection_id and i.archived_at is null;
  if v_assoc is null or not public.can_manage_association(v_assoc) then
    raise exception 'Inspection not found' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_cond := nullif(r ->> 'condition', '');
    if v_cond is not null and v_cond not in ('good', 'fair', 'poor', 'na') then
      raise exception 'Unknown condition' using errcode = '22023';
    end if;
    update public.inspection_checklist_items
       set condition = v_cond, note = nullif(left(btrim(coalesce(r ->> 'note', '')), 1000), ''), updated_at = now()
     where id = nullif(r ->> 'id', '')::uuid and inspection_id = p_inspection_id
       and (condition is distinct from v_cond or note is distinct from nullif(left(btrim(coalesce(r ->> 'note', '')), 1000), ''));
    if found then n := n + 1; end if;
  end loop;
  return n;
end $function$;

grant execute on function public.save_inspection_checklist(uuid, jsonb) to authenticated;
