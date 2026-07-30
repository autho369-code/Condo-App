-- 1. Rename the enum value
ALTER TYPE occupancy_type RENAME VALUE 'homeowner' TO 'owner';

-- 2. Rename columns (no-collision cases)
ALTER TABLE public.approval_requests       RENAME COLUMN homeowner_id                     TO owner_id;
ALTER TABLE public.association_attachments RENAME COLUMN shared_with_homeowner            TO shared_with_owner;
ALTER TABLE public.associations            RENAME COLUMN homeowner_can_override_frequency TO owner_can_override_frequency;
ALTER TABLE public.usage_metrics           RENAME COLUMN homeowner_count                  TO owner_count;
ALTER TABLE public.work_orders             RENAME COLUMN homeowner_availability           TO owner_availability;

-- NOTE: service_requests.homeowner_id is intentionally NOT renamed here because
-- the table already has a separate owner_id column (legal owner vs resident can differ
-- when a tenant is living there and submits the request). Cleaning this up properly
-- requires a data-migration pass and is tracked in FINAL_INTEGRATION.md.;
