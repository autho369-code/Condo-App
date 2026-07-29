-- Lock Boxes Management
-- Physical key lock boxes for property access: locations, assignments, key tracking

DO $$ BEGIN
  CREATE TYPE lock_box_location_type AS ENUM ('building', 'unit', 'gate', 'entrance', 'pool', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lock_box_status AS ENUM ('active', 'inactive', 'lost', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS lock_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id),
  association_id uuid REFERENCES associations(id),
  building_id uuid REFERENCES buildings(id),
  unit_id uuid REFERENCES units(id),
  serial_number text,
  combination text,
  location_description text,
  location_type lock_box_location_type DEFAULT 'building',
  status lock_box_status DEFAULT 'active',
  keys_contained text[] DEFAULT '{}',
  key_count integer DEFAULT 0,
  notes text,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lock_box_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_box_id uuid NOT NULL REFERENCES lock_boxes(id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES portfolios(id),
  vendor_id uuid REFERENCES vendors(id),
  profile_id uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  returned_at timestamptz,
  purpose text,
  contact_phone text,
  contact_email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT lock_box_assignments_assignee_check
    CHECK (vendor_id IS NOT NULL OR profile_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_lock_boxes_portfolio ON lock_boxes(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_lock_boxes_association ON lock_boxes(association_id);
CREATE INDEX IF NOT EXISTS idx_lock_boxes_building ON lock_boxes(building_id);
CREATE INDEX IF NOT EXISTS idx_lock_boxes_status ON lock_boxes(status);
CREATE INDEX IF NOT EXISTS idx_lock_box_assignments_lock_box ON lock_box_assignments(lock_box_id);
CREATE INDEX IF NOT EXISTS idx_lock_box_assignments_vendor ON lock_box_assignments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_lock_box_assignments_profile ON lock_box_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_lock_box_assignments_active ON lock_box_assignments(lock_box_id) WHERE returned_at IS NULL;

ALTER TABLE lock_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lock_box_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lock_boxes_platform_all ON lock_boxes;
CREATE POLICY lock_boxes_platform_all ON lock_boxes FOR ALL TO authenticated USING (is_platform_operator()) WITH CHECK (is_platform_operator());

DROP POLICY IF EXISTS lock_box_assignments_platform_all ON lock_box_assignments;
CREATE POLICY lock_box_assignments_platform_all ON lock_box_assignments FOR ALL TO authenticated USING (is_platform_operator()) WITH CHECK (is_platform_operator());

DROP POLICY IF EXISTS lock_boxes_portfolio_select ON lock_boxes;
CREATE POLICY lock_boxes_portfolio_select ON lock_boxes FOR SELECT TO authenticated USING (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_boxes_portfolio_insert ON lock_boxes;
CREATE POLICY lock_boxes_portfolio_insert ON lock_boxes FOR INSERT TO authenticated WITH CHECK (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_boxes_portfolio_update ON lock_boxes;
CREATE POLICY lock_boxes_portfolio_update ON lock_boxes FOR UPDATE TO authenticated USING (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid())) WITH CHECK (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_boxes_portfolio_delete ON lock_boxes;
CREATE POLICY lock_boxes_portfolio_delete ON lock_boxes FOR DELETE TO authenticated USING (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_box_assignments_portfolio_select ON lock_box_assignments;
CREATE POLICY lock_box_assignments_portfolio_select ON lock_box_assignments FOR SELECT TO authenticated USING (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_box_assignments_portfolio_insert ON lock_box_assignments;
CREATE POLICY lock_box_assignments_portfolio_insert ON lock_box_assignments FOR INSERT TO authenticated WITH CHECK (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_box_assignments_portfolio_update ON lock_box_assignments;
CREATE POLICY lock_box_assignments_portfolio_update ON lock_box_assignments FOR UPDATE TO authenticated USING (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid())) WITH CHECK (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS lock_box_assignments_portfolio_delete ON lock_box_assignments;
CREATE POLICY lock_box_assignments_portfolio_delete ON lock_box_assignments FOR DELETE TO authenticated USING (portfolio_id IN (SELECT portfolio_id FROM profiles WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS set_lock_boxes_updated_at ON lock_boxes;
CREATE TRIGGER set_lock_boxes_updated_at BEFORE UPDATE ON lock_boxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_lock_box_assignments_updated_at ON lock_box_assignments;
CREATE TRIGGER set_lock_box_assignments_updated_at BEFORE UPDATE ON lock_box_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
