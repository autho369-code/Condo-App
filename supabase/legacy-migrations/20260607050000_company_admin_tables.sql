-- Company Admin Control Center: billing, invoices, communications, management fees, portfolio settings
-- Tables, indexes, RLS policies, and dashboard views scoped to portfolio_id

-- ============================================================
-- 1. BILLING USAGE — tracks company door/unit usage per subscription period
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  doors_active int DEFAULT 0,
  doors_limit int,
  doors_overage int,
  price_per_door_cents int,
  total_charge_cents int,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_usage_portfolio ON public.billing_usage(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_period ON public.billing_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_usage_subscription ON public.billing_usage(subscription_id);

-- RLS
ALTER TABLE public.billing_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins can select billing usage" ON public.billing_usage;
CREATE POLICY "Company admins can select billing usage" ON public.billing_usage
  FOR SELECT USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can insert billing usage" ON public.billing_usage;
CREATE POLICY "Company admins can insert billing usage" ON public.billing_usage
  FOR INSERT WITH CHECK (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can update billing usage" ON public.billing_usage;
CREATE POLICY "Company admins can update billing usage" ON public.billing_usage
  FOR UPDATE USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );


-- ============================================================
-- 2. INVOICES — billing invoices for management companies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  number text,
  period_start date,
  period_end date,
  subtotal_cents int,
  tax_cents int,
  total_cents int,
  status text DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','overdue')),
  paid_at timestamptz,
  stripe_invoice_id text,
  stripe_invoice_url text,
  billing_usage_id uuid REFERENCES public.billing_usage(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_portfolio ON public.invoices(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices(subscription_id);

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins can select invoices" ON public.invoices;
CREATE POLICY "Company admins can select invoices" ON public.invoices
  FOR SELECT USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can insert invoices" ON public.invoices;
CREATE POLICY "Company admins can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can update invoices" ON public.invoices;
CREATE POLICY "Company admins can update invoices" ON public.invoices
  FOR UPDATE USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );


-- ============================================================
-- 3. COMMUNICATIONS LOG — email/SMS usage tracking per portfolio
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  association_id uuid REFERENCES public.associations(id) ON DELETE SET NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms','announcement','board_message')),
  recipient_count int DEFAULT 1,
  status text DEFAULT 'sent' CHECK (status IN ('sent','failed','delivered')),
  subject text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communications_log_portfolio ON public.communications_log(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_communications_log_created ON public.communications_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_log_channel ON public.communications_log(channel);

-- RLS
ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins can select communications log" ON public.communications_log;
CREATE POLICY "Company admins can select communications log" ON public.communications_log
  FOR SELECT USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can insert communications log" ON public.communications_log;
CREATE POLICY "Company admins can insert communications log" ON public.communications_log
  FOR INSERT WITH CHECK (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );


-- ============================================================
-- 4. MANAGEMENT FEES — management fee income tracking per association
-- ============================================================
CREATE TABLE IF NOT EXISTS public.management_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  month date NOT NULL,
  fee_amount_cents int DEFAULT 0,
  collected_cents int DEFAULT 0,
  delinquent_cents int DEFAULT 0,
  door_count int,
  avg_per_door_cents int,
  created_at timestamptz DEFAULT now(),
  UNIQUE (association_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_management_fees_portfolio ON public.management_fees(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_management_fees_association ON public.management_fees(association_id);
CREATE INDEX IF NOT EXISTS idx_management_fees_month ON public.management_fees(month);

-- RLS
ALTER TABLE public.management_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins can select management fees" ON public.management_fees;
CREATE POLICY "Company admins can select management fees" ON public.management_fees
  FOR SELECT USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can insert management fees" ON public.management_fees;
CREATE POLICY "Company admins can insert management fees" ON public.management_fees
  FOR INSERT WITH CHECK (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );

DROP POLICY IF EXISTS "Company admins can update management fees" ON public.management_fees;
CREATE POLICY "Company admins can update management fees" ON public.management_fees
  FOR UPDATE USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
  );


-- ============================================================
-- 5. PORTFOLIO SETTINGS — company-level settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portfolio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL UNIQUE REFERENCES public.portfolios(id) ON DELETE CASCADE,
  logo_url text,
  office_address text,
  office_phone text,
  billing_email text,
  notification_prefs jsonb DEFAULT '{}'::jsonb,
  manager_defaults jsonb DEFAULT '{}'::jsonb,
  owner_invite_defaults jsonb DEFAULT '{}'::jsonb,
  vendor_invite_defaults jsonb DEFAULT '{}'::jsonb,
  branding_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.portfolio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins can select portfolio settings" ON public.portfolio_settings;
CREATE POLICY "Company admins can select portfolio settings" ON public.portfolio_settings
  FOR SELECT USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
    OR is_platform_operator()
  );

DROP POLICY IF EXISTS "Company admins can update portfolio settings" ON public.portfolio_settings;
CREATE POLICY "Company admins can update portfolio settings" ON public.portfolio_settings
  FOR UPDATE USING (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
    OR is_platform_operator()
  )
  WITH CHECK (
    is_company_admin()
    AND (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid()) = portfolio_id
    OR is_platform_operator()
  );

DROP POLICY IF EXISTS "Platform operators can insert portfolio settings" ON public.portfolio_settings;
CREATE POLICY "Platform operators can insert portfolio settings" ON public.portfolio_settings
  FOR INSERT WITH CHECK (is_platform_operator());

DROP POLICY IF EXISTS "Platform operators can delete portfolio settings" ON public.portfolio_settings;
CREATE POLICY "Platform operators can delete portfolio settings" ON public.portfolio_settings
  FOR DELETE USING (is_platform_operator());


-- ============================================================
-- 6. VIEW: v_company_health — company-wide health metrics
--    Health status derived from work order / violation counts per association
-- ============================================================
CREATE OR REPLACE VIEW public.v_company_health AS
WITH assoc_health AS (
  SELECT
    a.portfolio_id,
    a.id AS association_id,
    a.unit_count,
    a.status AS assoc_status,
    COUNT(DISTINCT wo.id) FILTER (
      WHERE wo.status IN ('new', 'in_progress', 'scheduled')
    ) AS open_wos,
    COUNT(DISTINCT wo.id) FILTER (
      WHERE wo.status IN ('new', 'in_progress', 'scheduled')
        AND wo.scheduled_date < CURRENT_DATE
    ) AS overdue_wos,
    COUNT(DISTINCT vc.id) FILTER (
      WHERE vc.status NOT IN ('closed', 'violation_dismissed') AND vc.archived_at IS NULL
    ) AS open_violations,
    COALESCE(
      AVG(
        EXTRACT(EPOCH FROM (wo.completed_date - wo.created_at)) / 3600.0
      ) FILTER (WHERE wo.completed_date IS NOT NULL),
      0
    ) AS avg_response_hours
  FROM public.associations a
  LEFT JOIN public.work_orders wo ON wo.association_id = a.id AND wo.archived_at IS NULL
  LEFT JOIN public.violation_cases vc ON vc.association_id = a.id
  WHERE a.archived_at IS NULL
  GROUP BY a.portfolio_id, a.id, a.unit_count, a.status
)
SELECT
  p.id AS portfolio_id,
  COUNT(DISTINCT ah.association_id) AS total_associations,
  COALESCE(SUM(ah.unit_count), 0) AS total_doors,
  COUNT(DISTINCT ah.association_id) FILTER (
    WHERE ah.open_wos = 0 AND ah.open_violations = 0
  ) AS healthy_count,
  COUNT(DISTINCT ah.association_id) FILTER (
    WHERE (ah.open_wos BETWEEN 1 AND 3) OR (ah.open_violations BETWEEN 1 AND 2)
  ) AS warning_count,
  COUNT(DISTINCT ah.association_id) FILTER (
    WHERE ah.open_wos > 3 OR ah.open_violations > 2 OR ah.overdue_wos > 0
  ) AS critical_count,
  COALESCE(SUM(ah.open_wos), 0) AS open_work_orders,
  COALESCE(SUM(ah.overdue_wos), 0) AS overdue_work_orders,
  COALESCE(SUM(ah.open_violations), 0) AS open_violations,
  COALESCE(AVG(ah.avg_response_hours) FILTER (WHERE ah.avg_response_hours > 0), 0) AS avg_response_hours,
  COALESCE(
    (SELECT SUM(mf.delinquent_cents)
     FROM public.management_fees mf
     WHERE mf.portfolio_id = p.id
       AND mf.month = date_trunc('month', CURRENT_DATE)::date),
    0
  ) AS delinquency_total_cents
FROM public.portfolios p
LEFT JOIN assoc_health ah ON ah.portfolio_id = p.id
GROUP BY p.id;


-- ============================================================
-- 7. VIEW: v_company_metrics — company-level financial/operational metrics
-- ============================================================
CREATE OR REPLACE VIEW public.v_company_metrics AS
SELECT
  p.id AS portfolio_id,
  'current_month' AS period,
  COALESCE(
    (SELECT SUM(mf.collected_cents)
     FROM public.management_fees mf
     WHERE mf.portfolio_id = p.id
       AND mf.month = date_trunc('month', CURRENT_DATE)::date),
    0
  ) AS total_revenue_cents,
  COALESCE(
    (SELECT SUM(mf.fee_amount_cents)
     FROM public.management_fees mf
     WHERE mf.portfolio_id = p.id
       AND mf.month = date_trunc('month', CURRENT_DATE)::date),
    0
  ) AS management_fee_income_cents,
  COALESCE(
    (SELECT COUNT(DISTINCT am.user_id)
     FROM public.association_managers am
     JOIN public.associations a ON a.id = am.association_id
     WHERE a.portfolio_id = p.id AND a.archived_at IS NULL
       AND am.ended_at IS NULL),
    0
  ) AS active_managers,
  COALESCE(SUM(a.unit_count), 0) AS total_doors,
  COALESCE(
    (SELECT bu.doors_active
     FROM public.billing_usage bu
     WHERE bu.portfolio_id = p.id
       AND bu.status = 'active'
     ORDER BY bu.period_end DESC
     LIMIT 1),
    0
  ) AS doors_used,
  COALESCE(
    (SELECT bu.doors_limit
     FROM public.billing_usage bu
     WHERE bu.portfolio_id = p.id
       AND bu.status = 'active'
     ORDER BY bu.period_end DESC
     LIMIT 1),
    0
  ) AS doors_limit,
  COALESCE(
    (SELECT bu.status
     FROM public.billing_usage bu
     WHERE bu.portfolio_id = p.id
       AND bu.status = 'active'
     ORDER BY bu.period_end DESC
     LIMIT 1),
    'inactive'
  ) AS subscription_status
FROM public.portfolios p
LEFT JOIN public.associations a ON a.portfolio_id = p.id AND a.archived_at IS NULL
GROUP BY p.id;


-- ============================================================
-- 8. VIEW: v_manager_workload — per-manager workload summary
-- ============================================================
CREATE OR REPLACE VIEW public.v_manager_workload AS
SELECT
  pr.id AS manager_id,
  pr.full_name AS manager_name,
  pr.email AS manager_email,
  COUNT(DISTINCT am.association_id) AS assigned_associations,
  COALESCE(SUM(a.unit_count), 0) AS total_doors_managed,
  COUNT(DISTINCT wo.id) FILTER (
    WHERE wo.status IN ('new', 'in_progress', 'scheduled')
  ) AS open_work_orders,
  COUNT(DISTINCT wo.id) FILTER (
    WHERE wo.status IN ('new', 'in_progress', 'scheduled')
      AND wo.scheduled_date < CURRENT_DATE
  ) AS overdue_work_orders,
  COUNT(DISTINCT vc.id) FILTER (
    WHERE vc.status NOT IN ('closed', 'violation_dismissed') AND vc.archived_at IS NULL
  ) AS open_violations,
  0 AS open_arch_reviews,  -- architectural_reviews table not yet created
  au.last_sign_in_at AS last_login
FROM public.profiles pr
JOIN public.association_managers am ON am.user_id = pr.id AND am.ended_at IS NULL
JOIN public.associations a ON a.id = am.association_id AND a.archived_at IS NULL
LEFT JOIN public.work_orders wo ON wo.association_id = a.id AND wo.archived_at IS NULL
LEFT JOIN public.violation_cases vc ON vc.association_id = a.id
LEFT JOIN auth.users au ON au.id = pr.id
WHERE pr.hoa_role IN ('manager', 'company_admin')
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.id = pr.role_id
      AND ur.name IN ('President', 'Property Manager', 'Accountant')
  )
GROUP BY pr.id, pr.full_name, pr.email, au.last_sign_in_at;
