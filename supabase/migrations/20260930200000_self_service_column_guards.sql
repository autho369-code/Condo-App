-- Security sweep: several non-staff UPDATE/ALL policies allowed far more than
-- the portals ever write, because RLS limits rows, not columns.
--   * lock_boxes / lock_box_assignments: ANY profile in the company (owners,
--     tenants, vendors, board) could read, create, edit and delete them —
--     including lock_boxes.combination. Now staff / company admins / operators
--     only.
--   * occupancies: an owner could set their own dues_amount, late-fee
--     exemption/overrides, collections flags… Owners may only change
--     move_in_date / move_out_date (the /portal/lease form).
--   * owners: owners may only change their own contact fields (the
--     /portal/profile form and emergency contact), not portal_activated,
--     portfolio_id, notes, archived_at, auth_user_id…
--   * vendors: vendors may only change their contact fields (/vendor/profile).
--   * insurance_policies: owners may only change their reminder switches
--     (status, extraction results and reminder stamps stay staff/system-owned).
--   * work_order_estimates / work_order_labor_entries: vendors had full write
--     (a vendor could approve its own estimate or log labor that credits a
--     staff member); no vendor screen writes them — vendors can now only read.
--   * inspections: an assigned vendor inspector may only change status, notes
--     and completed_date.
-- Staff, company admins, platform operators and service-role jobs are not
-- affected by any of the guards.

create or replace function public.is_self_service_caller()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null
     and not (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin());
$$;
revoke all on function public.is_self_service_caller() from public, anon, authenticated;

-- Lock boxes: staff only.
drop policy if exists lock_boxes_staff_only on public.lock_boxes;
create policy lock_boxes_staff_only on public.lock_boxes as restrictive for all to authenticated
  using (not public.is_self_service_caller()) with check (not public.is_self_service_caller());
drop policy if exists lock_box_assignments_staff_only on public.lock_box_assignments;
create policy lock_box_assignments_staff_only on public.lock_box_assignments as restrictive for all to authenticated
  using (not public.is_self_service_caller()) with check (not public.is_self_service_caller());

-- Occupancies: move dates only.
create or replace function public.occupancies_self_service_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_in date; v_out date;
begin
  -- Changes made inside another trigger (e.g. linking a portal login on sign-in) are system changes.
  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;
  v_in := new.move_in_date; v_out := new.move_out_date;
  new := old;
  new.move_in_date := v_in; new.move_out_date := v_out; new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_occupancies_000_self_service_guard on public.occupancies;
create trigger trg_occupancies_000_self_service_guard before update on public.occupancies
  for each row execute function public.occupancies_self_service_guard();

-- Owners: contact fields only.
create or replace function public.owners_self_service_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare n public.owners;
begin
  -- Changes made inside another trigger (e.g. linking a portal login on sign-in) are system changes.
  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;
  n := new;
  new := old;
  new.phone := n.phone; new.email := n.email; new.phone_numbers := n.phone_numbers; new.emails := n.emails;
  new.mailing_address := n.mailing_address; new.address_street := n.address_street; new.address_city := n.address_city;
  new.address_state := n.address_state; new.address_zip := n.address_zip;
  new.preferred_comm := n.preferred_comm; new.electronic_consent := n.electronic_consent;
  new.electronic_consent_date := n.electronic_consent_date;
  new.emergency_contact_name := n.emergency_contact_name; new.emergency_contact_phone := n.emergency_contact_phone;
  return new;
end $$;
drop trigger if exists trg_owners_000_self_service_guard on public.owners;
create trigger trg_owners_000_self_service_guard before update on public.owners
  for each row execute function public.owners_self_service_guard();

-- Vendors: contact fields only.
create or replace function public.vendors_self_service_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare n public.vendors;
begin
  -- Changes made inside another trigger (e.g. linking a portal login on sign-in) are system changes.
  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;
  n := new;
  new := old;
  new.phone_numbers := n.phone_numbers; new.emails := n.emails;
  new.address_street := n.address_street; new.address_city := n.address_city;
  new.address_state := n.address_state; new.address_zip := n.address_zip;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_vendors_000_self_service_guard on public.vendors;
create trigger trg_vendors_000_self_service_guard before update on public.vendors
  for each row execute function public.vendors_self_service_guard();

-- Insurance: reminder switches only.
create or replace function public.insurance_policies_self_service_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_owner boolean; v_manager boolean;
begin
  -- Changes made inside another trigger (e.g. linking a portal login on sign-in) are system changes.
  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;
  v_owner := new.remind_owner; v_manager := new.remind_manager;
  new := old;
  new.remind_owner := v_owner; new.remind_manager := v_manager; new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_insurance_policies_000_self_service_guard on public.insurance_policies;
create trigger trg_insurance_policies_000_self_service_guard before update on public.insurance_policies
  for each row execute function public.insurance_policies_self_service_guard();

-- Inspections: an assigned vendor inspector reports status, notes, completion.
create or replace function public.inspections_self_service_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare n public.inspections;
begin
  -- Changes made inside another trigger (e.g. linking a portal login on sign-in) are system changes.
  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;
  n := new;
  new := old;
  new.status := n.status; new.notes := n.notes; new.completed_date := n.completed_date; new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_inspections_000_self_service_guard on public.inspections;
create trigger trg_inspections_000_self_service_guard before update on public.inspections
  for each row execute function public.inspections_self_service_guard();

-- Estimates and labor: vendors read only.
drop policy if exists estimates_vendor_rw on public.work_order_estimates;
drop policy if exists estimates_vendor_read on public.work_order_estimates;
create policy estimates_vendor_read on public.work_order_estimates for select to authenticated
  using (vendor_id = public.current_vendor_id());
drop policy if exists labor_entries_vendor_rw on public.work_order_labor_entries;
drop policy if exists labor_entries_vendor_read on public.work_order_labor_entries;
create policy labor_entries_vendor_read on public.work_order_labor_entries for select to authenticated
  using (work_order_id in (select w.id from public.work_orders w where w.vendor_id = public.current_vendor_id()));
