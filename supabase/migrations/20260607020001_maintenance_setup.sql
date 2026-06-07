-- Step 1: Create the missing table and add group_id column
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

ALTER TABLE maintenance_templates ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES maintenance_template_groups(id) ON DELETE CASCADE;

ALTER TABLE maintenance_template_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view template groups" ON maintenance_template_groups FOR SELECT USING (is_staff(portfolio_id));
CREATE POLICY "Staff insert template groups" ON maintenance_template_groups FOR INSERT WITH CHECK (is_staff(portfolio_id));
CREATE POLICY "Staff update template groups" ON maintenance_template_groups FOR UPDATE USING (is_staff(portfolio_id));
CREATE POLICY "Staff delete template groups" ON maintenance_template_groups FOR DELETE USING (is_staff(portfolio_id));

CREATE INDEX IF NOT EXISTS idx_templates_group ON maintenance_templates(group_id);
