-- Work order and service request fixes. Re-runnable: every patch of a live
-- function checks the marker 'work_orders_fixes' first and replaces an anchor
-- that must appear exactly once; small helpers are replaced whole.

-- 1. One work order per service request. A request whose work order is
--    finished is not triaged again (the open one is still returned, so a
--    double click lands on it). The request follows its work orders: it is
--    completed when its last open work order finishes, is cancelled,
--    archived or deleted while another one is finished, and goes back to
--    waiting when a finished work order is reopened.
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
declare
  -- work_orders_fixes: open = not finished, cancelled or archived.
  v_old_open boolean := tg_op <> 'INSERT' and old.archived_at is null
    and old.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled');
  v_new_open boolean := tg_op <> 'DELETE' and new.archived_at is null
    and new.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled');
  v_sr uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.service_request_id is not null then
    perform public.refresh_service_request_open_work_order(old.service_request_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.service_request_id is not null
     and (tg_op = 'INSERT' or new.service_request_id is distinct from old.service_request_id
          or new.status is distinct from old.status or new.archived_at is distinct from old.archived_at) then
    perform public.refresh_service_request_open_work_order(new.service_request_id);
  end if;

  -- An open work order finished, was cancelled, archived, deleted or moved
  -- to another request (or one was added already finished): when no open
  -- work order is left and one is finished, the request is completed.
  if v_old_open and old.service_request_id is not null
     and (tg_op = 'DELETE' or not v_new_open or new.service_request_id is distinct from old.service_request_id) then
    v_sr := old.service_request_id;
  elsif tg_op = 'INSERT' and new.service_request_id is not null and new.archived_at is null
     and new.status::text in ('done', 'completed', 'billed', 'closed') then
    v_sr := new.service_request_id;
  end if;
  if v_sr is not null then
    update public.service_requests s
       set status = 'completed',
           resolved_at = coalesce(s.resolved_at, now())
     where s.id = v_sr
       and s.archived_at is null
       and s.status in ('open', 'waiting')
       and not exists (
         select 1 from public.work_orders w
          where w.service_request_id = s.id
            and w.archived_at is null
            and w.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled'))
       and exists (
         select 1 from public.work_orders w
          where w.service_request_id = s.id
            and w.archived_at is null
            and w.status::text in ('done', 'completed', 'billed', 'closed'));
  end if;

  -- A finished work order reopened: its completed request is waiting again
  -- (a cancelled request stays cancelled).
  if tg_op = 'UPDATE' and v_new_open and new.service_request_id is not null
     and new.service_request_id = old.service_request_id
     and old.archived_at is null
     and old.status::text in ('done', 'completed', 'billed', 'closed') then
    update public.service_requests s
       set status = 'waiting',
           resolved_at = null
     where s.id = new.service_request_id
       and s.archived_at is null
       and s.status = 'completed';
  end if;
  return null;
end $function$;

-- The guard on service_requests resets everything but the status for a
-- signed-in non-staff caller (a vendor finishing the job). The request
-- updates above run nested (trigger depth > 1), so keep their resolved_at
-- the way has_open_work_order is kept.
do $$
declare
  d text := replace(pg_get_functiondef('public.service_request_guard_update()'::regprocedure), chr(13), '');
  a1 text := E'  v_open boolean;\n';
  a2 text := E'    v_open := new.has_open_work_order;\n';
  a3 text := E'    if pg_trigger_depth() > 1 then new.has_open_work_order := v_open; end if;\n';
begin
  if position('work_orders_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a1, ''))) / length(a1) <> 1 then
    raise exception 'service_request_guard_update: declare anchor not found exactly once';
  end if;
  if (length(d) - length(replace(d, a2, ''))) / length(a2) <> 1 then
    raise exception 'service_request_guard_update: capture anchor not found exactly once';
  end if;
  if (length(d) - length(replace(d, a3, ''))) / length(a3) <> 1 then
    raise exception 'service_request_guard_update: nested anchor not found exactly once';
  end if;
  d := replace(d, a1, a1 || E'  v_resolved timestamptz; -- work_orders_fixes\n');
  d := replace(d, a2, a2 || E'    v_resolved := new.resolved_at;\n');
  d := replace(d, a3, E'    if pg_trigger_depth() > 1 then\n      new.has_open_work_order := v_open;\n      new.resolved_at := v_resolved;\n    end if;\n');
  execute d;
end $$;

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
--    association is known. The column default (the server's UTC date) is
--    replaced by the trigger, so a date staff enter is kept as entered.
alter table public.service_requests alter column created_on set default null;

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
  d := replace(d, a2, $new$  -- work_orders_fixes: the association's own date, once the association is known
  -- (residents always; staff only when they left the date empty).
  if (not v_is_staff and auth.uid() is not null) or new.created_on is null then
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

create or replace function public.current_resident_association_ids()
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
  select distinct b.association_id
    from public.occupancies o
    join public.units un on un.id = o.unit_id
    join public.buildings b on b.id = un.building_id
    left join public.associations a on a.id = b.association_id
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null
          or o.move_out_date > (now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date);
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

-- The work orders an owner may post a message on: the ones they can see,
-- not archived.
create or replace function rls_private.resident_postable_work_order_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select w.id
    from public.work_orders w
    join rls_private.resident_unit_tenure() t on t.unit_id = w.unit_id
    left join public.associations a on a.id = w.association_id
   where w.archived_at is null
     and (t.since is null
          or (w.created_at at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date >= t.since);
end
$function$;

-- Tenants: work orders on their unit from the lease start on (the work
-- order's local date).
create or replace function rls_private.tenant_visible_work_order_ids()
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
    join public.tenants t on t.unit_id = w.unit_id
    left join public.associations a on a.id = w.association_id
   where t.id in (select public.current_tenant_ids())
     and w.unit_id in (select public.current_tenant_unit_ids())
     and w.archived_at is null
     and (t.lease_start is null
          or (w.created_at at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date >= t.lease_start);
end
$function$;

-- 8 (review). Service requests and payment plans: the move-in cutoff is one
-- id set per query, not a per-row current_resident_unit_since() call.
create or replace function rls_private.resident_visible_service_request_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select s.id
    from public.service_requests s
    join rls_private.resident_unit_tenure() t on t.unit_id = s.unit_id
    left join public.associations a on a.id = s.association_id
   where s.owner_id in (select public.current_owner_ids())
      or (s.homeowner_id is null and s.owner_id is null
          and (t.since is null
               or (s.created_at at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date >= t.since));
end
$function$;

create or replace function rls_private.resident_visible_payment_plan_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select pp.id
    from public.payment_plans pp
    join rls_private.resident_unit_tenure() t on t.unit_id = pp.unit_id
    left join public.associations a on a.id = pp.association_id
   where pp.owner_id in (select public.current_owner_ids())
      or (pp.owner_id is null
          and (t.since is null
               or (pp.created_at at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date >= t.since));
end
$function$;

revoke all on function public.current_resident_unit_ids() from public, anon;
revoke all on function public.current_resident_unit_since(uuid) from public, anon;
revoke all on function public.current_resident_association_ids() from public, anon;
revoke all on function rls_private.resident_unit_tenure() from public, anon;
revoke all on function rls_private.resident_visible_work_order_ids() from public, anon;
revoke all on function rls_private.resident_postable_work_order_ids() from public, anon;
revoke all on function rls_private.tenant_visible_work_order_ids() from public, anon;
revoke all on function rls_private.resident_visible_service_request_ids() from public, anon;
revoke all on function rls_private.resident_visible_payment_plan_ids() from public, anon;
grant execute on function public.current_resident_unit_ids() to authenticated, service_role;
grant execute on function public.current_resident_unit_since(uuid) to authenticated, service_role;
grant execute on function public.current_resident_association_ids() to authenticated, service_role;
grant execute on function rls_private.resident_unit_tenure() to authenticated;
grant execute on function rls_private.resident_visible_work_order_ids() to authenticated;
grant execute on function rls_private.resident_postable_work_order_ids() to authenticated;
grant execute on function rls_private.tenant_visible_work_order_ids() to authenticated;
grant execute on function rls_private.resident_visible_service_request_ids() to authenticated;
grant execute on function rls_private.resident_visible_payment_plan_ids() to authenticated;

alter policy service_requests_resident_read on public.service_requests
  using (
    (select public.is_portal_resident())
    and (homeowner_id in (select public.current_owner_ids())
         or id in (select rls_private.resident_visible_service_request_ids()))
  );

alter policy payment_plans_owner_read on public.payment_plans
  using (id in (select rls_private.resident_visible_payment_plan_ids()));

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

-- 8. A resident posts only as themselves, on work orders they can see that
--    are not archived (not on the seller's work orders for the same unit).
alter policy wo_msg_resident_insert on public.work_order_messages
  with check (
    author_role = 'owner'
    and author_id = (select auth.uid())
    and (select public.is_portal_resident())
    and work_order_id in (select rls_private.resident_postable_work_order_ids())
  );
