-- Review fixes for smart intake:
-- 1. Clearing a false duplicate flag or changing a request's type is
--    housekeeping, not a response to the resident — it no longer stops the
--    first-response clock. (Acknowledge, reply, triage and merge still do.)
-- 2. Creating a work order from a request whose earlier work orders are all
--    finished or cancelled now creates a new one instead of returning the old
--    closed order. An open work order is still reused (double-click safe).
create or replace function public.clear_service_request_duplicate(p_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests;
begin
  v := public.service_request_staff_scope(p_id);
  update public.service_requests
     set duplicate_of = null, duplicate_score = null, duplicate_reviewed = true, updated_at = now()
   where id = p_id;
end $$;

create or replace function public.reclassify_service_request(p_id uuid, p_kind text, p_topic text, p_category public.work_order_category)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests;
begin
  v := public.service_request_staff_scope(p_id);
  if p_kind not in ('maintenance', 'admin') then raise exception 'Unknown request type' using errcode = '22023'; end if;
  if p_kind = 'admin' and (p_topic is null or p_topic not in ('account', 'documents', 'insurance', 'move', 'access', 'governance')) then
    raise exception 'Pick what the question is about' using errcode = '22023';
  end if;
  update public.service_requests
     set request_kind = p_kind,
         admin_topic = case when p_kind = 'admin' then p_topic end,
         category = case when p_kind = 'admin' then 'other' else coalesce(p_category, category, 'general_repair') end,
         updated_at = now()
   where id = p_id;
end $$;

do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.triage_service_request_to_work_order(uuid)'::regprocedure) into v_def;
  v_old := E'  where wo.service_request_id = v_request.id\n    and wo.archived_at is null\n';
  if position(v_old in v_def) = 0 then raise exception 'triage reuse anchor not found'; end if;
  execute replace(v_def, v_old,
    E'  where wo.service_request_id = v_request.id\n    and wo.archived_at is null\n'
    || E'    and wo.status not in (''done'', ''completed'', ''billed'', ''closed'', ''cancelled'')\n');
end $$;
