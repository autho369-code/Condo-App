-- Review fixes for maintenance photos + chargebacks:
-- 1. A chargeback only posts when the work order's unit really belongs to the
--    work order's association (permission and category checks run against
--    that association, so a mismatched unit could otherwise be charged in a
--    different association's ledger).
-- 2. A vendor inherits visibility only of the RESIDENT'S request-level files,
--    not of files on sibling work orders assigned to other vendors.
do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.charge_back_work_order(uuid, uuid, numeric, text, date)'::regprocedure) into v_def;
  v_old := '  if p_amount is null or p_amount <= 0 then';
  if position(v_old in v_def) = 0 then raise exception 'chargeback anchor not found'; end if;
  execute replace(v_def, v_old,
    '  if not exists (select 1 from public.units u join public.buildings b on b.id = u.building_id' || chr(10)
    || '                 where u.id = w.unit_id and b.association_id = w.association_id) then' || chr(10)
    || '    raise exception ''This work order''''s unit is not in its association — fix the work order first'' using errcode = ''22023'';' || chr(10)
    || '  end if;' || chr(10)
    || v_old);
end $$;

drop policy if exists maintenance_attachments_vendor_read on public.maintenance_attachments;
create policy maintenance_attachments_vendor_read on public.maintenance_attachments
  for select to authenticated
  using (
    public.current_vendor_id() is not null
    and exists (select 1 from public.work_orders w
                 where w.vendor_id = public.current_vendor_id()
                   and w.archived_at is null
                   -- Columns are table-qualified: work_orders also has a
                   -- service_request_id, which an unqualified name would bind to.
                   and (w.id = maintenance_attachments.work_order_id
                        or (maintenance_attachments.work_order_id is null
                            and maintenance_attachments.service_request_id is not null
                            and w.service_request_id = maintenance_attachments.service_request_id)))
  );
