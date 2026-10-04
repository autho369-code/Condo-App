-- Codex review of #193: a vendor could move a job they had marked 'done'
-- back to scheduled / in progress, which would also restore their access to
-- the property's site notes (association_vendor_private_vendor_read only
-- grants it on live jobs). A completed job is final for the vendor; staff
-- reopen it. Otherwise the same as the live function.
create or replace function public.work_orders_vendor_update_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare v_status public.work_order_status;
begin
  if auth.uid() is null
     or public.is_platform_operator() or public.is_any_staff() or public.is_company_admin() then
    return new;
  end if;
  v_status := new.status;
  new := old;
  if v_status is distinct from old.status then
    if old.status::text not in ('new', 'assigned', 'scheduled', 'in_progress')
       or v_status::text not in ('scheduled', 'in_progress', 'done') then
      raise exception 'Vendors can only mark a job scheduled, in progress or complete; a completed job can only be reopened by management' using errcode = '42501';
    end if;
    new.status := v_status;
  end if;
  new.updated_at := now();
  return new;
end $function$;
