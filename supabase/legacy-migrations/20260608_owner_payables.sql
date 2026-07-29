-- Owner Payables — Track owner refunds, settlements, distributions
-- Separate from vendor payables (payable_bills)

-- 1. Create enum for owner payable type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_payable_type') THEN
    CREATE TYPE owner_payable_type AS ENUM ('refund', 'settlement', 'distribution', 'other');
  END IF;
END $$;

-- 2. Create owner_payables table
CREATE TABLE IF NOT EXISTS owner_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id),
  association_id uuid NOT NULL REFERENCES associations(id),
  owner_id uuid NOT NULL REFERENCES owners(id),
  gl_account_id uuid REFERENCES gl_accounts(id),
  bank_account_id uuid REFERENCES bank_accounts(id),
  payable_number text,
  payable_type owner_payable_type NOT NULL DEFAULT 'refund',
  payable_date date DEFAULT CURRENT_DATE,
  due_date date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  memo text,
  status payable_bill_status NOT NULL DEFAULT 'draft',
  payment_method text,
  payment_reference text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  archived_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_owner_payables_portfolio ON owner_payables(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_owner_payables_association ON owner_payables(association_id);
CREATE INDEX IF NOT EXISTS idx_owner_payables_owner ON owner_payables(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_payables_status ON owner_payables(status);
CREATE INDEX IF NOT EXISTS idx_owner_payables_due_date ON owner_payables(due_date);

-- 4. Auto-generate payable_number trigger
CREATE OR REPLACE FUNCTION generate_owner_payable_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_seq int;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(payable_number, '^OP-\d{4}-', ''), '')::int), 0) + 1
    INTO v_seq
    FROM owner_payables
    WHERE payable_number LIKE 'OP-' || v_year || '-%';
  NEW.payable_number := 'OP-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_payable_number ON owner_payables;
CREATE TRIGGER trg_owner_payable_number
  BEFORE INSERT ON owner_payables
  FOR EACH ROW
  WHEN (NEW.payable_number IS NULL)
  EXECUTE FUNCTION generate_owner_payable_number();

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION update_owner_payables_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_payables_updated_at ON owner_payables;
CREATE TRIGGER trg_owner_payables_updated_at
  BEFORE UPDATE ON owner_payables
  FOR EACH ROW
  EXECUTE FUNCTION update_owner_payables_updated_at();

-- 6. RLS
ALTER TABLE owner_payables ENABLE ROW LEVEL SECURITY;

-- Platform operator bypass (CRITICAL: prevents silent 0-row results for platform operators)
DROP POLICY IF EXISTS owner_payables_platform_all ON owner_payables;
CREATE POLICY owner_payables_platform_all ON owner_payables
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- Staff select — portfolio-scoped
DROP POLICY IF EXISTS owner_payables_select ON owner_payables;
CREATE POLICY owner_payables_select ON owner_payables
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = owner_payables.portfolio_id
        AND p.id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
    OR is_platform_operator()
  );

-- Staff insert
DROP POLICY IF EXISTS owner_payables_insert ON owner_payables;
CREATE POLICY owner_payables_insert ON owner_payables
  FOR INSERT TO authenticated
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = owner_payables.portfolio_id
        AND p.id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
    OR is_platform_operator()
  );

-- Staff update
DROP POLICY IF EXISTS owner_payables_update ON owner_payables;
CREATE POLICY owner_payables_update ON owner_payables
  FOR UPDATE TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = owner_payables.portfolio_id
        AND p.id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
    OR is_platform_operator()
  )
  WITH CHECK (true);

-- Staff delete
DROP POLICY IF EXISTS owner_payables_delete ON owner_payables;
CREATE POLICY owner_payables_delete ON owner_payables
  FOR DELETE TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = owner_payables.portfolio_id
        AND p.id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
    OR is_platform_operator()
  );
