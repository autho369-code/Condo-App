CREATE TABLE IF NOT EXISTS bank_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_date date,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  category text,
  quantity_on_hand numeric(10,2) DEFAULT 0,
  reorder_point numeric(10,2),
  unit_of_measure text DEFAULT 'ea',
  location text,
  unit_cost numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
