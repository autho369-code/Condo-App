-- Migration: Create inventory_items table
-- Run this in Supabase SQL Editor or via supabase migration

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  category TEXT,
  unit_of_measure TEXT,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC,
  unit_cost NUMERIC(14,2),
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Staff can view inventory for their portfolio
CREATE POLICY "Staff can view inventory_items"
  ON inventory_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('platform_operator', 'staff', 'finance')
      AND (inventory_items.portfolio_id IS NULL OR inventory_items.portfolio_id = profiles.portfolio_id)
    )
  );

-- Staff can insert inventory items
CREATE POLICY "Staff can insert inventory_items"
  ON inventory_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('platform_operator', 'staff', 'finance')
    )
  );

-- Staff can update inventory items
CREATE POLICY "Staff can update inventory_items"
  ON inventory_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('platform_operator', 'staff', 'finance')
    )
  );

-- Staff can delete inventory items
CREATE POLICY "Staff can delete inventory_items"
  ON inventory_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('platform_operator', 'staff', 'finance')
    )
  );

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_portfolio_id ON inventory_items(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);
