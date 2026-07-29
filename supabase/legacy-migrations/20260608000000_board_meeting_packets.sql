-- Board Meeting Packets — agenda builder, document attachments, financial snapshots
-- 1. Add association/portfolio context to existing meetings table
-- 2. Create agenda_items table for structured agenda building
-- 3. Create meeting_documents table for document attachments

-- ============================================================
-- 1. Update existing meetings table to add association context
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'association_id') THEN
    ALTER TABLE meetings ADD COLUMN association_id uuid REFERENCES public.associations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'portfolio_id') THEN
    ALTER TABLE meetings ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'packet_generated_at') THEN
    ALTER TABLE meetings ADD COLUMN packet_generated_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 2. Create agenda_items table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id integer NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  duration_minutes integer,
  presenter text,
  category text DEFAULT 'general' CHECK (category IN ('general', 'financial', 'operations', 'governance', 'compliance', 'old_business', 'new_business', 'executive_session')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

-- Board members can view agenda items for their association's meetings
DROP POLICY IF EXISTS board_view_agenda ON public.agenda_items;
CREATE POLICY board_view_agenda ON public.agenda_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members bm
      JOIN public.meetings m ON m.id = agenda_items.meeting_id
      WHERE bm.auth_user_id = auth.uid()
      AND bm.active = true
      AND bm.association_id = m.association_id
    )
  );

-- Staff can manage agenda items for their portfolio's meetings
DROP POLICY IF EXISTS staff_manage_agenda ON public.agenda_items;
CREATE POLICY staff_manage_agenda ON public.agenda_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.associations a ON a.id = m.association_id
      WHERE m.id = agenda_items.meeting_id
      AND a.portfolio_id = current_portfolio_id()
    )
    AND is_full_access_staff()
  )
  WITH CHECK (true);

-- Platform operators can do everything
DROP POLICY IF EXISTS operator_all_agenda ON public.agenda_items;
CREATE POLICY operator_all_agenda ON public.agenda_items FOR ALL
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- ============================================================
-- 3. Create meeting_documents table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meeting_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id integer NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

-- Board members can view documents for their association's meetings
DROP POLICY IF EXISTS board_view_docs ON public.meeting_documents;
CREATE POLICY board_view_docs ON public.meeting_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members bm
      JOIN public.meetings m ON m.id = meeting_documents.meeting_id
      WHERE bm.auth_user_id = auth.uid()
      AND bm.active = true
      AND bm.association_id = m.association_id
    )
  );

-- Staff can manage documents for their portfolio's meetings
DROP POLICY IF EXISTS staff_manage_docs ON public.meeting_documents;
CREATE POLICY staff_manage_docs ON public.meeting_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.associations a ON a.id = m.association_id
      WHERE m.id = meeting_documents.meeting_id
      AND a.portfolio_id = current_portfolio_id()
    )
    AND is_full_access_staff()
  )
  WITH CHECK (true);

-- Platform operators can do everything
DROP POLICY IF EXISTS operator_all_docs ON public.meeting_documents;
CREATE POLICY operator_all_docs ON public.meeting_documents FOR ALL
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- ============================================================
-- 4. Update meetings table RLS for board member access
-- ============================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Board members can view meetings for their associations
DROP POLICY IF EXISTS board_view_meetings ON public.meetings;
CREATE POLICY board_view_meetings ON public.meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members
      WHERE auth_user_id = auth.uid()
      AND active = true
      AND association_id = meetings.association_id
    )
  );

-- Staff can manage meetings for their portfolio
DROP POLICY IF EXISTS staff_manage_meetings ON public.meetings;
CREATE POLICY staff_manage_meetings ON public.meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.associations a
      WHERE a.id = meetings.association_id
      AND a.portfolio_id = current_portfolio_id()
    )
    AND is_full_access_staff()
  )
  WITH CHECK (true);

-- Platform operators can do everything
DROP POLICY IF EXISTS operator_all_meetings ON public.meetings;
CREATE POLICY operator_all_meetings ON public.meetings FOR ALL
  USING (is_platform_operator())
  WITH CHECK (is_platform_operator());

-- ============================================================
-- 5. RPC to reorder agenda items
-- ============================================================
CREATE OR REPLACE FUNCTION reorder_agenda_items(p_meeting_id integer, p_item_ids integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  FOR i IN 1..array_length(p_item_ids, 1) LOOP
    UPDATE agenda_items
    SET sort_order = i, updated_at = now()
    WHERE meeting_id = p_meeting_id AND id = p_item_ids[i];
  END LOOP;
END;
$$;

-- ============================================================
-- 6. RPC to generate board packet metadata (financial snapshots)
-- ============================================================
CREATE OR REPLACE FUNCTION get_meeting_financial_snapshot(
  p_association_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total_receivables numeric := 0;
  v_total_payables numeric := 0;
  v_delinquency_count int := 0;
  v_bank_balance numeric := 0;
  v_current_month_income numeric := 0;
  v_current_month_expenses numeric := 0;
BEGIN
  -- Total open receivables
  SELECT COALESCE(SUM(c.amount), 0) INTO v_total_receivables
  FROM charges c
  JOIN units u ON u.id = c.unit_id
  JOIN buildings b ON b.id = u.building_id
  WHERE b.association_id = p_association_id
    AND c.paid = false;

  -- Total open payables
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payables
  FROM payable_bills
  WHERE association_id = p_association_id
    AND status NOT IN ('paid', 'cancelled', 'void');

  -- Delinquency count (owners behind on dues)
  SELECT COUNT(*) INTO v_delinquency_count
  FROM occupancies o
  JOIN units u ON u.id = o.unit_id
  JOIN buildings b ON b.id = u.building_id
  WHERE b.association_id = p_association_id
    AND o.dues_paid_through < date_trunc('month', now())::date;

  -- Total bank balance
  SELECT COALESCE(SUM(current_balance), 0) INTO v_bank_balance
  FROM bank_accounts
  WHERE association_id = p_association_id;

  -- Current month income
  SELECT COALESCE(SUM(c.amount), 0) INTO v_current_month_income
  FROM charges c
  JOIN units u ON u.id = c.unit_id
  JOIN buildings b ON b.id = u.building_id
  WHERE b.association_id = p_association_id
    AND c.created_at >= date_trunc('month', now());

  -- Current month expenses
  SELECT COALESCE(SUM(amount), 0) INTO v_current_month_expenses
  FROM payable_bills
  WHERE association_id = p_association_id
    AND occurred_on >= date_trunc('month', now())::date
    AND status IN ('paid', 'approved');

  v_result := jsonb_build_object(
    'total_receivables', v_total_receivables,
    'total_payables', v_total_payables,
    'delinquency_count', v_delinquency_count,
    'bank_balance', v_bank_balance,
    'current_month_income', v_current_month_income,
    'current_month_expenses', v_current_month_expenses,
    'net_income', v_current_month_income - v_current_month_expenses,
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;
