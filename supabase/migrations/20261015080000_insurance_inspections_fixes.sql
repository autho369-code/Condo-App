-- Insurance, calendar, amenity and inspection fixes (audit 2026-10-14).
--
-- 1. insurance_policies.notes is staff text, but owners read their policy rows
--    (insurance_owner_read). It moves to the staff-only
--    insurance_policy_private table (same pattern as inspection_private).
-- 2. A newer policy for the same owner and association archives the earlier
--    active or expiring ones (archived_at), whichever path saved it.
-- 3. Expiry dates follow the association's calendar
--    (association_local_date), not the database's UTC current_date.
-- 4. Speed: the staff policy on insurance_policies compares the association
--    to a once-per-query id set; v_upcoming_expirations drops its per-row
--    can_access_portfolio (row-level security already scopes every row).
-- 5. resident_calendar_events never returns internal management reminders.
-- 6. Residents can only request an in-portal reservation of an active,
--    reservable amenity, in the future, inside its opening hours.
-- 7. Vendors add inspection findings; only management resolves them or links
--    a work order.
-- 8. An inspection created as completed gets its completed date.
--
-- Re-runnable: create or replace / if not exists, and the patched function
-- checks its marker first. No DELETE and no DROP.

-- ── 1. Staff-only insurance notes ───────────────────────────────────────────
create table if not exists public.insurance_policy_private (
  insurance_policy_id uuid primary key references public.insurance_policies(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.insurance_policy_private enable row level security;
revoke all on public.insurance_policy_private from anon;
grant select, insert, update, delete on public.insurance_policy_private to authenticated;

do $$
begin
  -- Staff only. The parent row's own row-level security applies inside the
  -- exists; a policy with an association must also be in the caller's
  -- associations (a staff member who owns a unit elsewhere can read their
  -- own policy row there, never its notes).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'insurance_policy_private' and policyname = 'insurance_policy_private_staff') then
    create policy insurance_policy_private_staff on public.insurance_policy_private
      for all to authenticated
      using (((select public.is_platform_operator()) or (select public.is_any_staff()) or (select public.is_company_admin()))
           and exists (
             select 1 from public.insurance_policies ip
              where ip.id = insurance_policy_private.insurance_policy_id
                and (ip.association_id is null
                     or coalesce(ip.association_id in (select rls_private.my_accessible_association_ids()), false))))
      with check (((select public.is_platform_operator()) or (select public.is_any_staff()) or (select public.is_company_admin()))
           and exists (
             select 1 from public.insurance_policies ip
              where ip.id = insurance_policy_private.insurance_policy_id
                and (ip.association_id is null
                     or coalesce(ip.association_id in (select rls_private.my_accessible_association_ids()), false))));
  else
    alter policy insurance_policy_private_staff on public.insurance_policy_private
      using (((select public.is_platform_operator()) or (select public.is_any_staff()) or (select public.is_company_admin()))
           and exists (
             select 1 from public.insurance_policies ip
              where ip.id = insurance_policy_private.insurance_policy_id
                and (ip.association_id is null
                     or coalesce(ip.association_id in (select rls_private.my_accessible_association_ids()), false))))
      with check (((select public.is_platform_operator()) or (select public.is_any_staff()) or (select public.is_company_admin()))
           and exists (
             select 1 from public.insurance_policies ip
              where ip.id = insurance_policy_private.insurance_policy_id
                and (ip.association_id is null
                     or coalesce(ip.association_id in (select rls_private.my_accessible_association_ids()), false))));
  end if;
  -- Association-scoped managers see only their associations' notes.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'insurance_policy_private' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.insurance_policy_private
      as restrictive for all to authenticated
      using (exists (
        select 1 from public.insurance_policies ip
         where ip.id = insurance_policy_private.insurance_policy_id
           and ((select public.manager_is_scoped()) is not true
                or ip.association_id is null
                or ip.association_id in (select public.my_managed_association_ids()))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'insurance_policy_private' and policyname = 'operator_writes_need_admin_insert') then
    create policy operator_writes_need_admin_insert on public.insurance_policy_private
      as restrictive for insert to authenticated with check ((select public.operator_may_write(false)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'insurance_policy_private' and policyname = 'operator_writes_need_admin_update') then
    create policy operator_writes_need_admin_update on public.insurance_policy_private
      as restrictive for update to authenticated
      using ((select public.operator_may_write(false))) with check ((select public.operator_may_write(false)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'insurance_policy_private' and policyname = 'operator_writes_need_admin_delete') then
    create policy operator_writes_need_admin_delete on public.insurance_policy_private
      as restrictive for delete to authenticated using ((select public.operator_may_write(false)));
  end if;
end $$;

create or replace trigger operator_write_guard
  before insert or update or delete on public.insurance_policy_private
  for each statement execute function public.operator_write_guard('false');

create or replace function public.move_insurance_policy_private_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  -- Only staff of this policy's association (or the server, with no
  -- signed-in user) write management's notes. Anyone else - an owner, even
  -- one who is staff at another company - never does.
  if auth.uid() is not null
     and not ((public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
              and public.can_access_association(new.association_id)) then
    new.notes := null;
    return new;
  end if;
  if new.notes is not null then
    insert into public.insurance_policy_private (insurance_policy_id, notes, updated_at)
    values (new.id, nullif(btrim(new.notes), ''), now())
    on conflict (insurance_policy_id) do update set
      notes = excluded.notes,
      updated_at = now();
    new.notes := null;
  end if;
  return new;
end
$function$;

revoke all on function public.move_insurance_policy_private_fields() from public, anon, authenticated;

create or replace trigger insurance_policies_move_private_fields
  before insert or update of notes on public.insurance_policies
  for each row execute function public.move_insurance_policy_private_fields();

-- Backfill, then clear the owner-readable column (an existing private value wins).
insert into public.insurance_policy_private (insurance_policy_id, notes, updated_at)
select ip.id, nullif(btrim(ip.notes), ''), now()
  from public.insurance_policies ip
 where ip.notes is not null and btrim(ip.notes) <> ''
on conflict (insurance_policy_id) do update
  set notes = coalesce(public.insurance_policy_private.notes, excluded.notes),
      updated_at = now();

update public.insurance_policies set notes = null where notes is not null;

-- ── 2. Renewals archive the earlier policy ──────────────────────────────────
create or replace function public.insurance_policies_supersede_earlier()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.archived_at is not null or new.expiration_date is null then
    return null;
  end if;
  -- One renewal at a time per owner record.
  perform pg_advisory_xact_lock(hashtextextended('insurance-renewal:' || new.owner_id::text, 0));
  update public.insurance_policies p
     set archived_at = now(),
         updated_at = now()
   where p.owner_id = new.owner_id
     and p.association_id is not distinct from new.association_id
     and p.id <> new.id
     and p.archived_at is null
     and p.status in ('active', 'expiring_soon')
     and p.expiration_date < new.expiration_date;
  return null;
end
$function$;

revoke all on function public.insurance_policies_supersede_earlier() from public, anon, authenticated;

create or replace trigger insurance_policies_supersede_earlier
  after insert on public.insurance_policies
  for each row execute function public.insurance_policies_supersede_earlier();

-- ── 3. Association dates ────────────────────────────────────────────────────
create or replace function public.check_insurance_expirations()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  -- Each association's own today (association_local_date), computed once per
  -- association; a policy with no association uses the default zone.
  with ld as (
    select x.aid, public.association_local_date(x.aid) as today
      from (select distinct association_id as aid
              from public.insurance_policies
             where status = 'active') x
  )
  update public.insurance_policies ip
     set status = 'expiring_soon', updated_at = pg_catalog.now()
    from ld
   where ld.aid is not distinct from ip.association_id
     and ip.status = 'active'
     and ip.expiration_date <= ld.today + 30
     and ip.expiration_date > ld.today;

  with ld as (
    select x.aid, public.association_local_date(x.aid) as today
      from (select distinct association_id as aid
              from public.insurance_policies
             where status in ('active', 'expiring_soon')) x
  )
  update public.insurance_policies ip
     set status = 'expired', updated_at = pg_catalog.now()
    from ld
   where ld.aid is not distinct from ip.association_id
     and ip.status in ('active', 'expiring_soon')
     and ip.expiration_date < ld.today;
end
$function$;

revoke all on function public.check_insurance_expirations() from public, anon, authenticated;
grant execute on function public.check_insurance_expirations() to service_role;

-- Same columns as before (a view keeps its column list); notes now come from
-- the staff-only table, so only staff see them. No per-row can_access_portfolio:
-- the base tables' row-level security scopes every row.
create or replace view public.v_upcoming_expirations
with (security_invoker = true)
as
with ld as materialized (
  select a.id, public.association_local_date(a.id) as today from public.associations a
), ld0 as materialized (
  select public.association_local_date(null::uuid) as today
)
select ip.id,
       ip.owner_id,
       ip.association_id,
       ip.policy_number,
       ip.insurance_company,
       ip.coverage_amount,
       ip.liability_amount,
       ip.deductible_amount,
       ip.effective_date,
       ip.expiration_date,
       ip.certificate_file_url,
       ip.extracted_fields,
       ip.extraction_status,
       ip.status,
       ipp.notes,
       ip.created_at,
       ip.updated_at,
       ip.archived_at,
       o.full_name as owner_name,
       o.email as owner_email,
       a.name as association_name,
       (ip.expiration_date - coalesce(ld.today, ld0.today)) as days_remaining,
       ip.remind_owner,
       ip.remind_manager,
       ip.reminder_30_sent_at,
       ip.reminder_15_sent_at
  from public.insurance_policies ip
  join public.owners o on o.id = ip.owner_id
  left join public.associations a on a.id = ip.association_id
  left join ld on ld.id = ip.association_id
  cross join ld0
  left join public.insurance_policy_private ipp on ipp.insurance_policy_id = ip.id
 where ip.archived_at is null
   and ip.status = any (array['active'::text, 'expiring_soon'::text, 'expired'::text])
 order by ip.expiration_date;

create or replace view public.v_insurance_expirations
with (security_invoker = true)
as
with ld as materialized (
  select a.id, public.association_local_date(a.id) as today from public.associations a
), ld0 as materialized (
  select public.association_local_date(null::uuid) as today
)
select v.portfolio_id,
       v.id as vendor_id,
       v.name as vendor_name,
       vc.workers_comp_expiration,
       vc.general_liability_expiration,
       vc.auto_insurance_expiration,
       vc.epa_certification_expiration,
       vc.state_license_expiration,
       least(vc.workers_comp_expiration, vc.general_liability_expiration, vc.auto_insurance_expiration,
             vc.epa_certification_expiration, vc.state_license_expiration, vc.contract_expiration) as soonest_expiration
  from public.vendors v
  join public.vendor_compliance vc on vc.vendor_id = v.id
  left join ld on ld.id = v.association_id
  cross join ld0
 where v.archived_at is null
   and least(vc.workers_comp_expiration, vc.general_liability_expiration, vc.auto_insurance_expiration,
             vc.epa_certification_expiration, vc.state_license_expiration, vc.contract_expiration)
       >= coalesce(ld.today, ld0.today)
   and least(vc.workers_comp_expiration, vc.general_liability_expiration, vc.auto_insurance_expiration,
             vc.epa_certification_expiration, vc.state_license_expiration, vc.contract_expiration)
       <= coalesce(ld.today, ld0.today) + 60;

-- Policies due an expiry reminder within p_within_days of each association's
-- today: not archived (a renewal archives the earlier policy), active or
-- expiring, and the owner still owns in that association. Cron-only.
create or replace function public.insurance_policies_due_for_reminder(
  p_within_days integer,
  p_association_ids uuid[] default null
)
returns table (
  id uuid,
  owner_id uuid,
  association_id uuid,
  policy_number text,
  insurance_company text,
  effective_date date,
  expiration_date date,
  remind_owner boolean,
  remind_manager boolean,
  reminder_30_sent_at timestamptz,
  reminder_15_sent_at timestamptz,
  days_left integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
#variable_conflict use_column
begin
  return query
  with cand as (
    select ip.*
      from public.insurance_policies ip
     where ip.archived_at is null
       and ip.status in ('active', 'expiring_soon')
       and (p_association_ids is null or ip.association_id = any (p_association_ids))
  ), ld as (
    select x.aid, public.association_local_date(x.aid) as today
      from (select distinct c.association_id as aid from cand c) x
  )
  select c.id, c.owner_id, c.association_id, c.policy_number, c.insurance_company,
         c.effective_date, c.expiration_date, c.remind_owner, c.remind_manager,
         c.reminder_30_sent_at, c.reminder_15_sent_at,
         (c.expiration_date - ld.today)::integer
    from cand c
    join ld on ld.aid is not distinct from c.association_id
   where c.expiration_date >= ld.today
     and c.expiration_date <= ld.today + greatest(coalesce(p_within_days, 0), 0)
     and exists (select 1 from public.owners o where o.id = c.owner_id and o.archived_at is null)
     and exists (
       select 1 from public.occupancies oc
        where oc.owner_id = c.owner_id
          and oc.status = 'current'
          and (c.association_id is null or oc.association_id = c.association_id))
   order by c.id;
end
$function$;

revoke all on function public.insurance_policies_due_for_reminder(integer, uuid[]) from public, anon, authenticated;
grant execute on function public.insurance_policies_due_for_reminder(integer, uuid[]) to service_role;

-- ── 4. Staff policy: once-per-query association set ─────────────────────────
-- The read side no longer calls insurance_policy_scope_valid per row; writes
-- still check that the owner belongs to the association.
alter policy insurance_staff_tenant_all on public.insurance_policies
  using (
    ((select auth.uid()) is not null)
    and ((select public.is_any_staff()) or (select public.is_company_admin()))
    and (
      coalesce(association_id in (select rls_private.my_accessible_association_ids()), false)
      or (association_id is null and exists (
        select 1 from public.owners o
         where o.id = insurance_policies.owner_id
           and (coalesce(o.portfolio_id = (select public.my_access_portfolio()), false)
                or ((select public.is_platform_operator()) and o.portfolio_id is not null))))
    )
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
  )
  with check (
    ((select auth.uid()) is not null)
    and ((select public.is_any_staff()) or (select public.is_company_admin()))
    and public.insurance_policy_scope_valid(owner_id, association_id)
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
    and (
      coalesce(association_id in (select rls_private.my_accessible_association_ids()), false)
      or (association_id is null and exists (
        select 1 from public.owners o
         where o.id = insurance_policies.owner_id
           and (coalesce(o.portfolio_id = (select public.my_access_portfolio()), false)
                or ((select public.is_platform_operator()) and o.portfolio_id is not null))))
    )
  );

-- ── 5. Residents' calendar: no internal management reminders ────────────────
do $$
declare
  v_def text := pg_get_functiondef('public.resident_calendar_events(uuid[], timestamptz, timestamptz, integer)'::regprocedure);
  v_anchor text := 'where e.archived_at is null';
  v_marker text := 'internal management reminders';
begin
  if position(v_marker in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'resident_calendar_events: anchor not found exactly once';
  end if;
  v_def := replace(v_def, v_anchor, v_anchor || E'\n'
    || E'     -- Staff-only internal management reminders are never shown to residents.\n'
    || E'     and e.event_type::text not in (''insurance_expiration'', ''contract_renewal'')');
  execute v_def;
end $$;

-- ── 6. Resident amenity requests ────────────────────────────────────────────
create or replace function public.amenity_reservations_resident_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  am record;
  v_start timestamp;
  v_end timestamp;
  v_end_time time;
begin
  -- Staff of the amenity's association and server writes pass; everyone
  -- else is checked, including someone who is staff at another company.
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;
  if (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     and public.can_access_association(new.association_id) then
    return new;
  end if;

  select a.id, a.association_id, a.allow_reservations, a.archived_at, a.reserve_method,
         a.reservation_email, a.reservation_url, a.opens_at, a.closes_at,
         coalesce(nullif(s.timezone, ''), 'America/Chicago') as tz
    into am
    from public.association_amenities a
    left join public.associations s on s.id = a.association_id
   where a.id = new.amenity_id
     for share of a;
  -- Reserved in the portal only when staff chose that: no email or link
  -- method, or one saved without its address.
  if not found or am.archived_at is not null or not coalesce(am.allow_reservations, false)
     or (am.reserve_method::text = 'email' and nullif(btrim(coalesce(am.reservation_email, '')), '') is not null)
     or (am.reserve_method::text = 'platform_link' and nullif(btrim(coalesce(am.reservation_url, '')), '') is not null)
     or am.association_id is distinct from new.association_id then
    raise exception 'That amenity does not take reservation requests here' using errcode = '42501';
  end if;
  if new.start_time is null or new.end_time is null or new.end_time <= new.start_time then
    raise exception 'A reservation must end after it starts' using errcode = '22023';
  end if;
  if new.start_time <= now() then
    raise exception 'Pick a time in the future' using errcode = '22023';
  end if;

  if am.opens_at is not null or am.closes_at is not null then
    v_start := new.start_time at time zone am.tz;
    v_end := new.end_time at time zone am.tz;
    -- Ending at midnight counts as the end of the same day.
    if v_end::date = v_start::date then
      v_end_time := v_end::time;
    elsif v_end::date = v_start::date + 1 and v_end::time = time '00:00' then
      v_end_time := time '24:00';
    else
      raise exception 'A reservation must start and end on the same day' using errcode = '22023';
    end if;
    -- Hours that run past midnight (closes before opens) are not checked here.
    if am.opens_at is null or am.closes_at is null or am.opens_at < am.closes_at then
      if (am.opens_at is not null and v_start::time < am.opens_at)
         or (am.closes_at is not null and v_end_time > am.closes_at) then
        raise exception 'That time is outside the amenity''s hours' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.amenity_reservations_resident_insert_guard() from public, anon, authenticated;

create or replace trigger trg_amenity_reservations_000_resident_insert_guard
  before insert on public.amenity_reservations
  for each row execute function public.amenity_reservations_resident_insert_guard();

-- ── 7. Vendors only add inspection findings ─────────────────────────────────
create or replace function public.inspection_items_self_service_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_assoc uuid;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;
  -- Staff of the inspection's association pass; everyone else (a vendor,
  -- even one who is staff at another company) only adds findings.
  select i.association_id into v_assoc from public.inspections i
   where i.id = case when tg_op = 'INSERT' then new.inspection_id else old.inspection_id end;
  if (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     and public.can_access_association(v_assoc) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.resolved, false) or new.resolved_at is not null
       or new.resolution_notes is not null or new.work_order_id is not null then
      raise exception 'Only management can resolve a finding or link a work order' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.resolved is distinct from old.resolved
     or new.resolved_at is distinct from old.resolved_at
     or new.resolution_notes is distinct from old.resolution_notes
     or new.work_order_id is distinct from old.work_order_id then
    raise exception 'Only management can resolve a finding or link a work order' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.inspection_items_self_service_guard() from public, anon, authenticated;

create or replace trigger trg_inspection_items_000_self_service_guard
  before insert or update on public.inspection_items
  for each row execute function public.inspection_items_self_service_guard();

-- ── 8. Completed on creation ────────────────────────────────────────────────
create or replace function public.inspections_default_completed_date()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.status = 'completed' and new.completed_date is null then
    new.completed_date := public.association_local_date(new.association_id);
  end if;
  return new;
end
$function$;

revoke all on function public.inspections_default_completed_date() from public, anon, authenticated;

create or replace trigger trg_inspections_completed_date
  before insert on public.inspections
  for each row execute function public.inspections_default_completed_date();
