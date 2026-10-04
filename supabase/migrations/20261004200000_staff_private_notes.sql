-- Staff-only columns move off rows that owners, tenants, board members or
-- vendors can read through RLS (PostgREST returns whole rows), into side
-- tables only staff can read -- the pattern of owner_private,
-- work_order_private and calendar_event_private.
--
-- For each side table:
--   * one row per parent row, keyed by the parent id (on delete cascade). The
--     foreign key is deferred, like work_order_private's, so the BEFORE INSERT
--     trigger can file the private row before the parent row is written; this
--     avoids a follow-up UPDATE of the parent (which would re-run the parent's
--     update triggers -- GL posting on payments, webhooks, unit counts).
--   * RLS: one staff policy with the same scope staff have on the parent
--     table (plus can_view_association_row where the parent has the
--     mgr_assoc_scope restrictive policy). Two vendor-facing tables also get a
--     vendor SELECT policy (see each section).
--   * a BEFORE INSERT OR UPDATE OF <cols> trigger: a non-null value moves to
--     the side table (blank text clears it) and the parent column is nulled,
--     so existing writers keep working and the parent column stays empty.
--     A NULL leaves the stored value alone (as in owner_private), so screens
--     that can clear a value write the side table directly. On UPDATE by a
--     non-staff caller (owner, tenant, board, vendor) the value is dropped
--     instead of moved, so nobody outside management can change it, even if
--     a parent-row guard trigger is missing or runs later.
--
-- Production on 2026-10-04 had 0 non-null values in every moved column
-- (checked with read-only counts); the backfill at the end is for any
-- environment that does.
--
-- calendar_events.internal_notes needs nothing here: calendar_event_private
-- and the calendar_events_move_private_fields trigger (BEFORE INSERT OR
-- UPDATE OF internal_notes, nulls the column) are already live, and the
-- column holds 0 non-null values.
--
-- Kept on purpose: vendors.default_check_memo is the memo printed on checks
-- paid to that vendor (vendor-facing by definition, and not a note about
-- anyone); it stays on vendors.

-- ── unit_private ──────────────────────────────────────────────────────────
-- units.notes ("Internal notes" on the new-unit form). Owners, board, tenants and assigned vendors read unit rows.
create table if not exists public.unit_private (
  unit_id uuid primary key references public.units(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.unit_private enable row level security;
revoke all on public.unit_private from anon;
grant select, insert, update, delete on public.unit_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'unit_private' and policyname = 'unit_private_staff') then
    create policy unit_private_staff on public.unit_private
      for all to authenticated
      using (exists (
        select 1 from public.units u
         where u.id = unit_private.unit_id
           and exists (select 1 from public.buildings b
                        where b.id = u.building_id
                          and public.can_access_association(b.association_id)
                          and public.can_view_association_row(b.association_id))))
      with check (exists (
        select 1 from public.units u
         where u.id = unit_private.unit_id
           and exists (select 1 from public.buildings b
                        where b.id = u.building_id
                          and public.can_access_association(b.association_id)
                          and public.can_view_association_row(b.association_id))));
  end if;
end $$;

create or replace function public.move_unit_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.unit_private (unit_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (unit_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_unit_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'units_move_private_fields' and tgrelid = 'public.units'::regclass) then
    create trigger units_move_private_fields before insert or update of notes on public.units
      for each row execute function public.move_unit_private_fields();
  end if;
end $$;

-- ── payment_private ───────────────────────────────────────────────────────
-- payments.notes (staff memo on a recorded payment or credit). Owners and board read payment rows, and receivable_payments_ledger exposes the column.
create table if not exists public.payment_private (
  payment_id uuid primary key references public.payments(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.payment_private enable row level security;
revoke all on public.payment_private from anon;
grant select, insert, update, delete on public.payment_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_private' and policyname = 'payment_private_staff') then
    create policy payment_private_staff on public.payment_private
      for all to authenticated
      using (exists (
        select 1 from public.payments p
         where p.id = payment_private.payment_id
           and (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(p.unit_id)))))
      with check (exists (
        select 1 from public.payments p
         where p.id = payment_private.payment_id
           and (public.is_platform_operator() or (public.is_finance_staff() and public.can_access_unit(p.unit_id)))));
  end if;
end $$;

create or replace function public.move_payment_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.payment_private (payment_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (payment_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_payment_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'payments_move_private_fields' and tgrelid = 'public.payments'::regclass) then
    create trigger payments_move_private_fields before insert or update of notes on public.payments
      for each row execute function public.move_payment_private_fields();
  end if;
end $$;

-- ── vendor_private ────────────────────────────────────────────────────────
-- vendors.notes ("Internal notes") and vendors.auto_pay_notes (ACH review notes). The vendor reads its own row and board members read vendors on their work orders.
create table if not exists public.vendor_private (
  vendor_id uuid primary key references public.vendors(id) on delete cascade deferrable initially deferred,
  notes text,
  auto_pay_notes text,
  updated_at timestamptz not null default now()
);

alter table public.vendor_private enable row level security;
revoke all on public.vendor_private from anon;
grant select, insert, update, delete on public.vendor_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendor_private' and policyname = 'vendor_private_staff') then
    create policy vendor_private_staff on public.vendor_private
      for all to authenticated
      using (exists (
        select 1 from public.vendors v
         where v.id = vendor_private.vendor_id
           and public.can_access_portfolio(v.portfolio_id)))
      with check (exists (
        select 1 from public.vendors v
         where v.id = vendor_private.vendor_id
           and public.can_access_portfolio(v.portfolio_id)));
  end if;
end $$;

create or replace function public.move_vendor_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    new.auto_pay_notes := null;
    return new;
  end if;
  if new.notes is not null or new.auto_pay_notes is not null then
    insert into public.vendor_private (vendor_id, notes, auto_pay_notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), nullif(btrim(new.auto_pay_notes), ''), now())
    on conflict (vendor_id) do update set
      notes = case when new.notes is not null then excluded.notes else public.vendor_private.notes end,
      auto_pay_notes = case when new.auto_pay_notes is not null then excluded.auto_pay_notes else public.vendor_private.auto_pay_notes end,
      updated_at = now();
    new.notes := null;
    new.auto_pay_notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_vendor_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'vendors_move_private_fields' and tgrelid = 'public.vendors'::regclass) then
    create trigger vendors_move_private_fields before insert or update of notes, auto_pay_notes on public.vendors
      for each row execute function public.move_vendor_private_fields();
  end if;
end $$;

-- ── tenant_private ────────────────────────────────────────────────────────
-- tenants.notes (staff notes about a resident tenant). The tenant reads its own row and board members read tenants.
create table if not exists public.tenant_private (
  tenant_id uuid primary key references public.tenants(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.tenant_private enable row level security;
revoke all on public.tenant_private from anon;
grant select, insert, update, delete on public.tenant_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tenant_private' and policyname = 'tenant_private_staff') then
    create policy tenant_private_staff on public.tenant_private
      for all to authenticated
      using (exists (
        select 1 from public.tenants t
         where t.id = tenant_private.tenant_id
           and (public.can_access_portfolio(t.portfolio_id) or public.is_platform_operator())
           and public.can_view_association_row(t.association_id)))
      with check (exists (
        select 1 from public.tenants t
         where t.id = tenant_private.tenant_id
           and (public.can_access_portfolio(t.portfolio_id) or public.is_platform_operator())
           and public.can_view_association_row(t.association_id)));
  end if;
end $$;

create or replace function public.move_tenant_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.tenant_private (tenant_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (tenant_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_tenant_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tenants_move_private_fields' and tgrelid = 'public.tenants'::regclass) then
    create trigger tenants_move_private_fields before insert or update of notes on public.tenants
      for each row execute function public.move_tenant_private_fields();
  end if;
end $$;

-- ── association_private ───────────────────────────────────────────────────
-- associations.management_end_reason (why management of the association ended). Everyone in the association reads the association row.
create table if not exists public.association_private (
  association_id uuid primary key references public.associations(id) on delete cascade deferrable initially deferred,
  management_end_reason text,
  updated_at timestamptz not null default now()
);

alter table public.association_private enable row level security;
revoke all on public.association_private from anon;
grant select, insert, update, delete on public.association_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'association_private' and policyname = 'association_private_staff') then
    create policy association_private_staff on public.association_private
      for all to authenticated
      using (exists (
        select 1 from public.associations a
         where a.id = association_private.association_id
           and public.can_access_portfolio(a.portfolio_id)
           and public.can_view_association_row(a.id)))
      with check (exists (
        select 1 from public.associations a
         where a.id = association_private.association_id
           and public.can_access_portfolio(a.portfolio_id)
           and public.can_view_association_row(a.id)));
  end if;
end $$;

-- ── association_vendor_private ────────────────────────────────────────────
-- associations.maintenance_notes: management's access and site notes for maintenance vendors (shown on the vendor portal's Properties page). Vendors with a work order at the association keep reading them (same rule as associations_vendor_read); owners, board and tenants no longer can.
create table if not exists public.association_vendor_private (
  association_id uuid primary key references public.associations(id) on delete cascade deferrable initially deferred,
  maintenance_notes text,
  updated_at timestamptz not null default now()
);

alter table public.association_vendor_private enable row level security;
revoke all on public.association_vendor_private from anon;
grant select, insert, update, delete on public.association_vendor_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'association_vendor_private' and policyname = 'association_vendor_private_staff') then
    create policy association_vendor_private_staff on public.association_vendor_private
      for all to authenticated
      using (exists (
        select 1 from public.associations a
         where a.id = association_vendor_private.association_id
           and public.can_access_portfolio(a.portfolio_id)
           and public.can_view_association_row(a.id)))
      with check (exists (
        select 1 from public.associations a
         where a.id = association_vendor_private.association_id
           and public.can_access_portfolio(a.portfolio_id)
           and public.can_view_association_row(a.id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'association_vendor_private' and policyname = 'association_vendor_private_vendor_read') then
    create policy association_vendor_private_vendor_read on public.association_vendor_private
      for select to authenticated
      using (public.current_vendor_id() is not null
        and association_vendor_private.association_id in (
          select wo.association_id from public.work_orders wo
           where wo.vendor_id = public.current_vendor_id() and wo.association_id is not null));
  end if;
end $$;

-- ── building_private ──────────────────────────────────────────────────────
-- buildings.maintenance_notes (staff notes entered when a building is created). Owners, board and tenants read building rows.
create table if not exists public.building_private (
  building_id uuid primary key references public.buildings(id) on delete cascade deferrable initially deferred,
  maintenance_notes text,
  updated_at timestamptz not null default now()
);

alter table public.building_private enable row level security;
revoke all on public.building_private from anon;
grant select, insert, update, delete on public.building_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'building_private' and policyname = 'building_private_staff') then
    create policy building_private_staff on public.building_private
      for all to authenticated
      using (exists (
        select 1 from public.buildings b
         where b.id = building_private.building_id
           and public.can_access_association(b.association_id)
           and public.can_view_association_row(b.association_id)))
      with check (exists (
        select 1 from public.buildings b
         where b.id = building_private.building_id
           and public.can_access_association(b.association_id)
           and public.can_view_association_row(b.association_id)));
  end if;
end $$;

create or replace function public.move_building_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.maintenance_notes := null;
    return new;
  end if;
  if new.maintenance_notes is not null then
    insert into public.building_private (building_id, maintenance_notes, updated_at)
    values (new.id, nullif(btrim(new.maintenance_notes), ''), now())
    on conflict (building_id) do update set
      maintenance_notes = excluded.maintenance_notes,
      updated_at = now();
    new.maintenance_notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_building_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'buildings_move_private_fields' and tgrelid = 'public.buildings'::regclass) then
    create trigger buildings_move_private_fields before insert or update of maintenance_notes on public.buildings
      for each row execute function public.move_building_private_fields();
  end if;
end $$;

-- ── payment_plan_private ──────────────────────────────────────────────────
-- payment_plans.notes (staff notes on a payment plan). The owner reads the plan row.
create table if not exists public.payment_plan_private (
  payment_plan_id uuid primary key references public.payment_plans(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.payment_plan_private enable row level security;
revoke all on public.payment_plan_private from anon;
grant select, insert, update, delete on public.payment_plan_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_plan_private' and policyname = 'payment_plan_private_staff') then
    create policy payment_plan_private_staff on public.payment_plan_private
      for all to authenticated
      using (exists (
        select 1 from public.payment_plans pp
         where pp.id = payment_plan_private.payment_plan_id
           and public.can_manage_association(pp.association_id)))
      with check (exists (
        select 1 from public.payment_plans pp
         where pp.id = payment_plan_private.payment_plan_id
           and public.can_manage_association(pp.association_id)));
  end if;
end $$;

create or replace function public.move_payment_plan_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.payment_plan_private (payment_plan_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (payment_plan_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_payment_plan_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'payment_plans_move_private_fields' and tgrelid = 'public.payment_plans'::regclass) then
    create trigger payment_plans_move_private_fields before insert or update of notes on public.payment_plans
      for each row execute function public.move_payment_plan_private_fields();
  end if;
end $$;

-- ── purchase_order_private ────────────────────────────────────────────────
-- purchase_orders.notes ("Internal notes" on the PO form, shown to staff as "Internal:"). The vendor reads approved POs.
create table if not exists public.purchase_order_private (
  purchase_order_id uuid primary key references public.purchase_orders(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.purchase_order_private enable row level security;
revoke all on public.purchase_order_private from anon;
grant select, insert, update, delete on public.purchase_order_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'purchase_order_private' and policyname = 'purchase_order_private_staff') then
    create policy purchase_order_private_staff on public.purchase_order_private
      for all to authenticated
      using (exists (
        select 1 from public.purchase_orders po
         where po.id = purchase_order_private.purchase_order_id
           and public.can_access_portfolio(po.portfolio_id)
           and public.can_view_association_row(po.association_id)))
      with check (exists (
        select 1 from public.purchase_orders po
         where po.id = purchase_order_private.purchase_order_id
           and public.can_access_portfolio(po.portfolio_id)
           and public.can_view_association_row(po.association_id)));
  end if;
end $$;

create or replace function public.move_purchase_order_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.purchase_order_private (purchase_order_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (purchase_order_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_purchase_order_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'purchase_orders_move_private_fields' and tgrelid = 'public.purchase_orders'::regclass) then
    create trigger purchase_orders_move_private_fields before insert or update of notes on public.purchase_orders
      for each row execute function public.move_purchase_order_private_fields();
  end if;
end $$;

-- ── maintenance_task_private ──────────────────────────────────────────────
-- maintenance_tasks.notes ("Internal notes": special instructions, access codes). Owners, board and the assigned vendor read task rows.
create table if not exists public.maintenance_task_private (
  maintenance_task_id uuid primary key references public.maintenance_tasks(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.maintenance_task_private enable row level security;
revoke all on public.maintenance_task_private from anon;
grant select, insert, update, delete on public.maintenance_task_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'maintenance_task_private' and policyname = 'maintenance_task_private_staff') then
    create policy maintenance_task_private_staff on public.maintenance_task_private
      for all to authenticated
      using (exists (
        select 1 from public.maintenance_tasks mt
         where mt.id = maintenance_task_private.maintenance_task_id
           and (public.is_platform_operator()
                or ((public.is_any_staff() or public.is_company_admin()) and public.can_access_association(mt.association_id)))))
      with check (exists (
        select 1 from public.maintenance_tasks mt
         where mt.id = maintenance_task_private.maintenance_task_id
           and (public.is_platform_operator()
                or ((public.is_any_staff() or public.is_company_admin()) and public.can_access_association(mt.association_id)))));
  end if;
end $$;

create or replace function public.move_maintenance_task_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.maintenance_task_private (maintenance_task_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (maintenance_task_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_maintenance_task_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'maintenance_tasks_move_private_fields' and tgrelid = 'public.maintenance_tasks'::regclass) then
    create trigger maintenance_tasks_move_private_fields before insert or update of notes on public.maintenance_tasks
      for each row execute function public.move_maintenance_task_private_fields();
  end if;
end $$;

-- ── occupancy_private ─────────────────────────────────────────────────────
-- occupancies.late_fee_override_reason (why finance waived or changed the late fee). The owner and board read occupancy rows.
create table if not exists public.occupancy_private (
  occupancy_id uuid primary key references public.occupancies(id) on delete cascade deferrable initially deferred,
  late_fee_override_reason text,
  updated_at timestamptz not null default now()
);

alter table public.occupancy_private enable row level security;
revoke all on public.occupancy_private from anon;
grant select, insert, update, delete on public.occupancy_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'occupancy_private' and policyname = 'occupancy_private_staff') then
    create policy occupancy_private_staff on public.occupancy_private
      for all to authenticated
      using (exists (
        select 1 from public.occupancies o
         where o.id = occupancy_private.occupancy_id
           and public.can_access_association(o.association_id)
           and public.can_view_association_row(o.association_id)))
      with check (exists (
        select 1 from public.occupancies o
         where o.id = occupancy_private.occupancy_id
           and public.can_access_association(o.association_id)
           and public.can_view_association_row(o.association_id)));
  end if;
end $$;

create or replace function public.move_occupancy_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.late_fee_override_reason := null;
    return new;
  end if;
  if new.late_fee_override_reason is not null then
    insert into public.occupancy_private (occupancy_id, late_fee_override_reason, updated_at)
    values (new.id, nullif(btrim(new.late_fee_override_reason), ''), now())
    on conflict (occupancy_id) do update set
      late_fee_override_reason = excluded.late_fee_override_reason,
      updated_at = now();
    new.late_fee_override_reason := null;
  end if;
  return new;
end $$;

revoke all on function public.move_occupancy_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'occupancies_move_private_fields' and tgrelid = 'public.occupancies'::regclass) then
    create trigger occupancies_move_private_fields before insert or update of late_fee_override_reason on public.occupancies
      for each row execute function public.move_occupancy_private_fields();
  end if;
end $$;

-- ── work_order_vendor_private ─────────────────────────────────────────────
-- work_orders.vendor_instructions: meant for the assigned vendor only. Owners, residents, tenants and board members read work order rows. Kept apart from work_order_private (internal notes, withheld amount), which the vendor must not read.
create table if not exists public.work_order_vendor_private (
  work_order_id uuid primary key references public.work_orders(id) on delete cascade deferrable initially deferred,
  vendor_instructions text,
  updated_at timestamptz not null default now()
);

alter table public.work_order_vendor_private enable row level security;
revoke all on public.work_order_vendor_private from anon;
grant select, insert, update, delete on public.work_order_vendor_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'work_order_vendor_private' and policyname = 'work_order_vendor_private_staff') then
    create policy work_order_vendor_private_staff on public.work_order_vendor_private
      for all to authenticated
      using (exists (
        select 1 from public.work_orders w
         where w.id = work_order_vendor_private.work_order_id
           and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
           and public.can_access_association(w.association_id)
           and public.can_view_association_row(w.association_id)))
      with check (exists (
        select 1 from public.work_orders w
         where w.id = work_order_vendor_private.work_order_id
           and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
           and public.can_access_association(w.association_id)
           and public.can_view_association_row(w.association_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'work_order_vendor_private' and policyname = 'work_order_vendor_private_vendor_read') then
    create policy work_order_vendor_private_vendor_read on public.work_order_vendor_private
      for select to authenticated
      using (exists (
        select 1 from public.work_orders w
         where w.id = work_order_vendor_private.work_order_id
           and w.vendor_id = public.current_vendor_id()));
  end if;
end $$;

create or replace function public.move_work_order_vendor_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.vendor_instructions := null;
    return new;
  end if;
  if new.vendor_instructions is not null then
    insert into public.work_order_vendor_private (work_order_id, vendor_instructions, updated_at)
    values (new.id, nullif(btrim(new.vendor_instructions), ''), now())
    on conflict (work_order_id) do update set
      vendor_instructions = excluded.vendor_instructions,
      updated_at = now();
    new.vendor_instructions := null;
  end if;
  return new;
end $$;

revoke all on function public.move_work_order_vendor_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'work_orders_move_vendor_private_fields' and tgrelid = 'public.work_orders'::regclass) then
    create trigger work_orders_move_vendor_private_fields before insert or update of vendor_instructions on public.work_orders
      for each row execute function public.move_work_order_vendor_private_fields();
  end if;
end $$;

-- ── associations trigger (both side tables) ──────────────────────────────
create or replace function public.move_association_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and public.is_self_service_caller() then
    -- Owners, tenants, board members and vendors never write management's notes.
    new.management_end_reason := null;
    new.maintenance_notes := null;
    return new;
  end if;
  if new.management_end_reason is not null then
    insert into public.association_private (association_id, management_end_reason, updated_at)
    values (new.id, nullif(btrim(new.management_end_reason), ''), now())
    on conflict (association_id) do update set
      management_end_reason = excluded.management_end_reason,
      updated_at = now();
    new.management_end_reason := null;
  end if;
  if new.maintenance_notes is not null then
    insert into public.association_vendor_private (association_id, maintenance_notes, updated_at)
    values (new.id, nullif(btrim(new.maintenance_notes), ''), now())
    on conflict (association_id) do update set
      maintenance_notes = excluded.maintenance_notes,
      updated_at = now();
    new.maintenance_notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_association_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'associations_move_private_fields' and tgrelid = 'public.associations'::regclass) then
    create trigger associations_move_private_fields before insert or update of management_end_reason, maintenance_notes on public.associations
      for each row execute function public.move_association_private_fields();
  end if;
end $$;

-- ── Backfill ────────────────────────────────────────────────────────────
-- 0 non-null values in production on 2026-10-04 (read-only counts); kept for
-- other environments. The explicit insert runs first; the update then only
-- clears the parent column.
insert into public.unit_private (unit_id, notes)
select id, nullif(btrim(notes), '') from public.units where notes is not null
on conflict (unit_id) do nothing;
insert into public.payment_private (payment_id, notes)
select id, nullif(btrim(notes), '') from public.payments where notes is not null
on conflict (payment_id) do nothing;
insert into public.vendor_private (vendor_id, notes, auto_pay_notes)
select id, nullif(btrim(notes), ''), nullif(btrim(auto_pay_notes), '') from public.vendors where notes is not null or auto_pay_notes is not null
on conflict (vendor_id) do nothing;
insert into public.tenant_private (tenant_id, notes)
select id, nullif(btrim(notes), '') from public.tenants where notes is not null
on conflict (tenant_id) do nothing;
insert into public.association_private (association_id, management_end_reason)
select id, nullif(btrim(management_end_reason), '') from public.associations where management_end_reason is not null
on conflict (association_id) do nothing;
insert into public.association_vendor_private (association_id, maintenance_notes)
select id, nullif(btrim(maintenance_notes), '') from public.associations where maintenance_notes is not null
on conflict (association_id) do nothing;
insert into public.building_private (building_id, maintenance_notes)
select id, nullif(btrim(maintenance_notes), '') from public.buildings where maintenance_notes is not null
on conflict (building_id) do nothing;
insert into public.payment_plan_private (payment_plan_id, notes)
select id, nullif(btrim(notes), '') from public.payment_plans where notes is not null
on conflict (payment_plan_id) do nothing;
insert into public.purchase_order_private (purchase_order_id, notes)
select id, nullif(btrim(notes), '') from public.purchase_orders where notes is not null
on conflict (purchase_order_id) do nothing;
insert into public.maintenance_task_private (maintenance_task_id, notes)
select id, nullif(btrim(notes), '') from public.maintenance_tasks where notes is not null
on conflict (maintenance_task_id) do nothing;
insert into public.occupancy_private (occupancy_id, late_fee_override_reason)
select id, nullif(btrim(late_fee_override_reason), '') from public.occupancies where late_fee_override_reason is not null
on conflict (occupancy_id) do nothing;
insert into public.work_order_vendor_private (work_order_id, vendor_instructions)
select id, nullif(btrim(vendor_instructions), '') from public.work_orders where vendor_instructions is not null
on conflict (work_order_id) do nothing;
update public.units set notes = null where notes is not null;
update public.payments set notes = null where notes is not null;
update public.vendors set notes = null where notes is not null;
update public.vendors set auto_pay_notes = null where auto_pay_notes is not null;
update public.tenants set notes = null where notes is not null;
update public.associations set management_end_reason = null where management_end_reason is not null;
update public.associations set maintenance_notes = null where maintenance_notes is not null;
update public.buildings set maintenance_notes = null where maintenance_notes is not null;
update public.payment_plans set notes = null where notes is not null;
update public.purchase_orders set notes = null where notes is not null;
update public.maintenance_tasks set notes = null where notes is not null;
update public.occupancies set late_fee_override_reason = null where late_fee_override_reason is not null;
update public.work_orders set vendor_instructions = null where vendor_instructions is not null;

-- ── Functions that read or write a moved column ───────────────────────────

-- The late-fee reason is written to occupancy_private directly, so clearing
-- the override (reason NULL) clears the stored reason too. Otherwise the
-- same as the live function.
create or replace function public.set_owner_late_fee_override(p_occupancy_id uuid, p_exempt boolean, p_amount numeric, p_is_percent boolean, p_until date, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare o record; v_portfolio uuid;
begin
  select occ.*, a.portfolio_id as pid into o
    from public.occupancies occ join public.associations a on a.id = occ.association_id
   where occ.id = p_occupancy_id for update of occ;
  if not found or not public.can_manage_finance(o.pid) or not public.can_access_association(o.association_id) then
    raise exception 'Ownership record not found' using errcode = 'P0002';
  end if;
  if p_amount is not null and (p_amount < 0 or (coalesce(p_is_percent, false) and p_amount > 100)) then
    raise exception 'Enter a fee of $0 or more, or a percentage up to 100' using errcode = '22023';
  end if;
  if (coalesce(p_exempt, false) or p_amount is not null) and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the late-fee exception' using errcode = '22023';
  end if;
  if p_until is not null and p_until < current_date then
    raise exception 'The end date must be today or later' using errcode = '22023';
  end if;
  update public.occupancies set
    late_fee_exempt = coalesce(p_exempt, false),
    late_fee_override_amount = case when coalesce(p_exempt, false) then null else p_amount end,
    late_fee_override_is_percent = case when coalesce(p_exempt, false) or p_amount is null then false else coalesce(p_is_percent, false) end,
    late_fee_override_until = case when coalesce(p_exempt, false) or p_amount is not null then p_until end,
    updated_at = now()
  where id = p_occupancy_id;
  -- Staff-only: the reason never sits on the occupancy row owners and board read.
  insert into public.occupancy_private (occupancy_id, late_fee_override_reason, updated_at)
  values (p_occupancy_id,
          case when coalesce(p_exempt, false) or p_amount is not null then nullif(btrim(p_reason), '') end,
          now())
  on conflict (occupancy_id) do update
    set late_fee_override_reason = excluded.late_fee_override_reason, updated_at = now();
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (o.pid, 'owner', o.owner_id, 'late_fee_override_updated', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('occupancy_id', p_occupancy_id, 'unit_id', o.unit_id,
            'before', jsonb_build_object('exempt', o.late_fee_exempt, 'amount', o.late_fee_override_amount, 'is_percent', o.late_fee_override_is_percent, 'until', o.late_fee_override_until),
            'after', jsonb_build_object('exempt', coalesce(p_exempt, false), 'amount', p_amount, 'is_percent', p_is_percent, 'until', p_until, 'reason', p_reason)));
end $function$;

-- Recurring POs copy the source PO's internal notes; read them from
-- purchase_order_private (purchase_orders.notes is now always empty).
-- recurring_purchase_orders is finance-staff only. Otherwise the same as the
-- live function.
create or replace function public.save_recurring_purchase_order(p_source_po_id uuid, p_name text, p_frequency text, p_interval integer, p_start_date date, p_end_date date, p_needed_by_days integer)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  po public.purchase_orders;
  v_lines jsonb;
  v_id uuid;
  v_notes text;
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

  v_notes := coalesce((select pp.notes from public.purchase_order_private pp where pp.purchase_order_id = po.id), po.notes);

  insert into public.recurring_purchase_orders (
    portfolio_id, association_id, vendor_id, name, description, notes, lines, frequency, interval_count,
    start_date, end_date, next_post_date, needed_by_days, source_purchase_order_id, created_by)
  values (
    po.portfolio_id, po.association_id, po.vendor_id, btrim(p_name), po.description, v_notes, v_lines,
    p_frequency::public.recurring_frequency, least(greatest(coalesce(p_interval, 1), 1), 60),
    p_start_date, p_end_date, p_start_date, coalesce(p_needed_by_days, 0), po.id, auth.uid())
  returning id into v_id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (po.portfolio_id, 'recurring_purchase_order', v_id, 'created', auth.uid(),
          jsonb_build_object('name', btrim(p_name), 'frequency', p_frequency, 'source_purchase_order_id', po.id));
  return v_id;
end $function$;
