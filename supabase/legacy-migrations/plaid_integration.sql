-- Plaid bank linking: plaid_items + bank_transactions tables
-- Migration for Plaid integration

-- plaid_items: one row per connected bank institution
CREATE TABLE IF NOT EXISTS plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  plaid_item_id text NOT NULL,
  plaid_access_token text NOT NULL,
  plaid_institution_id text,
  plaid_institution_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected')),
  last_sync_at timestamptz,
  error_message text,
  cursor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- bank_transactions: synced from Plaid, auto-matched to GL
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  plaid_item_id uuid REFERENCES plaid_items(id) ON DELETE SET NULL,
  plaid_transaction_id text NOT NULL,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  name text NOT NULL,
  merchant_name text,
  category text,
  category_detail text,
  pending boolean NOT NULL DEFAULT false,
  iso_currency_code text DEFAULT 'USD',
  gl_account_id uuid REFERENCES gl_accounts(id),
  matched_at timestamptz,
  match_confidence numeric(3,2),
  match_method text,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_tx_plaid_id 
  ON bank_transactions(bank_account_id, plaid_transaction_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_tx_date 
  ON bank_transactions(bank_account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_tx_unreviewed 
  ON bank_transactions(bank_account_id, reviewed) 
  WHERE reviewed = false;

-- Updated_at trigger for plaid_items
CREATE OR REPLACE FUNCTION update_plaid_items_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plaid_items_updated_at ON plaid_items;
CREATE TRIGGER trg_plaid_items_updated_at
  BEFORE UPDATE ON plaid_items
  FOR EACH ROW EXECUTE FUNCTION update_plaid_items_updated_at();

-- RLS policies (matching existing finance table pattern)
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Platform operator bypass
DROP POLICY IF EXISTS plaid_items_platform_all ON plaid_items;
CREATE POLICY plaid_items_platform_all ON plaid_items
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

DROP POLICY IF EXISTS bank_transactions_platform_all ON bank_transactions;
CREATE POLICY bank_transactions_platform_all ON bank_transactions
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- Finance staff policies (using existing can_manage_finance function)
DROP POLICY IF EXISTS plaid_items_finance_all ON plaid_items;
CREATE POLICY plaid_items_finance_all ON plaid_items
  FOR ALL TO authenticated
  USING (can_manage_finance(portfolio_id))
  WITH CHECK (can_manage_finance(portfolio_id));

DROP POLICY IF EXISTS bank_transactions_finance_all ON bank_transactions;
CREATE POLICY bank_transactions_finance_all ON bank_transactions
  FOR ALL TO authenticated
  USING (can_manage_finance(portfolio_id))
  WITH CHECK (can_manage_finance(portfolio_id));
