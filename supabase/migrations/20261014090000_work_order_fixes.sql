-- Work orders deep check (2026-10-13), rolled back on production.
--
-- 1. A service request longer than 2,000 characters could not be turned
--    into a work order: triage copied the full text into
--    work_orders.description (check: length <= 2000). The owner form has no
--    limit and the resident form allows 10,000. The full text still goes to
--    work_orders.issue (no limit); the description is cut to 2,000.
-- 2. An owner could rate a job done before they owned the unit (the rating
--    counts toward the vendor's score) although they cannot see that work
--    order. rate_work_order now applies the owner pages' rule: only work
--    orders created on or after the owner's move-in date.
-- 3. A vendor could add a timeline entry with any new_status (a "Completed"
--    entry on a job still in progress). A vendor's entry may now carry only
--    the status the work order really has (the vendor page logs the entry
--    after the status change applies) or none.
-- Functions are patched in place (old text must match once); the policy is
-- altered in place.

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.triage_service_request_to_work_order(uuid)'::regprocedure);
  v_old := $o$    v_request.description,
    v_request.description,
    coalesce(v_request.category, 'general_repair'),$o$;
  v_new := $n$    v_request.description,
    left(v_request.description, 2000),
    coalesce(v_request.category, 'general_repair'),$n$;
  if position('left(v_request.description, 2000)' in v_def) = 0 then
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'triage_service_request_to_work_order: description block not found exactly once';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  v_def := pg_get_functiondef('public.rate_work_order(uuid, integer, integer, integer, integer, boolean, text)'::regprocedure);
  v_old := $o$  select w.id, w.status::text as status, w.vendor_id, w.unit_id, w.association_id,$o$;
  v_new := $n$  select w.id, w.status::text as status, w.vendor_id, w.unit_id, w.association_id, w.created_at,$n$;
  if position('w.association_id, w.created_at,' in v_def) = 0 then
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'rate_work_order: select block not found exactly once';
    end if;
    v_def := replace(v_def, v_old, v_new);
    v_old := $o$             and o.status = 'current'::public.occupancy_status) then
    v_role := 'owner';$o$;
    v_new := $n$             and o.status = 'current'::public.occupancy_status)
        and (public.current_resident_unit_since(wo.unit_id) is null
             or wo.created_at::date >= public.current_resident_unit_since(wo.unit_id)) then
    v_role := 'owner';$n$;
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'rate_work_order: owner block not found exactly once';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end
$$;

-- The status of a work order assigned to one of the caller's vendor records
-- (null otherwise).
create or replace function rls_private.vendor_work_order_status(p_work_order_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return (select wo.status::text from public.work_orders wo
           where wo.id = p_work_order_id
             and wo.vendor_id in (select public.current_vendor_ids()));
end
$$;

revoke all on function rls_private.vendor_work_order_status(uuid) from public, anon;
grant execute on function rls_private.vendor_work_order_status(uuid) to authenticated;

alter policy wo_updates_vendor_insert on public.work_order_updates
  with check ((created_by = (select auth.uid()))
              and (work_order_id in (select wo.id from public.work_orders wo
                                      where wo.vendor_id in (select public.current_vendor_ids())))
              and (new_status is null or new_status::text = rls_private.vendor_work_order_status(work_order_id)));
