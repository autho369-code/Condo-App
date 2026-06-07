-- HO6 Insurance Certificate Tracking System
-- Owners submit HO6 policies → AI or manual entry → auto 30-day expiration reminders

-- 1. Insurance policies table
CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  association_id uuid REFERENCES public.associations(id),
  policy_number text NOT NULL,
  insurance_company text NOT NULL,
  coverage_amount numeric(12,2),
  liability_amount numeric(12,2),
  deductible_amount numeric(12,2),
  effective_date date NOT NULL,
  expiration_date date NOT NULL,
  certificate_file_url text,          -- uploaded PDF/image
  extracted_fields jsonb,              -- AI-extracted raw data
  extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending','processing','completed','failed','manual')),
  status text DEFAULT 'active' CHECK (status IN ('active','expired','expiring_soon','cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived_at timestamptz
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_insurance_policies_owner ON public.insurance_policies(owner_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_association ON public.insurance_policies(association_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_expiration ON public.insurance_policies(expiration_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON public.insurance_policies(status);

-- 3. RLS — owners see their own, staff see their portfolio's
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own insurance" ON public.insurance_policies
  FOR SELECT USING (
    owner_id IN (SELECT id FROM owners WHERE auth_user_id = auth.uid())
    OR is_any_staff()
    OR is_platform_operator()
  );

CREATE POLICY "Staff can manage insurance" ON public.insurance_policies
  FOR ALL USING (is_any_staff() OR is_platform_operator());

CREATE POLICY "Owners can insert own insurance" ON public.insurance_policies
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM owners WHERE auth_user_id = auth.uid())
  );

-- 4. View: upcoming expirations for dashboard
CREATE OR REPLACE VIEW public.v_upcoming_expirations AS
SELECT 
  ip.id,
  ip.policy_number,
  ip.insurance_company,
  ip.expiration_date,
  ip.coverage_amount,
  ip.status,
  o.full_name AS owner_name,
  o.email AS owner_email,
  a.name AS association_name,
  a.id AS association_id,
  (ip.expiration_date - CURRENT_DATE) AS days_remaining
FROM public.insurance_policies ip
JOIN public.owners o ON o.id = ip.owner_id
LEFT JOIN public.associations a ON a.id = ip.association_id
WHERE ip.archived_at IS NULL
  AND ip.status IN ('active', 'expiring_soon')
ORDER BY ip.expiration_date ASC;

-- 5. Function: auto-update status to expiring_soon when within 30 days
CREATE OR REPLACE FUNCTION public.check_insurance_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.insurance_policies
  SET status = 'expiring_soon', updated_at = now()
  WHERE status = 'active'
    AND expiration_date <= (CURRENT_DATE + INTERVAL '30 days')
    AND expiration_date > CURRENT_DATE;

  UPDATE public.insurance_policies
  SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'expiring_soon')
    AND expiration_date < CURRENT_DATE;
END;
$$;

-- 6. Trigger: auto-set updated_at
CREATE OR REPLACE FUNCTION public.trg_insurance_policies_updated()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_policies_updated ON public.insurance_policies;
CREATE TRIGGER trg_insurance_policies_updated
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.trg_insurance_policies_updated();
