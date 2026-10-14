-- Work order and service request fixes. Re-runnable: every patch of a live
-- function checks the marker 'work_orders_fixes' first and replaces an anchor
-- that must appear exactly once; small helpers are replaced whole.

-- 1. One work order per service request. A request whose work order is
--    finished is not triaged again (the open one is still returned, so a
--    double click lands on it), and the request is completed when its last
--    work order finishes.
do $$
declare
  d text := replace(pg_get_functiondef('public.triage_service_request_to_work_order(uuid)'::regprocedure), chr(13), '');
  a text := E'  if v_work_order_id is not null then\n    return v_work_order_id;\n  end if;\n';
begin
  if position('work_orders_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'triage_service_request_to_work_order: anchor not found exactly once';
  end if;
  execute replace(d, a, a || $new$  -- work_orders_fixes: a finished work order is not replaced by a new one.
  if exists (
    select 1 from public.work_orders wo
     where wo.service_request_id = v_request.id
       and wo.archived_at is null
       and wo.status::text <> 'cancelled'
  ) then
    raise exception 'This request already has a work order' using errcode = '23505';
  end if;
$new$);
end $$;

create or replace function public.work_order_sync_request_triage()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.service_request_id is not null then
    perform public.refresh_service_request_open_work_order(old.service_request_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.service_request_id is not null
     and (tg_op = 'INSERT' or new.service_request_id is distinct from old.service_request_id
          or new.status is distinct from old.status or new.archived_at is distinct from old.archived_at) then
    perform public.refresh_service_request_open_work_order(new.service_request_id);
    -- work_orders_fixes: the request's last work order finished, so the
    -- request is completed (a cancelled work order completes nothing).
    if new.archived_at is null
       and new.status::text in ('done', 'completed', 'billed', 'closed') then
      update public.service_requests s
         set status = 'completed',
             resolved_at = coalesce(s.resolved_at, now())
       where s.id = new.service_request_id
         and s.archived_at is null
         and s.status in ('open', 'waiting')
         and not exists (
           select 1 from public.work_orders w
            where w.service_request_id = s.id
              and w.archived_at is null
              and w.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled'));
    end if;
  end if;
  return null;
end $function$;

-- Requests already in that state (a changed rule rechecks stored statuses).
update public.service_requests s
   set status = 'completed',
       resolved_at = coalesce(s.resolved_at, now())
 where s.archived_at is null
   and s.status in ('open', 'waiting')
   and exists (
     select 1 from public.work_orders w
      where w.service_request_id = s.id
        and w.archived_at is null
        and w.status::text in ('done', 'completed', 'billed', 'closed'))
   and not exists (
     select 1 from public.work_orders w
      where w.service_request_id = s.id
        and w.archived_at is null
        and w.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled'));

-- 3. Permission to enter, for the vendor assigned to the work order only.
--    Staff read it from the service request itself.
create or replace function public.vendor_work_order_permission_to_enter(p_work_order_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if auth.uid() is null or p_work_order_id is null then
    return null;
  end if;
  return (
    select sr.permission_to_enter
      from public.work_orders w
      join public.service_requests sr on sr.id = w.service_request_id
     where w.id = p_work_order_id
       and w.archived_at is null
       and w.vendor_id in (select public.current_vendor_ids())
     limit 1
  );
end $function$;

revoke all on function public.vendor_work_order_permission_to_enter(uuid) from public, anon;
grant execute on function public.vendor_work_order_permission_to_enter(uuid) to authenticated;

-- 7. Dates follow the association's calendar.
--    A request's date is the association's local date, set after the
--    association is known.
do $$
declare
  d text := replace(pg_get_functiondef('public.service_request_intake()'::regprocedure), chr(13), '');
  a1 text := E'    new.created_at := now(); new.created_on := current_date;\n';
  a2 text := E'  if new.number is null and new.portfolio_id is not null then\n';
begin
  if position('work_orders_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'service_request_intake: created_on anchor not found exactly once';
  end if;
  if (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'service_request_intake: number anchor not found exactly once';
  end if;
  d := replace(d, a1, E'    new.created_at := now();\n');
  d := replace(d, a2, $new$  -- work_orders_fixes: the association's own date, once the association is known.
  if (not v_is_staff and auth.uid() is not null) or new.created_on is null or new.created_on = current_date then
    new.created_on := public.association_local_date(new.association_id, coalesce(new.created_at, now()));
  end if;
$new$ || a2);
  execute d;
end $$;

--    Tenure (who lives in a unit today, and since when) uses each
--    association's local date. The time zone is joined once per occupancy
--    or work order of the caller's own units, never looked up per call.
create or replace function public.current_resident_unit_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  -- work_orders_fixes: move-out compared with the association's local date.
  return query
  select o.unit_id from public.occupancies o
    left join public.associations a on a.id = o.association_id
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null
          or o.move_out_date > (now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date);
end
$function$;

create or replace function public.current_resident_unit_since(p_unit uuid)
returns date
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  -- work_orders_fixes: move-out compared with the association's local date.
  return (select s.x from (
  select case when bool_or(o.move_in_date is null) then null else min(o.move_in_date) end
    from public.occupancies o
    left join public.associations a on a.id = o.association_id
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null
          or o.move_out_date > (now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date)
     and o.unit_id = p_unit
  ) s(x) limit 1);
end
$function$;

create or replace function rls_private.resident_unit_tenure()
returns table(unit_id uuid, since date)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  -- work_orders_fixes: move-out compared with the association's local date.
  return query
  select o.unit_id,
         case when bool_or(o.move_in_date is null) then null else min(o.move_in_date) end
    from public.occupancies o
    left join public.associations a on a.id = o.association_id
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null
          or o.move_out_date > (now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date)
   group by o.unit_id;
end
$function$;

create or replace function rls_private.resident_visible_work_order_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  -- work_orders_fixes: a work order's day is its association's local date.
  return query
  select w.id
    from public.work_orders w
    join rls_private.resident_unit_tenure() t on t.unit_id = w.unit_id
    left join public.associations a on a.id = w.association_id
   where t.since is null
      or (w.created_at at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date >= t.since;
end
$function$;

revoke all on function public.current_resident_unit_ids() from public, anon;
revoke all on function public.current_resident_unit_since(uuid) from public, anon;
revoke all on function rls_private.resident_unit_tenure() from public, anon;
revoke all on function rls_private.resident_visible_work_order_ids() from public, anon;
grant execute on function public.current_resident_unit_ids() to authenticated, service_role;
grant execute on function public.current_resident_unit_since(uuid) to authenticated, service_role;
grant execute on function rls_private.resident_unit_tenure() to authenticated;
grant execute on function rls_private.resident_visible_work_order_ids() to authenticated;

do $$
declare
  d text := replace(pg_get_functiondef('public.rate_work_order(uuid,integer,integer,integer,integer,boolean,text)'::regprocedure), chr(13), '');
  a text := E'or wo.created_at::date >= public.current_resident_unit_since(wo.unit_id))';
begin
  if position('work_orders_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'rate_work_order: anchor not found exactly once';
  end if;
  execute replace(d, a, E'or public.association_local_date(wo.association_id, wo.created_at) >= public.current_resident_unit_since(wo.unit_id)) /* work_orders_fixes */');
end $$;

-- 8. A resident posts only on work orders they can see (not on the seller's
--    work orders for the same unit).
alter policy wo_msg_resident_insert on public.work_order_messages
  with check (
    author_role = 'owner'
    and (select public.is_portal_resident())
    and work_order_id in (select rls_private.resident_visible_work_order_ids())
  );
