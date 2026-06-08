-- Budget vs Actuals RPC (fixed - skips view RLS)

-- 1. Add annual_total column to budget_lines (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budget_lines' AND column_name = 'annual_total'
  ) THEN
    ALTER TABLE budget_lines ADD COLUMN annual_total numeric 
      GENERATED ALWAYS AS (
        (monthly_amounts[1] + monthly_amounts[2] + monthly_amounts[3] + 
         monthly_amounts[4] + monthly_amounts[5] + monthly_amounts[6] + 
         monthly_amounts[7] + monthly_amounts[8] + monthly_amounts[9] + 
         monthly_amounts[10] + monthly_amounts[11] + monthly_amounts[12])
      ) STORED;
  END IF;
END $$;

-- 2. Drop existing functions
DROP FUNCTION IF EXISTS get_budget_vs_actuals(uuid, integer);
DROP FUNCTION IF EXISTS list_budget_lines(uuid, integer);
DROP FUNCTION IF EXISTS upsert_budget_line(uuid, uuid, uuid, integer, numeric[], text, text);
DROP FUNCTION IF EXISTS delete_budget_line(uuid);

-- 3. Create the budget vs actuals RPC
CREATE OR REPLACE FUNCTION get_budget_vs_actuals(
  p_association_id uuid,
  p_fiscal_year integer
)
RETURNS TABLE (
  budget_line_id uuid,
  gl_account_id uuid,
  gl_account_number integer,
  gl_account_name text,
  category text,
  notes text,
  monthly_budget numeric[],
  monthly_actuals numeric[],
  monthly_variance numeric[],
  annual_budget numeric,
  annual_actual numeric,
  annual_variance numeric,
  annual_variance_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month int;
  v_budget_line record;
  v_actual numeric;
  v_actuals numeric[];
  v_total_budget numeric := 0;
  v_total_actual numeric := 0;
BEGIN
  FOR v_budget_line IN 
    SELECT bl.*, ga.number as gl_number, ga.name as gl_name
    FROM budget_lines bl
    JOIN gl_accounts ga ON ga.id = bl.gl_account_id
    WHERE bl.association_id = p_association_id
      AND bl.fiscal_year = p_fiscal_year
    ORDER BY ga.number
  LOOP
    v_actuals := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0];
    
    FOR v_month IN 1..12 LOOP
      DECLARE
        v_start date := make_date(p_fiscal_year, v_month, 1);
        v_end date := (v_start + interval '1 month')::date;
      BEGIN
        IF v_budget_line.category = 'expense' THEN
          SELECT COALESCE(SUM(pb.amount), 0) INTO v_actual
          FROM payable_bills pb
          WHERE pb.association_id = p_association_id
            AND pb.gl_account_id = v_budget_line.gl_account_id
            AND pb.occurred_on >= v_start
            AND pb.occurred_on < v_end
            AND pb.status IN ('paid', 'approved');
        ELSE
          SELECT COALESCE(SUM(c.amount), 0) INTO v_actual
          FROM charges c
          JOIN units u ON u.id = c.unit_id
          JOIN buildings b ON b.id = u.building_id
          WHERE b.association_id = p_association_id
            AND c.gl_account_id = v_budget_line.gl_account_id
            AND c.created_at::date >= v_start
            AND c.created_at::date < v_end;
        END IF;
        
        v_actuals[v_month] := v_actual;
      END;
    END LOOP;
    
    v_total_budget := 0;
    v_total_actual := 0;
    FOR v_month IN 1..12 LOOP
      v_total_budget := v_total_budget + v_budget_line.monthly_amounts[v_month];
      v_total_actual := v_total_actual + v_actuals[v_month];
    END LOOP;
    
    DECLARE
      v_variances numeric[];
    BEGIN
      v_variances := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0];
      FOR v_month IN 1..12 LOOP
        v_variances[v_month] := v_actuals[v_month] - v_budget_line.monthly_amounts[v_month];
      END LOOP;
      
      budget_line_id := v_budget_line.id;
      gl_account_id := v_budget_line.gl_account_id;
      gl_account_number := v_budget_line.gl_number;
      gl_account_name := v_budget_line.gl_name;
      category := v_budget_line.category;
      notes := v_budget_line.notes;
      monthly_budget := v_budget_line.monthly_amounts;
      monthly_actuals := v_actuals;
      monthly_variance := v_variances;
      annual_budget := v_total_budget;
      annual_actual := v_total_actual;
      annual_variance := v_total_actual - v_total_budget;
      annual_variance_pct := CASE 
        WHEN v_total_budget != 0 THEN ROUND(((v_total_actual - v_total_budget) / v_total_budget * 100)::numeric, 1)
        ELSE 0 
      END;
      
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- 4. RLS for budget_lines table
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_lines_select ON budget_lines;
CREATE POLICY budget_lines_select ON budget_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM associations a
      WHERE a.id = budget_lines.association_id
        AND a.portfolio_id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
  );

DROP POLICY IF EXISTS budget_lines_insert ON budget_lines;
CREATE POLICY budget_lines_insert ON budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM associations a
      WHERE a.id = budget_lines.association_id
        AND a.portfolio_id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
  );

DROP POLICY IF EXISTS budget_lines_update ON budget_lines;
CREATE POLICY budget_lines_update ON budget_lines
  FOR UPDATE TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM associations a
      WHERE a.id = budget_lines.association_id
        AND a.portfolio_id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS budget_lines_delete ON budget_lines;
CREATE POLICY budget_lines_delete ON budget_lines
  FOR DELETE TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM associations a
      WHERE a.id = budget_lines.association_id
        AND a.portfolio_id = ((current_setting('request.jwt.claims', true)::json)->>'portfolio_id')::uuid
    )
  );

DROP POLICY IF EXISTS budget_lines_platform_all ON budget_lines;
CREATE POLICY budget_lines_platform_all ON budget_lines
  FOR ALL TO authenticated
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- 5. list_budget_lines helper
CREATE OR REPLACE FUNCTION list_budget_lines(
  p_association_id uuid,
  p_fiscal_year integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  association_id uuid,
  gl_account_id uuid,
  gl_account_number integer,
  gl_account_name text,
  fiscal_year integer,
  monthly_amounts numeric[],
  annual_total numeric,
  category text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bl.id,
    bl.association_id,
    bl.gl_account_id,
    ga.number as gl_account_number,
    ga.name as gl_account_name,
    bl.fiscal_year,
    bl.monthly_amounts,
    bl.annual_total,
    bl.category::text,
    bl.notes,
    bl.created_at,
    bl.updated_at
  FROM budget_lines bl
  JOIN gl_accounts ga ON ga.id = bl.gl_account_id
  WHERE bl.association_id = p_association_id
    AND (p_fiscal_year IS NULL OR bl.fiscal_year = p_fiscal_year)
  ORDER BY bl.category, ga.number;
END;
$$;

-- 6. upsert_budget_line
CREATE OR REPLACE FUNCTION upsert_budget_line(
  p_id uuid,
  p_association_id uuid,
  p_gl_account_id uuid,
  p_fiscal_year integer,
  p_monthly_amounts numeric[],
  p_category text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE budget_lines
    SET 
      gl_account_id = p_gl_account_id,
      fiscal_year = p_fiscal_year,
      monthly_amounts = p_monthly_amounts,
      category = p_category::budget_category,
      notes = p_notes,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO budget_lines (
      association_id, gl_account_id, fiscal_year, 
      monthly_amounts, category, notes
    ) VALUES (
      p_association_id, p_gl_account_id, p_fiscal_year,
      p_monthly_amounts, p_category::budget_category, p_notes
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$$;

-- 7. delete_budget_line
CREATE OR REPLACE FUNCTION delete_budget_line(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM budget_lines WHERE id = p_id;
END;
$$;
