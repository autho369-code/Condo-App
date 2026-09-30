-- Security sweep (follow-up to self_service_column_guards): remaining
-- non-staff write policies that allowed more than the portal needs.
-- RLS limits rows, not columns, so each gets a column guard or a narrower policy.
--
-- 1. architectural_requests: an owner withdrawing a request could, in the same
--    UPDATE, rewrite title/description/decision_notes/decided_by. Owners
--    touching their OWN request may now only change status, and only to
--    'withdrawn' — which also stops an owner who sits on the board from
--    deciding their own request through the board policy.
-- 2. amenity_reservations: same for cancelling (times, unit, association
--    could be moved). Owners touching their own reservation may only set
--    status 'cancelled'.
-- 3. work_order_updates: vendors had ALL on every update of their work orders —
--    they could edit or delete staff notes and forge created_by. Vendors may
--    now read and add updates only, as themselves.
-- 4. payment_methods: owners had ALL on their saved methods — they could set
--    is_verified, processor tokens/accounts or association_id. Methods are
--    created by the Stripe webhook (service role) and managed by finance
--    staff; owners now read their own only.

create or replace function public.architectural_requests_owner_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare n public.architectural_requests;
begin
  if pg_trigger_depth() > 1 or not public.is_self_service_caller()
     or old.owner_id is null or old.owner_id is distinct from public.current_owner_id() then
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'withdrawn' then
    raise exception 'You can only withdraw your own request' using errcode = '42501';
  end if;
  n := new;
  new := old;
  new.status := n.status;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_architectural_requests_000_owner_guard on public.architectural_requests;
create trigger trg_architectural_requests_000_owner_guard before update on public.architectural_requests
  for each row execute function public.architectural_requests_owner_guard();

create or replace function public.amenity_reservations_owner_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare n public.amenity_reservations;
begin
  if pg_trigger_depth() > 1 or not public.is_self_service_caller()
     or old.owner_id is null or old.owner_id is distinct from public.current_owner_id() then
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'You can only cancel your own reservation' using errcode = '42501';
  end if;
  n := new;
  new := old;
  new.status := n.status;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_amenity_reservations_000_owner_guard on public.amenity_reservations;
create trigger trg_amenity_reservations_000_owner_guard before update on public.amenity_reservations
  for each row execute function public.amenity_reservations_owner_guard();

drop policy if exists wo_updates_vendor_rw on public.work_order_updates;
drop policy if exists wo_updates_vendor_read on public.work_order_updates;
create policy wo_updates_vendor_read on public.work_order_updates for select to authenticated
  using (work_order_id in (select wo.id from public.work_orders wo where wo.vendor_id = public.current_vendor_id()));
drop policy if exists wo_updates_vendor_insert on public.work_order_updates;
create policy wo_updates_vendor_insert on public.work_order_updates for insert to authenticated
  with check (
    created_by = auth.uid()
    and work_order_id in (select wo.id from public.work_orders wo where wo.vendor_id = public.current_vendor_id())
  );

drop policy if exists payment_methods_owner_self on public.payment_methods;
drop policy if exists payment_methods_owner_read on public.payment_methods;
create policy payment_methods_owner_read on public.payment_methods for select to authenticated
  using (owner_id = public.current_owner_id());
