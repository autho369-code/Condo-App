-- Staff-only fields were readable by vendors, owners, tenants and board
-- members (their row policies cover whole rows and `authenticated` can select
-- every column): work_orders.internal_notes / withheld_amount_from_owner,
-- calendar_events.internal_notes, and every work_order_updates note (staff
-- notes and "Charged back $X to the homeowner" entries in the vendor portal).
--
-- * Internal work-order and calendar fields move to staff-only side tables.
--   A trigger moves any value written to the old columns, so older writers
--   keep working while the shared rows never carry it.
-- * work_order_updates.staff_only hides staff notes and charge-back entries
--   from vendors.

create table if not exists public.work_order_private (
  work_order_id uuid primary key references public.work_orders(id) on delete cascade deferrable initially deferred,
  internal_notes text,
  withheld_amount_from_owner numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.work_order_private enable row level security;
drop policy if exists work_order_private_staff on public.work_order_private;
create policy work_order_private_staff on public.work_order_private
  for all to authenticated
  using (public.is_any_staff() and exists (
    select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)))
  with check (public.is_any_staff() and exists (
    select 1 from public.work_orders w where w.id = work_order_id and public.can_access_association(w.association_id)));
revoke all on public.work_order_private from anon;
grant select, insert, update, delete on public.work_order_private to authenticated;

create table if not exists public.calendar_event_private (
  calendar_event_id uuid primary key references public.calendar_events(id) on delete cascade deferrable initially deferred,
  internal_notes text,
  updated_at timestamptz not null default now()
);
alter table public.calendar_event_private enable row level security;
drop policy if exists calendar_event_private_staff on public.calendar_event_private;
create policy calendar_event_private_staff on public.calendar_event_private
  for all to authenticated
  using (public.is_any_staff() and exists (
    select 1 from public.calendar_events e where e.id = calendar_event_id and public.can_access_portfolio(e.portfolio_id)))
  with check (public.is_any_staff() and exists (
    select 1 from public.calendar_events e where e.id = calendar_event_id and public.can_access_portfolio(e.portfolio_id)));
revoke all on public.calendar_event_private from anon;
grant select, insert, update, delete on public.calendar_event_private to authenticated;

create or replace function public.move_work_order_private_fields()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.internal_notes is not null or coalesce(new.withheld_amount_from_owner, 0) <> 0 then
    insert into public.work_order_private (work_order_id, internal_notes, withheld_amount_from_owner, updated_at)
    values (new.id, new.internal_notes, coalesce(new.withheld_amount_from_owner, 0), now())
    on conflict (work_order_id) do update
      set internal_notes = coalesce(excluded.internal_notes, public.work_order_private.internal_notes),
          withheld_amount_from_owner = case when excluded.withheld_amount_from_owner <> 0
                                            then excluded.withheld_amount_from_owner
                                            else public.work_order_private.withheld_amount_from_owner end,
          updated_at = now();
    new.internal_notes := null;
    new.withheld_amount_from_owner := 0;
  end if;
  return new;
end;
$$;
revoke all on function public.move_work_order_private_fields() from public, anon, authenticated;
drop trigger if exists work_orders_move_private_fields on public.work_orders;
create trigger work_orders_move_private_fields
  before insert or update of internal_notes, withheld_amount_from_owner on public.work_orders
  for each row execute function public.move_work_order_private_fields();

create or replace function public.move_calendar_event_private_fields()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.internal_notes is not null then
    insert into public.calendar_event_private (calendar_event_id, internal_notes, updated_at)
    values (new.id, new.internal_notes, now())
    on conflict (calendar_event_id) do update set internal_notes = excluded.internal_notes, updated_at = now();
    new.internal_notes := null;
  end if;
  return new;
end;
$$;
revoke all on function public.move_calendar_event_private_fields() from public, anon, authenticated;
drop trigger if exists calendar_events_move_private_fields on public.calendar_events;
create trigger calendar_events_move_private_fields
  before insert or update of internal_notes on public.calendar_events
  for each row execute function public.move_calendar_event_private_fields();

-- Move existing values.
insert into public.work_order_private (work_order_id, internal_notes, withheld_amount_from_owner)
select id, internal_notes, coalesce(withheld_amount_from_owner, 0) from public.work_orders
 where internal_notes is not null or coalesce(withheld_amount_from_owner, 0) <> 0
on conflict (work_order_id) do nothing;
update public.work_orders set internal_notes = null, withheld_amount_from_owner = 0
 where internal_notes is not null or coalesce(withheld_amount_from_owner, 0) <> 0;

insert into public.calendar_event_private (calendar_event_id, internal_notes)
select id, internal_notes from public.calendar_events where internal_notes is not null
on conflict (calendar_event_id) do nothing;
update public.calendar_events set internal_notes = null where internal_notes is not null;

-- Staff-only work-order notes.
alter table public.work_order_updates add column if not exists staff_only boolean not null default false;
update public.work_order_updates set staff_only = true where note like 'Charged back %';
alter policy wo_updates_vendor_read on public.work_order_updates
  using (not staff_only and work_order_id in (select wo.id from public.work_orders wo where wo.vendor_id = public.current_vendor_id()));

do $$
declare
  v_def text;
  v_old constant text := 'insert into public.work_order_updates (work_order_id, note, created_by)
  values (w.id, ''Charged back '' || to_char(v_amount, ''FM$999,999,990.00'') || '' to the homeowner ('' || cat.name || '')'', auth.uid());';
  v_new constant text := 'insert into public.work_order_updates (work_order_id, note, created_by, staff_only)
  values (w.id, ''Charged back '' || to_char(v_amount, ''FM$999,999,990.00'') || '' to the homeowner ('' || cat.name || '')'', auth.uid(), true);';
begin
  select pg_get_functiondef('public.charge_back_work_order(uuid,uuid,numeric,text,date)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'charge_back_work_order does not contain the expected note insert';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
