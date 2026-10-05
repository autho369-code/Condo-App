-- Role audit fixes (owner portal + operations).
--
-- 1. Owners could edit their own occupancy move_in_date/move_out_date (the
--    self-service guard let those two columns through). The portal hides a
--    previous owner's history by the buyer's move-in date, and payment
--    attribution uses these dates, so an owner could unhide the seller's
--    records and change staff reports. No portal page writes occupancies any
--    more; self-service callers may change nothing on the row.
create or replace function public.occupancies_self_service_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;
  new := old;
  return new;
end $function$;

-- 2. An owner's direct service-request insert supplied association_id and
--    portfolio_id unchecked, so a request (and its emergency alert) could land
--    in another company's queue. For non-staff callers, derive both from the
--    unit.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.service_request_intake'::regproc::regprocedure);
  if position('derive scope from the unit' in v_def) = 0 then
    execute replace(v_def,
      '  if new.portfolio_id is null and new.association_id is not null then',
      '  -- derive scope from the unit for non-staff callers
  if not v_is_staff and auth.uid() is not null and new.unit_id is not null then
    select b.association_id, a.portfolio_id into new.association_id, new.portfolio_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = new.unit_id;
  end if;
  if new.portfolio_id is null and new.association_id is not null then');
  end if;
end $$;

-- 3. Owner amenity bookings: the amenity, unit and company must match the
--    owner's own association (previously unchecked, so an owner could block
--    another association's amenity with pending bookings).
alter policy amenity_res_resident_insert on public.amenity_reservations
  with check (
    is_portal_resident()
    and owner_id = current_owner_id()
    and association_id in (select current_resident_association_ids())
    and status = 'pending'
    and exists (select 1 from public.association_amenities am
                 where am.id = amenity_reservations.amenity_id
                   and am.association_id = amenity_reservations.association_id)
    and (unit_id is null or unit_id in (select current_resident_unit_ids()))
    and portfolio_id is not distinct from (select a.portfolio_id from public.associations a
                                            where a.id = amenity_reservations.association_id));

-- 4. Operations: a recurring work order with no description made the nightly
--    generator insert a NULL service_requests.description (NOT NULL); the
--    per-row handler swallowed it, so the template was skipped every night.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.generate_recurring_work_orders'::regproc::regprocedure);
  if position('row.description || E''\n(auto-generated' in v_def) > 0 then
    execute replace(v_def,
      'row.description || E''\n(auto-generated',
      'coalesce(nullif(row.description, ''''), row.title) || E''\n(auto-generated');
  end if;
end $$;
