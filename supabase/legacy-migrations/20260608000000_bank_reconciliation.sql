-- Bank reconciliation tables
-- Allows tracking reconciliation sessions and matching book entries to bank statements

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  statement_date date NOT NULL,
  statement_balance numeric(12,2) NOT NULL DEFAULT 0,
  ending_book_balance numeric(12,2) NOT NULL DEFAULT 0,
  reconciled_balance numeric(12,2),
  difference numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'void')),
  notes text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  journal_line_id uuid REFERENCES journal_lines(id),
  -- For bank-only items not in journal_lines
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'book' CHECK (type IN ('book', 'bank_only')),
  is_cleared boolean NOT NULL DEFAULT false,
  cleared_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account ON bank_reconciliations(bank_account_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_items_recon ON bank_reconciliation_items(reconciliation_id);

-- Update bank_accounts last_reconciliation_date when reconciliation is completed
CREATE OR REPLACE FUNCTION update_bank_account_reconciliation_date()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE bank_accounts
    SET last_reconciliation_date = NEW.statement_date,
        updated_at = now()
    WHERE id = NEW.bank_account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bank_reconciliation_complete ON bank_reconciliations;
CREATE TRIGGER trg_bank_reconciliation_complete
  AFTER UPDATE ON bank_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_account_reconciliation_date();

-- RLS policies
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- Platform operator bypass
DROP POLICY IF EXISTS bank_reconciliations_platform_all ON bank_reconciliations;
CREATE POLICY bank_reconciliations_platform_all ON bank_reconciliations
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

DROP POLICY IF EXISTS bank_reconciliation_items_platform_all ON bank_reconciliation_items;
CREATE POLICY bank_reconciliation_items_platform_all ON bank_reconciliation_items
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- Finance staff access (same pattern as bank_accounts)
DROP POLICY IF EXISTS bank_reconciliations_finance_all ON bank_reconciliations;
CREATE POLICY bank_reconciliations_finance_all ON bank_reconciliations
  FOR ALL TO authenticated
  USING (can_manage_finance(portfolio_id))
  WITH CHECK (can_manage_finance(portfolio_id));

DROP POLICY IF EXISTS bank_reconciliation_items_finance_all ON bank_reconciliation_items;
CREATE POLICY bank_reconciliation_items_finance_all ON bank_reconciliation_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bank_reconciliations br
      WHERE br.id = bank_reconciliation_items.reconciliation_id
      AND can_manage_finance(br.portfolio_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bank_reconciliations br
      WHERE br.id = bank_reconciliation_items.reconciliation_id
      AND can_manage_finance(br.portfolio_id)
    )
  );
