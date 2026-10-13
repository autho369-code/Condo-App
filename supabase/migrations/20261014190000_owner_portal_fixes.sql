-- Owner portal deep check (2026-10-13).
--
-- 1. Calendar: owners and tenants read calendar_events directly, so they saw
--    every event in the association with its internal notes, maintenance
--    instructions (gate codes), notification recipients and events about
--    other owners or units. They now read a safe list through
--    resident_calendar_events(): title, type, time and location only, and
--    not events about another owner, unit or resident (every other
--    association and company-wide event stays visible, as before). The direct read
--    policies are switched off (USING false, as the board's were in
--    20261005111000).
-- 2. Balance after a sale: the buyer couldn't see the seller's payments, so
--    payment applications to the seller-era charges were hidden too and those
--    charges showed as unpaid (the pay page pre-filled the higher amount).
--    Applications on the owner's own units are now visible
--    (resident_payment_ids runs as definer); the payment rows themselves still
--    start at the move-in date. resident_unit_balances() gives the unit's real
--    balance.
--    The owner sees the amount and date applied to each charge of their own
--    units (what the charge balance already shows); payment_applications.notes
--    is written by nothing (0 rows) and payment notes move to a private table
--    in the next change.
-- 3. Speed: the payments, work orders and work order messages owner policies
--    called current_resident_unit_since() once per row (4.8 s at 40k
--    payments). They now use one id set per query.
-- 4. Tenants no longer see work orders from before their lease started.
-- 5. Service requests filed by owners can't set has_open_work_order or the
--    created date (that skipped the manager's New queue).
-- 6. ARC messages from owners carry the owner's own id and name.
-- 7. Owner and unit documents marked staff-only stay hidden from owners.
-- 8. Owners can't update occupancies (the guard reverted every column
--    anyway; the policy only let them touch updated_at).
-- 9. enroll_autopay/cancel_autopay are unused by the app (AutoPay runs through
--    the server actions); no longer callable from the API.

-- 2 + 3. Payments, balances and work orders ------------------------------------
-- The owner's current units with the date their tenure starts (null = no
-- cutoff), the same rule as current_resident_unit_since(), for all units at once.
create or replace function rls_private.resident_unit_tenure()
returns table (unit_id uuid, since date)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select o.unit_id,
         case when bool_or(o.move_in_date is null) then null else min(o.move_in_date) end
    from public.occupancies o
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date)
   group by o.unit_id;
$function$;

create or replace function rls_private.resident_visible_payment_ids()
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select p.id
    from public.payments p
    join rls_private.resident_unit_tenure() t on t.unit_id = p.unit_id
   where t.since is null or p.payment_date >= t.since;
$function$;

create or replace function rls_private.resident_visible_work_order_ids()
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select w.id
    from public.work_orders w
    join rls_private.resident_unit_tenure() t on t.unit_id = w.unit_id
   where t.since is null or w.created_at::date >= t.since;
$function$;

-- Tenants: work orders on their unit from the lease start on.
create or replace function rls_private.tenant_visible_work_order_ids()
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select w.id
    from public.work_orders w
    join public.tenants t on t.unit_id = w.unit_id
   where t.id in (select public.current_tenant_ids())
     and w.unit_id in (select public.current_tenant_unit_ids())
     and w.archived_at is null
     and (t.lease_start is null or w.created_at::date >= t.lease_start);
$function$;

-- Applications on the owner's own units' charges are visible even when the
-- payment was the seller's, so charge balances are right after a sale.
alter function rls_private.resident_payment_ids() security definer;

revoke all on function rls_private.resident_unit_tenure() from public, anon;
revoke all on function rls_private.resident_visible_payment_ids() from public, anon;
revoke all on function rls_private.resident_visible_work_order_ids() from public, anon;
revoke all on function rls_private.tenant_visible_work_order_ids() from public, anon;
revoke all on function rls_private.resident_payment_ids() from public, anon;
grant execute on function rls_private.resident_unit_tenure() to authenticated;
grant execute on function rls_private.resident_visible_payment_ids() to authenticated;
grant execute on function rls_private.resident_visible_work_order_ids() to authenticated;
grant execute on function rls_private.tenant_visible_work_order_ids() to authenticated;
grant execute on function rls_private.resident_payment_ids() to authenticated;

alter policy payments_resident_read on public.payments
  using ((select public.is_portal_resident())
         and id in (select rls_private.resident_visible_payment_ids()));

alter policy work_orders_resident_read on public.work_orders
  using ((select public.is_portal_resident())
         and id in (select rls_private.resident_visible_work_order_ids()));

alter policy wo_msg_resident_select on public.work_order_messages
  using ((select public.is_portal_resident())
         and work_order_id in (select rls_private.resident_visible_work_order_ids()));

alter policy work_orders_tenant_read on public.work_orders
  using ((select public.is_tenant_user())
         and id in (select rls_private.tenant_visible_work_order_ids()));

-- The real balance of each of the caller's current units (all payments,
-- including the seller's), for the dashboard, pay page and assistant.
create or replace function public.resident_unit_balances()
returns table (unit_id uuid, balance numeric)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select ub.unit_id, ub.balance
    from public.unit_balances ub
   where public.is_portal_resident()
     and ub.unit_id in (select public.current_resident_unit_ids());
$function$;

revoke all on function public.resident_unit_balances() from public, anon;
grant execute on function public.resident_unit_balances() to authenticated;

-- 1. Calendar (after the tenure helper it uses) -------------------------------
create or replace function public.resident_calendar_events(
  p_association_ids uuid[] default null,
  p_from timestamptz default now(),
  p_to timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  association_id uuid,
  title text,
  event_type text,
  start_datetime timestamptz,
  location text,
  vendor_id uuid,
  vendor_name text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with assoc as (
    select a.id from public.current_resident_association_ids() a(id) where public.is_portal_resident()
    union
    select a.id from public.current_tenant_association_ids() a(id) where public.is_tenant_user()
  ), my_units as (
    -- The resident's units and the day they started there (owner move-in,
    -- tenant lease start; null = no cutoff).
    select t.unit_id as id, t.since from rls_private.resident_unit_tenure() t where public.is_portal_resident()
    union all
    select tn.unit_id, tn.lease_start
      from public.tenants tn
     where public.is_tenant_user()
       and tn.id in (select public.current_tenant_ids())
       and tn.unit_id in (select public.current_tenant_unit_ids())
  ), me as (
    select o.id from public.current_owner_ids() o(id)
    union
    select t.id from public.current_tenant_ids() t(id)
  )
  -- vendor_name stays null: vendor names are not shown to residents (vendors
  -- RLS); vendor_id only marks the event as a vendor visit.
  select e.id, e.association_id, e.title, e.event_type::text, e.start_datetime,
         e.location, e.vendor_id, null::text
    from public.calendar_events e
   where e.archived_at is null
     -- The resident's associations, and company-wide events of their
     -- company (both visible to every owner and tenant, 20261002233512).
     and (e.association_id in (select id from assoc)
          or (e.association_id is null
              and e.portfolio_id = public.current_portfolio_id()
              and (public.is_portal_resident() or public.is_tenant_user())))
     and (p_association_ids is null or e.association_id is null
          or e.association_id = any (p_association_ids))
     and (p_from is null or e.start_datetime >= p_from)
     and (p_to is null or e.start_datetime <= p_to)
     -- Events about one owner, unit or resident are for that person only.
     and (e.owner_id is null or e.owner_id in (select id from me))
     and (e.unit_id is null or exists (
           select 1 from my_units mu
            where mu.id = e.unit_id
              and (mu.since is null or e.start_datetime::date >= mu.since)))
     and (e.resident_id is null or e.resident_id in (select id from me))
   order by e.start_datetime, e.id
   limit least(greatest(coalesce(p_limit, 50), 1), 500);
$function$;

revoke all on function public.resident_calendar_events(uuid[], timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.resident_calendar_events(uuid[], timestamptz, timestamptz, integer) to authenticated;

alter policy calendar_events_resident_read on public.calendar_events using (false);
alter policy calendar_events_tenant_read on public.calendar_events using (false);

-- 5. Service request intake ---------------------------------------------------
-- (a) Owners file new requests: never already triaged or back-dated.
-- (b) "Staff" means staff of this request's association: staff at another
--     company who is an owner here files like any owner.
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.service_request_intake()'::regprocedure), E'\r\n', E'\n');
  v_old_a text := E'    new.resolution_note := null; new.resolved_at := null; new.resolved_by := null;\n  end if;';
  v_new_a text := E'    new.resolution_note := null; new.resolved_at := null; new.resolved_by := null;\n'
               || E'    -- Owners file new requests: never already triaged or back-dated.\n'
               || E'    new.has_open_work_order := false;\n'
               || E'    new.created_at := now(); new.created_on := current_date;\n'
               || E'    new.created_by := auth.uid(); new.archived_at := null;\n  end if;';
  v_old_b text := E'  v_is_staff boolean := public.is_platform_operator() or public.is_any_staff() or public.is_company_admin();';
  v_new_b text := E'  -- Staff of this request''s association (not staff at another company).\n'
               || E'  v_is_staff boolean := (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())\n'
               || E'    and public.can_access_association(coalesce(new.association_id,\n'
               || E'          (select b.association_id from public.units u join public.buildings b on b.id = u.building_id where u.id = new.unit_id)));';
  v_changed boolean := false;
begin
  if position('new.has_open_work_order := false' in v_def) = 0 then
    if array_length(string_to_array(v_def, v_old_a), 1) <> 2 then
      raise exception 'service_request_intake: triage text not found exactly once';
    end if;
    v_def := replace(v_def, v_old_a, v_new_a);
    v_changed := true;
  end if;
  if position('Staff of this request''s association' in v_def) = 0 then
    if array_length(string_to_array(v_def, v_old_b), 1) <> 2 then
      raise exception 'service_request_intake: staff text not found exactly once';
    end if;
    v_def := replace(v_def, v_old_b, v_new_b);
    v_changed := true;
  end if;
  if v_changed then
    execute v_def;
  end if;
end
$do$;

-- 6. ARC messages from owners -------------------------------------------------
create or replace function public.arch_msg_set_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  -- Only owner messages are stamped (the insert policy allows owners only
  -- 'owner'); a board decision written by a definer RPC keeps its role.
  -- Staff of the request's association write as themselves; staff at
  -- another company who is an owner here is stamped like any owner.
  if auth.uid() is null or new.author_role is distinct from 'owner' then
    return new;
  end if;
  if (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     and public.can_access_association(
           (select r.association_id from public.architectural_requests r where r.id = new.request_id)) then
    return new;
  end if;
  new.author_id := auth.uid();
  new.author_name := coalesce(
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = auth.uid()),
    'Owner');
  return new;
end
$function$;

revoke all on function public.arch_msg_set_author() from public, anon, authenticated;

create or replace trigger arch_msg_set_author
  before insert on public.architectural_request_messages
  for each row execute function public.arch_msg_set_author();

alter policy arch_msg_resident_insert on public.architectural_request_messages
  with check ((author_role = 'owner')
              and (select public.is_portal_resident())
              and exists (select 1 from public.architectural_requests r
                           where r.id = architectural_request_messages.request_id
                             and r.owner_id in (select public.current_owner_ids())));

-- 7. Owner and unit documents follow share_scope -------------------------------
alter policy documents_resident_tenant_read on public.documents
  using (((select auth.uid()) is not null)
         and (select public.is_portal_resident())
         and public.document_path_matches_entity(entity_type, entity_id, file_url)
         and share_scope = 'owners'
         and ((entity_type = 'owner' and entity_id in (select public.current_owner_ids()))
              or (entity_type = 'association' and entity_id in (select public.current_resident_association_ids()))
              or (entity_type = 'unit' and exists (
                    select 1 from public.occupancies oc
                     where oc.unit_id = documents.entity_id
                       and oc.owner_id in (select public.current_owner_ids())
                       and oc.status = 'current'))));

-- 8. Owners don't update occupancies ------------------------------------------
alter policy occupancies_self_update on public.occupancies using (false) with check (false);

-- 9. Unused AutoPay RPCs --------------------------------------------------------
do $do$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('enroll_autopay', 'cancel_autopay') loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
end
$do$;
