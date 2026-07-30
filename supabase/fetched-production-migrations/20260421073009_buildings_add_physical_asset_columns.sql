-- Path A (architectural split): physical-asset fields now live on `buildings`.
-- This migration is additive; no existing data is dropped. A follow-up
-- migration (step 7) will drop the stale columns from `associations` once
-- all reads/writes have moved.
--
-- Semantic mapping:
--   Association = legal entity (corporation / HOA board / financial reporting)
--   Building    = physical asset (bricks, maintenance, vendors, inspections)

alter table public.buildings
  add column if not exists address_line_2 text,
  add column if not exists city  text,
  add column if not exists state text,
  add column if not exists zip   text,
  add column if not exists county text,
  add column if not exists property_type text,
  add column if not exists description text,
  add column if not exists site_manager text,
  add column if not exists site_manager_phone text,
  add column if not exists management_start_date date,
  add column if not exists amenities jsonb default '[]'::jsonb,
  add column if not exists maintenance_limit numeric(14,2) default 0,
  add column if not exists insurance_expiration date,
  add column if not exists home_warranty_covered boolean default false,
  add column if not exists disable_online_maintenance_requests boolean default false,
  add column if not exists unit_entry_pre_authorized boolean default false,
  add column if not exists maintenance_notes text,
  add column if not exists online_maintenance_request_instructions text,
  add column if not exists lockbox_id text,
  add column if not exists is_primary boolean default false;

-- An association's "primary" building is the one the Association detail page
-- shows address/maintenance info for by default. Ensure at most one primary
-- per association.
create unique index if not exists idx_buildings_one_primary_per_association
  on public.buildings (association_id)
  where is_primary = true and archived_at is null;

comment on column public.buildings.is_primary is
  'The default/headline building for an association (used for address display, maintenance info, etc.). Exactly one per association.';

comment on column public.buildings.property_type is
  'Physical structure type: hoa, condo, coop, commercial, single_family, multi_family, mixed.';

comment on column public.buildings.site_manager is
  'Name of the on-site manager for this building.';

comment on column public.buildings.amenities is
  'JSON array of amenity tags. e.g. ["pool","gym","clubhouse"]';;
