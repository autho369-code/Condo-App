-- Step 2 of Path A: backfill every association's physical-asset fields into
-- a primary building. Idempotent — safe to re-run.
--
-- For each association:
--   (a) if no building exists, create one named after the association using
--       the association's address
--   (b) pick the earliest-created building as "primary"
--   (c) copy physical fields from association → primary building where the
--       building's field is still null/default (don't clobber manually-set data)

-- --- (a) ensure every association has at least one building
insert into public.buildings (association_id, name, address, year_built, created_at)
select a.id, a.name, a.address, a.year_built, a.created_at
from public.associations a
where a.archived_at is null
  and not exists (
    select 1 from public.buildings b
    where b.association_id = a.id and b.archived_at is null
  );

-- --- (b) mark the earliest building per association as is_primary=true
--         if no building is already primary for that association
update public.buildings b
set is_primary = true
where b.archived_at is null
  and b.id = (
    select b2.id
    from public.buildings b2
    where b2.association_id = b.association_id
      and b2.archived_at is null
    order by b2.created_at asc, b2.id asc
    limit 1
  )
  and not exists (
    select 1 from public.buildings b3
    where b3.association_id = b.association_id
      and b3.archived_at is null
      and b3.is_primary = true
  );

-- --- (c) copy physical fields from association into the primary building,
--         only where the building's version is null / default. We never
--         overwrite data that was set manually on the building.
update public.buildings b
set
  address_line_2                          = coalesce(b.address_line_2,                          a.address_line_2),
  city                                    = coalesce(b.city,                                    a.city),
  state                                   = coalesce(b.state,                                   a.state),
  zip                                     = coalesce(b.zip,                                     a.zip),
  county                                  = coalesce(b.county,                                  a.county),
  property_type                           = coalesce(b.property_type,                           a.property_type),
  description                             = coalesce(b.description,                             a.description),
  site_manager                            = coalesce(b.site_manager,                            a.site_manager),
  site_manager_phone                      = coalesce(b.site_manager_phone,                      a.site_manager_phone),
  management_start_date                   = coalesce(b.management_start_date,                   a.management_start_date),
  amenities                               = case when b.amenities = '[]'::jsonb or b.amenities is null then coalesce(a.amenities, '[]'::jsonb) else b.amenities end,
  maintenance_limit                       = case when b.maintenance_limit = 0 or b.maintenance_limit is null then coalesce(a.maintenance_limit, 0) else b.maintenance_limit end,
  insurance_expiration                    = coalesce(b.insurance_expiration,                    a.insurance_expiration),
  home_warranty_covered                   = case when b.home_warranty_covered = false then coalesce(a.home_warranty_covered, false) else b.home_warranty_covered end,
  disable_online_maintenance_requests     = case when b.disable_online_maintenance_requests = false then coalesce(a.disable_online_maintenance_requests, false) else b.disable_online_maintenance_requests end,
  unit_entry_pre_authorized               = case when b.unit_entry_pre_authorized = false then coalesce(a.unit_entry_pre_authorized, false) else b.unit_entry_pre_authorized end,
  maintenance_notes                       = coalesce(b.maintenance_notes,                       a.maintenance_notes),
  online_maintenance_request_instructions = coalesce(b.online_maintenance_request_instructions, a.online_maintenance_request_instructions),
  lockbox_id                              = coalesce(b.lockbox_id,                              a.lockbox_id),
  year_built                              = coalesce(b.year_built,                              a.year_built)
from public.associations a
where b.association_id = a.id
  and b.is_primary = true
  and b.archived_at is null;

-- Report what we did (advisory only)
do $$
declare
  n_buildings int;
  n_primary int;
begin
  select count(*) into n_buildings from public.buildings where archived_at is null;
  select count(*) into n_primary   from public.buildings where archived_at is null and is_primary = true;
  raise notice 'Backfill complete: % buildings total, % marked primary', n_buildings, n_primary;
end $$;;
