-- Meeting sign-in sheet: attendance tracking, quorum calculation, digital sign-in
-- Replaces old meetings table (propertyId/companyId naming) with proper schema

-- 1. Drop old meetings table and type if exists
DROP TABLE IF EXISTS meetings CASCADE;
DROP TYPE IF EXISTS meeting_type CASCADE;
DROP TYPE IF EXISTS meeting_status CASCADE;

-- 2. Recreate enums
CREATE TYPE meeting_type AS ENUM (
  'board_meeting',
  'annual_meeting',
  'special_meeting',
  'committee_meeting',
  'executive_session'
);

CREATE TYPE meeting_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

-- 3. Create meetings table with proper naming
CREATE TABLE meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_type meeting_type NOT NULL DEFAULT 'board_meeting',
  status meeting_status NOT NULL DEFAULT 'scheduled',
  start_time timestamptz,
  end_time timestamptz,
  location text,
  agenda text,
  minutes text,
  ai_summary text,
  quorum_requirement integer,          -- number of attendees needed for quorum
  quorum_met boolean DEFAULT false,    -- calculated when quorum is reached
  total_units integer,                 -- total units in association at meeting time (snapshot)
  created_by uuid REFERENCES profiles(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create meeting_attendees table
CREATE TABLE meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  attendee_name text NOT NULL,         -- display name (might be guest/non-owner)
  attendee_role text,                  -- 'board_member', 'owner', 'manager', 'guest'
  check_in_time timestamptz DEFAULT now(),
  signature_data text,                 -- base64-encoded signature image data
  present boolean NOT NULL DEFAULT true,
  voting_eligible boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Add quorum_percentage to associations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'associations' AND column_name = 'quorum_percentage'
  ) THEN
    ALTER TABLE associations ADD COLUMN quorum_percentage integer DEFAULT 51;
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX idx_meetings_portfolio ON meetings(portfolio_id);
CREATE INDEX idx_meetings_association ON meetings(association_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_start_time ON meetings(start_time DESC);
CREATE INDEX idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_attendees_owner ON meeting_attendees(owner_id);

-- 7. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON meetings;
CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_meetings_updated_at();

-- 8. RLS — enable
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies — meetings
-- Platform operators: full access
CREATE POLICY meetings_platform_all ON meetings
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- Staff with finance/staff access: CRUD scoped to their portfolio
CREATE POLICY meetings_staff_select ON meetings
  FOR SELECT TO authenticated
  USING (
    can_access_portfolio(portfolio_id)
  );

CREATE POLICY meetings_staff_insert ON meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    can_access_portfolio(portfolio_id)
  );

CREATE POLICY meetings_staff_update ON meetings
  FOR UPDATE TO authenticated
  USING (
    can_access_portfolio(portfolio_id)
  )
  WITH CHECK (
    can_access_portfolio(portfolio_id)
  );

CREATE POLICY meetings_staff_delete ON meetings
  FOR DELETE TO authenticated
  USING (
    can_access_portfolio(portfolio_id)
  );

-- Board members: read meetings for their association
CREATE POLICY meetings_board_select ON meetings
  FOR SELECT TO authenticated
  USING (
    association_id IN (SELECT current_board_association_ids())
  );

-- 10. RLS policies — meeting_attendees
-- Platform operators: full access
CREATE POLICY meeting_attendees_platform_all ON meeting_attendees
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- Staff: CRUD scoped through meeting's portfolio
CREATE POLICY meeting_attendees_staff_select ON meeting_attendees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND can_access_portfolio(m.portfolio_id)
    )
  );

CREATE POLICY meeting_attendees_staff_insert ON meeting_attendees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND can_access_portfolio(m.portfolio_id)
    )
  );

CREATE POLICY meeting_attendees_staff_update ON meeting_attendees
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND can_access_portfolio(m.portfolio_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND can_access_portfolio(m.portfolio_id)
    )
  );

CREATE POLICY meeting_attendees_staff_delete ON meeting_attendees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND can_access_portfolio(m.portfolio_id)
    )
  );

-- Board members: read attendees for their meetings
CREATE POLICY meeting_attendees_board_select ON meeting_attendees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND m.association_id IN (SELECT current_board_association_ids())
    )
  );

-- 11. Quorum calculation RPC
CREATE OR REPLACE FUNCTION calculate_meeting_quorum(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting meetings;
  v_quorum_pct integer;
  v_total_units integer;
  v_attendee_count integer;
  v_board_count integer;
  v_owner_count integer;
  v_quorum_needed integer;
  v_quorum_reached boolean;
BEGIN
  -- Get meeting info
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Meeting not found');
  END IF;

  -- Get association quorum percentage (default 51%)
  SELECT COALESCE(quorum_percentage, 51) INTO v_quorum_pct
  FROM associations WHERE id = v_meeting.association_id;

  -- Get total units for association
  SELECT COALESCE(unit_count, 0) INTO v_total_units
  FROM associations WHERE id = v_meeting.association_id;

  -- Count present attendees
  SELECT COUNT(*) INTO v_attendee_count
  FROM meeting_attendees
  WHERE meeting_id = p_meeting_id AND present = true;

  -- Count board members present
  SELECT COUNT(*) INTO v_board_count
  FROM meeting_attendees
  WHERE meeting_id = p_meeting_id AND present = true AND attendee_role = 'board_member';

  -- Count owners present
  SELECT COUNT(*) INTO v_owner_count
  FROM meeting_attendees
  WHERE meeting_id = p_meeting_id AND present = true AND attendee_role IN ('owner', 'board_member');

  -- Calculate quorum based on unit ownership representation
  -- Quorum = ceil(total_units * quorum_pct / 100)
  v_quorum_needed := CEIL(v_total_units * v_quorum_pct / 100.0);
  v_quorum_reached := v_owner_count >= v_quorum_needed;

  -- Update meeting quorum status
  UPDATE meetings
  SET quorum_met = v_quorum_reached,
      quorum_requirement = v_quorum_needed,
      total_units = v_total_units
  WHERE id = p_meeting_id;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'total_units', v_total_units,
    'quorum_percentage', v_quorum_pct,
    'quorum_needed', v_quorum_needed,
    'attendee_count', v_attendee_count,
    'board_count', v_board_count,
    'owner_count', v_owner_count,
    'quorum_reached', v_quorum_reached
  );
END;
$$;

-- 12. Function to record attendance with optional signature
CREATE OR REPLACE FUNCTION record_meeting_attendance(
  p_meeting_id uuid,
  p_attendee_name text,
  p_owner_id uuid DEFAULT NULL,
  p_attendee_role text DEFAULT 'owner',
  p_signature_data text DEFAULT NULL,
  p_voting_eligible boolean DEFAULT true,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendee_id uuid;
BEGIN
  -- Check if this owner already signed in for this meeting
  IF p_owner_id IS NOT NULL THEN
    SELECT id INTO v_attendee_id
    FROM meeting_attendees
    WHERE meeting_id = p_meeting_id AND owner_id = p_owner_id;

    IF FOUND THEN
      -- Update existing record
      UPDATE meeting_attendees
      SET signature_data = COALESCE(p_signature_data, signature_data),
          present = true,
          attendee_name = p_attendee_name,
          attendee_role = p_attendee_role,
          voting_eligible = p_voting_eligible,
          notes = COALESCE(p_notes, notes),
          check_in_time = now()
      WHERE id = v_attendee_id;
      
      -- Recalculate quorum
      PERFORM calculate_meeting_quorum(p_meeting_id);
      
      RETURN v_attendee_id;
    END IF;
  END IF;

  -- Insert new attendance record
  INSERT INTO meeting_attendees (
    meeting_id, owner_id, attendee_name, attendee_role,
    check_in_time, signature_data, present, voting_eligible, notes
  ) VALUES (
    p_meeting_id, p_owner_id, p_attendee_name, p_attendee_role,
    now(), p_signature_data, true, p_voting_eligible, p_notes
  )
  RETURNING id INTO v_attendee_id;

  -- Recalculate quorum
  PERFORM calculate_meeting_quorum(p_meeting_id);

  RETURN v_attendee_id;
END;
$$;
