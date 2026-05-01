
DO $$ BEGIN
  CREATE TYPE amenity_pricing_mode AS ENUM ('flat', 'hourly');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE amenity_reserve_method AS ENUM ('email', 'platform_link');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE association_amenities
  ADD COLUMN IF NOT EXISTS image_url            text,
  ADD COLUMN IF NOT EXISTS description_html     text,
  ADD COLUMN IF NOT EXISTS opens_at             time,
  ADD COLUMN IF NOT EXISTS closes_at            time,
  ADD COLUMN IF NOT EXISTS allow_reservations   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_mode         amenity_pricing_mode,
  ADD COLUMN IF NOT EXISTS price_amount         numeric(10, 2),
  ADD COLUMN IF NOT EXISTS reserve_method       amenity_reserve_method,
  ADD COLUMN IF NOT EXISTS reservation_email    text,
  ADD COLUMN IF NOT EXISTS reservation_url      text,
  ADD COLUMN IF NOT EXISTS archived_at          timestamptz;
