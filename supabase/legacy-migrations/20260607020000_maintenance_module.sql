-- Preventive Maintenance Module: Template Groups + Templates + Tasks + History
-- Run this in Supabase SQL Editor

-- 1. MAINTENANCE TEMPLATE GROUPS
CREATE TABLE IF NOT EXISTS maintenance_template_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MAINTENANCE TEMPLATES (belong to groups)
CREATE TABLE IF NOT EXISTS maintenance_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES maintenance_template_groups(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  priority TEXT DEFAULT 'medium',
  estimated_hours NUMERIC(4,1),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MAINTENANCE TASKS (per-association instances from templates)
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  association_id UUID NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES maintenance_templates(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  priority TEXT DEFAULT 'medium',
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  next_due_date DATE,
  last_completed_date DATE,
  reminder_days_before INTEGER DEFAULT 3,
  estimated_hours NUMERIC(4,1),
  notes TEXT,
  send_reminder_email BOOLEAN DEFAULT false,
  send_reminder_sms BOOLEAN DEFAULT false,
  notify_board BOOLEAN DEFAULT false,
  notify_owner BOOLEAN DEFAULT false,
  notify_vendor BOOLEAN DEFAULT false,
  notify_site_manager BOOLEAN DEFAULT false,
  notify_accountant BOOLEAN DEFAULT false,
  auto_recurring BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 4. MAINTENANCE TASK HISTORY (completion records)
CREATE TABLE IF NOT EXISTS maintenance_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed',
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  cost NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_group ON maintenance_templates(group_id);
CREATE INDEX IF NOT EXISTS idx_templates_portfolio ON maintenance_templates(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_tasks_association ON maintenance_tasks(association_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_next_due ON maintenance_tasks(next_due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_template ON maintenance_tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task ON maintenance_task_history(task_id);

-- RLS policies
ALTER TABLE maintenance_template_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_task_history ENABLE ROW LEVEL SECURITY;

-- Portfolio-scoped RLS for template groups
CREATE POLICY "Staff can view template groups" ON maintenance_template_groups
  FOR SELECT USING (is_staff(portfolio_id));
CREATE POLICY "Staff can insert template groups" ON maintenance_template_groups
  FOR INSERT WITH CHECK (is_staff(portfolio_id));
CREATE POLICY "Staff can update template groups" ON maintenance_template_groups
  FOR UPDATE USING (is_staff(portfolio_id));
CREATE POLICY "Staff can delete template groups" ON maintenance_template_groups
  FOR DELETE USING (is_staff(portfolio_id));

-- Portfolio-scoped RLS for templates
CREATE POLICY "Staff can view templates" ON maintenance_templates
  FOR SELECT USING (is_staff(portfolio_id));
CREATE POLICY "Staff can insert templates" ON maintenance_templates
  FOR INSERT WITH CHECK (is_staff(portfolio_id));
CREATE POLICY "Staff can update templates" ON maintenance_templates
  FOR UPDATE USING (is_staff(portfolio_id));
CREATE POLICY "Staff can delete templates" ON maintenance_templates
  FOR DELETE USING (is_staff(portfolio_id));

-- Portfolio-scoped RLS for tasks
CREATE POLICY "Staff can view tasks" ON maintenance_tasks
  FOR SELECT USING (is_staff(portfolio_id));
CREATE POLICY "Staff can insert tasks" ON maintenance_tasks
  FOR INSERT WITH CHECK (is_staff(portfolio_id));
CREATE POLICY "Staff can update tasks" ON maintenance_tasks
  FOR UPDATE USING (is_staff(portfolio_id));
CREATE POLICY "Staff can delete tasks" ON maintenance_tasks
  FOR DELETE USING (is_staff(portfolio_id));

-- Portfolio-scoped RLS for task history
CREATE POLICY "Staff can view task history" ON maintenance_task_history
  FOR SELECT USING (is_staff(portfolio_id));
CREATE POLICY "Staff can insert task history" ON maintenance_task_history
  FOR INSERT WITH CHECK (is_staff(portfolio_id));

-- Seed template groups
INSERT INTO maintenance_template_groups (portfolio_id, name, description, icon, sort_order)
SELECT id, 'High Rise Condominium', 'Elevator buildings, common HVAC, fire systems, underground parking', 'building-2', 1
FROM portfolios LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_template_groups (portfolio_id, name, description, icon, sort_order)
SELECT id, 'Mid Rise Condominium', '3-6 story buildings, shared corridors, elevators, common landscaping', 'building', 2
FROM portfolios LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_template_groups (portfolio_id, name, description, icon, sort_order)
SELECT id, 'Townhome HOA', 'Attached units, individual entries, common driveways and landscaping', 'home', 3
FROM portfolios LIMIT 1
ON CONFLICT DO NOTHING;

-- Seed templates (will insert after groups exist)
DO $$
DECLARE
  highrise_id UUID;
  midrise_id UUID;
  townhome_id UUID;
  portfolio UUID;
BEGIN
  SELECT id INTO portfolio FROM portfolios LIMIT 1;

  SELECT id INTO highrise_id FROM maintenance_template_groups WHERE name = 'High Rise Condominium' LIMIT 1;
  SELECT id INTO midrise_id FROM maintenance_template_groups WHERE name = 'Mid Rise Condominium' LIMIT 1;
  SELECT id INTO townhome_id FROM maintenance_template_groups WHERE name = 'Townhome HOA' LIMIT 1;

  -- HIGH RISE TEMPLATES
  IF highrise_id IS NOT NULL THEN
    INSERT INTO maintenance_templates (group_id, portfolio_id, category, name, description, frequency, priority, estimated_hours, sort_order) VALUES
      (highrise_id, portfolio, 'hvac', 'HVAC filter replacement', 'Replace all common area HVAC filters', 'monthly', 'high', 4.0, 1),
      (highrise_id, portfolio, 'elevator', 'Elevator inspection', 'Annual elevator safety inspection per local code', 'annual', 'critical', 2.0, 2),
      (highrise_id, portfolio, 'elevator', 'Elevator cab cleaning', 'Deep clean all elevator cabs', 'weekly', 'medium', 1.0, 3),
      (highrise_id, portfolio, 'fire-safety', 'Fire alarm system test', 'Test all fire alarm pull stations and strobes', 'quarterly', 'critical', 3.0, 4),
      (highrise_id, portfolio, 'fire-safety', 'Fire sprinkler inspection', 'Annual sprinkler system inspection and flow test', 'annual', 'critical', 4.0, 5),
      (highrise_id, portfolio, 'fire-safety', 'Fire extinguisher check', 'Inspect and tag all fire extinguishers', 'monthly', 'high', 1.5, 6),
      (highrise_id, portfolio, 'plumbing', 'Boiler maintenance', 'Inspect and service boiler system', 'semiannual', 'high', 4.0, 7),
      (highrise_id, portfolio, 'plumbing', 'Water heater flush', 'Flush sediment from water heaters', 'semiannual', 'medium', 2.0, 8),
      (highrise_id, portfolio, 'common-area', 'Hallway carpet cleaning', 'Deep clean all hallway carpets', 'quarterly', 'low', 3.0, 9),
      (highrise_id, portfolio, 'common-area', 'Window washing exterior', 'Exterior window cleaning all floors', 'semiannual', 'medium', 8.0, 10),
      (highrise_id, portfolio, 'parking', 'Garage sweeping and power wash', 'Sweep and power wash parking garage', 'quarterly', 'medium', 6.0, 11),
      (highrise_id, portfolio, 'pest-control', 'Pest control treatment', 'Monthly pest control in common areas', 'monthly', 'medium', 2.0, 12),
      (highrise_id, portfolio, 'roofing', 'Roof inspection', 'Inspect roof for leaks and damage', 'semiannual', 'high', 3.0, 13),
      (highrise_id, portfolio, 'security', 'Security camera check', 'Verify all cameras operational', 'weekly', 'medium', 1.0, 14),
      (highrise_id, portfolio, 'security', 'Access control system test', 'Test all fobs, keypads, and intercoms', 'monthly', 'high', 2.0, 15);
  END IF;

  -- MID RISE TEMPLATES
  IF midrise_id IS NOT NULL THEN
    INSERT INTO maintenance_templates (group_id, portfolio_id, category, name, description, frequency, priority, estimated_hours, sort_order) VALUES
      (midrise_id, portfolio, 'hvac', 'HVAC filter replacement', 'Replace all common area HVAC filters', 'monthly', 'high', 2.5, 1),
      (midrise_id, portfolio, 'elevator', 'Elevator inspection', 'Annual elevator safety inspection', 'annual', 'critical', 2.0, 2),
      (midrise_id, portfolio, 'fire-safety', 'Fire alarm system test', 'Test fire alarm system', 'quarterly', 'critical', 2.0, 3),
      (midrise_id, portfolio, 'fire-safety', 'Fire extinguisher check', 'Inspect and tag fire extinguishers', 'monthly', 'high', 1.0, 4),
      (midrise_id, portfolio, 'plumbing', 'Water heater service', 'Inspect and service water heaters', 'annual', 'medium', 2.0, 5),
      (midrise_id, portfolio, 'common-area', 'Hallway carpet cleaning', 'Deep clean hallway carpets', 'quarterly', 'low', 2.0, 6),
      (midrise_id, portfolio, 'common-area', 'Common area deep clean', 'Deep clean lobby, mailroom, laundry', 'monthly', 'medium', 3.0, 7),
      (midrise_id, portfolio, 'landscaping', 'Landscaping maintenance', 'Mow, trim, weed common grounds', 'weekly', 'medium', 4.0, 8),
      (midrise_id, portfolio, 'landscaping', 'Snow removal', 'Clear walks and parking lot', 'as-needed', 'high', 3.0, 9),
      (midrise_id, portfolio, 'pest-control', 'Pest control treatment', 'Monthly pest management', 'monthly', 'medium', 1.5, 10),
      (midrise_id, portfolio, 'roofing', 'Roof inspection', 'Semi-annual roof inspection', 'semiannual', 'high', 2.0, 11),
      (midrise_id, portfolio, 'exterior', 'Gutter cleaning', 'Clean all gutters and downspouts', 'semiannual', 'medium', 3.0, 12),
      (midrise_id, portfolio, 'exterior', 'Siding inspection', 'Inspect exterior siding for damage', 'annual', 'low', 2.0, 13),
      (midrise_id, portfolio, 'parking', 'Parking lot sweeping', 'Sweep and clean parking lot', 'monthly', 'low', 2.0, 14),
      (midrise_id, portfolio, 'pool', 'Pool chemical check', 'Test and balance pool chemicals', 'daily', 'high', 0.5, 15);
  END IF;

  -- TOWNHOME TEMPLATES
  IF townhome_id IS NOT NULL THEN
    INSERT INTO maintenance_templates (group_id, portfolio_id, category, name, description, frequency, priority, estimated_hours, sort_order) VALUES
      (townhome_id, portfolio, 'landscaping', 'Lawn mowing', 'Mow all common area lawns', 'weekly', 'medium', 4.0, 1),
      (townhome_id, portfolio, 'landscaping', 'Leaf removal', 'Remove leaves from common areas', 'as-needed', 'low', 3.0, 2),
      (townhome_id, portfolio, 'landscaping', 'Snow removal', 'Clear sidewalks and driveways', 'as-needed', 'high', 3.0, 3),
      (townhome_id, portfolio, 'landscaping', 'Sprinkler winterization', 'Blow out sprinkler system', 'annual', 'high', 2.0, 4),
      (townhome_id, portfolio, 'landscaping', 'Fertilization', 'Apply fertilizer to common lawns', 'quarterly', 'low', 2.0, 5),
      (townhome_id, portfolio, 'exterior', 'Fence inspection', 'Inspect and repair common fencing', 'annual', 'medium', 3.0, 6),
      (townhome_id, portfolio, 'exterior', 'Sidewalk repair', 'Inspect and repair sidewalk cracks', 'annual', 'medium', 4.0, 7),
      (townhome_id, portfolio, 'exterior', 'Gutter cleaning', 'Clean gutters on common buildings', 'semiannual', 'medium', 3.0, 8),
      (townhome_id, portfolio, 'exterior', 'Pressure washing', 'Power wash common walkways', 'semiannual', 'low', 3.0, 9),
      (townhome_id, portfolio, 'pest-control', 'Pest control', 'Monthly pest treatment', 'monthly', 'medium', 1.5, 10),
      (townhome_id, portfolio, 'common-area', 'Clubhouse cleaning', 'Clean clubhouse common areas', 'weekly', 'medium', 2.0, 11),
      (townhome_id, portfolio, 'pool', 'Pool maintenance', 'Pool chemical balance and cleaning', 'daily', 'high', 1.0, 12),
      (townhome_id, portfolio, 'pool', 'Pool opening', 'Open pool for season', 'annual', 'high', 4.0, 13),
      (townhome_id, portfolio, 'pool', 'Pool closing', 'Close pool for winter', 'annual', 'high', 4.0, 14),
      (townhome_id, portfolio, 'playground', 'Playground inspection', 'Inspect playground equipment safety', 'monthly', 'high', 1.0, 15);
  END IF;
END $$;
