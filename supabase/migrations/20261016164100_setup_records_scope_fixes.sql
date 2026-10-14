-- Setup records deep check (package 4): scope and privacy guards.
-- Additive: new trigger functions and triggers, one new resident RPC,
-- ALTER POLICY (switched off with USING false, nothing dropped) and REVOKEs.
-- No DELETE/DROP.

-- ---------------------------------------------------------------------------
-- 1. Association payment settings. Stripe Connect fields are written only by
--    the server (Connect onboarding, status refresh, webhook: service role);
--    the allocation order and settlement account are finance decisions; every
--    bank account and fee schedule an association points to is its company's
--    (and, for bank accounts, its own or company-wide).
-- ---------------------------------------------------------------------------
-- The signed-in check is SECURITY INVOKER: current_user is then the caller's
-- role ('authenticated'); inside a definer function it would be the owner.
-- Trusted definer functions and the service role pass.
create or replace function public.associations_payment_settings_guard()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.stripe_account_id is not null or coalesce(new.stripe_charges_enabled, false)
       or coalesce(new.stripe_payouts_enabled, false) or coalesce(new.stripe_details_submitted, false)
       or new.stripe_onboarded_at is not null or new.stripe_deauthorized_at is not null
       or new.stripe_disabled_reason is not null or new.stripe_last_status_at is not null then
      raise exception 'Online payment settings are set up from the association''s Payments tab' using errcode = '42501';
    end if;
  elsif new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.stripe_details_submitted is distinct from old.stripe_details_submitted
     or new.stripe_onboarded_at is distinct from old.stripe_onboarded_at
     or new.stripe_deauthorized_at is distinct from old.stripe_deauthorized_at
     or new.stripe_disabled_reason is distinct from old.stripe_disabled_reason
     or new.stripe_last_status_at is distinct from old.stripe_last_status_at then
    raise exception 'Online payment settings are set up from the association''s Payments tab' using errcode = '42501';
  end if;

  if (tg_op = 'INSERT' and new.stripe_settlement_bank_account_id is not null)
     or (tg_op = 'UPDATE' and (
          new.payment_allocation_order is distinct from old.payment_allocation_order
       or new.stripe_settlement_bank_account_id is distinct from old.stripe_settlement_bank_account_id)) then
    if not (coalesce(public.is_finance_staff(), false)
            or coalesce(public.is_company_admin(), false)
            or coalesce(public.is_platform_operator(), false)) then
      raise exception 'Only finance staff can change how payments are applied or settled' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.associations_payment_settings_guard() from public, anon, authenticated;

create or replace trigger trg_associations_payment_settings_guard
  before insert or update on public.associations
  for each row execute function public.associations_payment_settings_guard();

-- The cross-company checks are SECURITY DEFINER: the caller can't see another
-- company's bank accounts, so under their access the check would pass.
create or replace function public.associations_linked_records_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if (tg_op = 'INSERT' or new.operating_bank_account_id is distinct from old.operating_bank_account_id
      or new.reserve_bank_account_id is distinct from old.reserve_bank_account_id
      or new.primary_bank_account_id is distinct from old.primary_bank_account_id
      or new.stripe_settlement_bank_account_id is distinct from old.stripe_settlement_bank_account_id
      or new.portfolio_id is distinct from old.portfolio_id)
     and exists (
       select 1
         from public.bank_accounts b
        where b.id in (new.operating_bank_account_id, new.reserve_bank_account_id,
                       new.primary_bank_account_id, new.stripe_settlement_bank_account_id)
          and (b.portfolio_id is distinct from new.portfolio_id
               or (b.association_id is not null and b.association_id is distinct from new.id))
     ) then
    raise exception 'A bank account of another association or company can''t be used here' using errcode = '42501';
  end if;

  if new.management_fee_schedule_id is not null
     and (tg_op = 'INSERT' or new.management_fee_schedule_id is distinct from old.management_fee_schedule_id
          or new.portfolio_id is distinct from old.portfolio_id)
     and not exists (
       select 1 from public.management_fee_schedules m
        where m.id = new.management_fee_schedule_id and m.portfolio_id = new.portfolio_id
     ) then
    raise exception 'That management fee schedule belongs to another company' using errcode = '42501';
  end if;

  return new;
end
$function$;

revoke all on function public.associations_linked_records_guard() from public, anon, authenticated;

create or replace trigger trg_associations_linked_records_guard
  before insert or update of operating_bank_account_id, reserve_bank_account_id, primary_bank_account_id,
    stripe_settlement_bank_account_id, management_fee_schedule_id, portfolio_id on public.associations
  for each row execute function public.associations_linked_records_guard();

-- ---------------------------------------------------------------------------
-- 2. Units, buildings and associations are never hard-deleted from the app
--    (no app path does it). A direct API delete cascaded a unit's charges,
--    payments and owners away. Deleting an association stays a SQL-editor job.
-- ---------------------------------------------------------------------------
revoke delete on public.units, public.buildings, public.associations from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Owner financial details (ACH / tax) and packet settings belong to the
--    owner's company: the row's company is taken from the owner, so another
--    company can't plant or claim a row for an owner it can't see.
-- ---------------------------------------------------------------------------
create or replace function public.owner_settings_company_from_owner()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio uuid;
begin
  select o.portfolio_id into v_portfolio from public.owners o where o.id = new.owner_id;
  if v_portfolio is null then
    raise exception 'Owner not found' using errcode = '23503';
  end if;
  new.portfolio_id := v_portfolio;
  return new;
end
$function$;

revoke all on function public.owner_settings_company_from_owner() from public, anon, authenticated;

create or replace trigger trg_owner_financial_details_company
  before insert or update of owner_id, portfolio_id on public.owner_financial_details
  for each row execute function public.owner_settings_company_from_owner();

create or replace trigger trg_owner_packet_settings_company
  before insert or update of owner_id, portfolio_id on public.owner_packet_settings
  for each row execute function public.owner_settings_company_from_owner();

-- ---------------------------------------------------------------------------
-- 4. Lock boxes: the association is the lock box's company's, and the
--    building and unit sit in that association. Missing levels are filled
--    from the unit/building.
-- ---------------------------------------------------------------------------
create or replace function public.lock_boxes_scope_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_unit_building uuid;
  v_building_assoc uuid;
begin
  if new.unit_id is not null then
    select u.building_id into v_unit_building from public.units u where u.id = new.unit_id;
    if v_unit_building is null then raise exception 'Unit not found' using errcode = '23503'; end if;
    if new.building_id is null then
      new.building_id := v_unit_building;
    elsif new.building_id is distinct from v_unit_building then
      raise exception 'The unit is not in that building' using errcode = '42501';
    end if;
  end if;
  if new.building_id is not null then
    select b.association_id into v_building_assoc from public.buildings b where b.id = new.building_id;
    if v_building_assoc is null then raise exception 'Building not found' using errcode = '23503'; end if;
    if new.association_id is null then
      new.association_id := v_building_assoc;
    elsif new.association_id is distinct from v_building_assoc then
      raise exception 'The building is not in that association' using errcode = '42501';
    end if;
  end if;
  if new.association_id is not null and not exists (
    select 1 from public.associations a where a.id = new.association_id and a.portfolio_id = new.portfolio_id
  ) then
    raise exception 'That association belongs to another company' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.lock_boxes_scope_guard() from public, anon, authenticated;

create or replace trigger trg_lock_boxes_scope_guard
  before insert or update of portfolio_id, association_id, building_id, unit_id on public.lock_boxes
  for each row execute function public.lock_boxes_scope_guard();

-- ---------------------------------------------------------------------------
-- 5. Calendar reminders go out for their own event: the reminder's company
--    and association must be the event's (the delivery job takes recipients
--    and branding from the event).
-- ---------------------------------------------------------------------------
create or replace function public.calendar_event_reminders_scope_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_event record;
begin
  select e.portfolio_id, e.association_id into v_event
    from public.calendar_events e where e.id = new.calendar_event_id;
  if not found then
    raise exception 'Calendar event not found' using errcode = '23503';
  end if;
  if new.portfolio_id is distinct from v_event.portfolio_id
     or new.association_id is distinct from v_event.association_id then
    raise exception 'A reminder belongs to its event''s association' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.calendar_event_reminders_scope_guard() from public, anon, authenticated;

create or replace trigger trg_calendar_event_reminders_scope_guard
  before insert or update of calendar_event_id, portfolio_id, association_id on public.calendar_event_reminders
  for each row execute function public.calendar_event_reminders_scope_guard();

-- ---------------------------------------------------------------------------
-- 6. A board seat linked to a homeowner record is on that record's own
--    association's board (homeowner records are per association).
-- ---------------------------------------------------------------------------
create or replace function public.board_members_owner_association_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.owners o where o.id = new.owner_id and o.association_id = new.association_id
  ) then
    raise exception 'This homeowner is not in that association' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.board_members_owner_association_guard() from public, anon, authenticated;

create or replace trigger trg_board_members_owner_association_guard
  before insert or update of owner_id, association_id on public.board_members
  for each row execute function public.board_members_owner_association_guard();

-- ---------------------------------------------------------------------------
-- 7. Parking: residents read their parking through a safe function that
--    returns only resident fields (no staff notes, no created_by) and only
--    their own assignments or the active ones on their current unit (not a
--    previous owner's history). Their direct read policies are switched off.
-- ---------------------------------------------------------------------------
create or replace function public.portal_parking_assignments()
returns table (
  id uuid,
  owner_id uuid,
  unit_id uuid,
  unit_number text,
  status text,
  start_date date,
  end_date date,
  monthly_fee numeric,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  license_plate text,
  insurance_company text,
  insurance_policy_number text,
  space_label text,
  space_type text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if auth.uid() is null or not coalesce(public.is_portal_resident(), false) then
    return;
  end if;
  return query
  select pa.id, pa.owner_id, pa.unit_id, u.unit_number::text, pa.status::text, pa.start_date, pa.end_date,
         pa.monthly_fee, pa.vehicle_make::text, pa.vehicle_model::text, pa.vehicle_color::text,
         pa.license_plate::text, pa.insurance_company::text,
         -- The policy number only on the resident's own assignment.
         case when pa.owner_id in (select public.current_owner_ids()) then pa.insurance_policy_number::text end,
         ps.label::text, ps.space_type::text
    from public.parking_assignments pa
    join public.parking_spaces ps on ps.id = pa.parking_space_id
    left join public.units u on u.id = pa.unit_id
   where pa.owner_id in (select public.current_owner_ids())
      or (pa.status = 'active' and pa.unit_id in (select public.current_resident_unit_ids()))
   order by pa.start_date desc nulls last, pa.id;
end
$function$;

revoke all on function public.portal_parking_assignments() from public, anon;
grant execute on function public.portal_parking_assignments() to authenticated, service_role;

alter policy parking_assignments_resident_read on public.parking_assignments using (false);
alter policy parking_spaces_resident_read on public.parking_spaces using (false);
