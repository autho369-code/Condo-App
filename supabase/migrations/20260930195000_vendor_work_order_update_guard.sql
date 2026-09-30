-- Security: the vendor UPDATE policy on work_orders (vendor_id =
-- current_vendor_id()) let an assigned vendor change ANY column of their work
-- order through the Data API — association, unit, internal notes,
-- owner_approved, withheld_amount_from_owner, archived_at, even vendor_id.
-- The vendor portal only ever moves the status forward. For callers who are
-- not staff, every column except status is now kept as it was, and status may
-- only move to scheduled / in progress / done from an open state. (Completion
-- dates and credit are then set by the existing completion trigger.)
-- Named to sort, and therefore fire, before every other work_orders trigger.
create or replace function public.work_orders_vendor_update_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_status public.work_order_status;
begin
  if auth.uid() is null
     or public.is_platform_operator() or public.is_any_staff() or public.is_company_admin() then
    return new;
  end if;
  v_status := new.status;
  new := old;
  if v_status is distinct from old.status then
    if old.status::text not in ('new', 'assigned', 'scheduled', 'in_progress', 'done')
       or v_status::text not in ('scheduled', 'in_progress', 'done') then
      raise exception 'Vendors can only mark a job scheduled, in progress or complete' using errcode = '42501';
    end if;
    new.status := v_status;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_work_order_000_vendor_guard on public.work_orders;
create trigger trg_work_order_000_vendor_guard before update on public.work_orders
  for each row execute function public.work_orders_vendor_update_guard();
