-- Violation Reporting & Resolution System
-- Illinois Condominium Property Act compliant workflow

-- 1. House Rules (per association)
CREATE TABLE IF NOT EXISTS public.house_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  rule_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  penalty_type text DEFAULT 'warning' CHECK (penalty_type IN ('warning','fine','hearing')),
  fine_amount numeric(12,2),
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Violation cases (replaces/extends violations)
CREATE TABLE IF NOT EXISTS public.violation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  
  -- Reporter info
  reporter_name text NOT NULL,
  reporter_unit text,
  reporter_contact text NOT NULL,
  reporter_is_owner boolean DEFAULT false,
  
  -- Violator info  
  violator_name text,
  violator_unit text,
  
  -- Violation details
  house_rule_id uuid REFERENCES public.house_rules(id),
  violation_type text NOT NULL CHECK (violation_type IN ('noise','construction','pet','parking','harassment','smoking','waste','subletting','balcony','other')),
  violation_description text NOT NULL,
  dates_times text,
  witnesses text,
  previously_reported boolean DEFAULT false,
  
  -- Requested action
  requested_action text DEFAULT 'warning',
  
  -- Signature
  reporter_signature text NOT NULL,
  
  -- Status workflow
  status text DEFAULT 'reported' CHECK (status IN (
    'reported','notice_sent','hearing_requested','hearing_scheduled',
    'hearing_held','violation_confirmed','violation_dismissed',
    'fine_applied','appealed','closed'
  )),
  
  -- Dates
  reported_at timestamptz DEFAULT now(),
  notice_sent_at timestamptz,
  hearing_requested_at timestamptz,
  hearing_date timestamptz,
  hearing_location text,
  hearing_type text DEFAULT 'in_person' CHECK (hearing_type IN ('in_person','zoom','phone')),
  determined_at timestamptz,
  fine_amount numeric(12,2),
  fine_applied_at timestamptz,
  
  -- Determination
  determination_notes text,
  determined_by uuid REFERENCES public.profiles(id),
  owner_contested boolean DEFAULT false,
  owner_unavailable_dates text,
  board_unavailable_dates text,
  
  -- Acknowledgements
  ack_share_info boolean DEFAULT false,
  ack_true_accurate boolean DEFAULT false,
  ack_may_contact boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_violation_cases_assoc ON public.violation_cases(association_id);
CREATE INDEX IF NOT EXISTS idx_violation_cases_status ON public.violation_cases(status);
CREATE INDEX IF NOT EXISTS idx_violation_cases_reported ON public.violation_cases(reported_at DESC);

-- RLS
ALTER TABLE public.violation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage cases" ON public.violation_cases FOR ALL USING (is_any_staff() OR is_platform_operator());
CREATE POLICY "Anyone can read house rules" ON public.house_rules FOR SELECT USING (true);
CREATE POLICY "Staff manage house rules" ON public.house_rules FOR ALL USING (is_any_staff() OR is_platform_operator());

-- View: pending hearings
CREATE OR REPLACE VIEW public.v_pending_hearings AS
SELECT vc.*, a.name AS association_name,
  (COALESCE(vc.hearing_requested_at, vc.reported_at) + INTERVAL '10 days')::date AS response_deadline
FROM public.violation_cases vc
JOIN public.associations a ON a.id = vc.association_id
WHERE vc.archived_at IS NULL 
  AND vc.status IN ('hearing_requested','hearing_scheduled')
ORDER BY vc.hearing_date ASC NULLS LAST;

-- Seed sample house rules
INSERT INTO public.house_rules (association_id, rule_number, title, description, category, penalty_type, fine_amount, sort_order) 
SELECT a.id, '3.1', 'Noise and Quiet Hours', 'Residents shall not create or permit any unreasonably loud, disturbing, or unnecessary noise between 10:00 PM and 8:00 AM. This includes but is not limited to loud music, television, gatherings, construction work, and domestic disputes audible outside the unit.', 'noise', 'fine', 100.00, 1
FROM public.associations a WHERE a.archived_at IS NULL
UNION ALL
SELECT a.id, '3.2', 'Unauthorized Modifications', 'No owner shall make any structural modification, alteration, or addition to their unit or common elements without prior written approval from the Board of Directors. This includes but is not limited to: removing walls, installing hardwood floors, modifying plumbing/electrical, replacing windows, or changing exterior appearance.', 'construction', 'fine', 250.00, 2
FROM public.associations a WHERE a.archived_at IS NULL
UNION ALL
SELECT a.id, '3.3', 'Pet Policy', 'Residents may keep up to two (2) domestic pets per unit. All pets must be registered with management. Pets must be leashed in common areas. Owners are responsible for immediate cleanup of pet waste. Aggressive breeds as defined by Chicago municipal code are prohibited. Excessive barking or nuisance behavior may result in fines.', 'pet', 'fine', 75.00, 3
FROM public.associations a WHERE a.archived_at IS NULL
UNION ALL
SELECT a.id, '3.4', 'Parking and Vehicles', 'Parking is restricted to assigned spaces only. Vehicles must display valid association parking permits. No vehicle repair, maintenance, or washing is permitted on association property. Commercial vehicles, RVs, boats, and unregistered vehicles are prohibited. Guest parking is limited to 24 hours without prior approval.', 'parking', 'fine', 50.00, 4
FROM public.associations a WHERE a.archived_at IS NULL
UNION ALL
SELECT a.id, '3.5', 'Waste Disposal', 'All refuse must be placed in designated containers. Bulk items require special pickup arrangements. No items may be left in hallways, stairwells, or common areas. Recycling must be sorted according to Chicago municipal guidelines.', 'waste', 'fine', 75.00, 5
FROM public.associations a WHERE a.archived_at IS NULL
ON CONFLICT DO NOTHING;
