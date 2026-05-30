-- Owner Workflow System — Migration
-- Tables: owner_portal_invites, owner_packets, owner_form_submissions, 
--          owner_ach_status, management_agreements, audit_logs

-- ─── Portal Invites ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_portal_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  email         text NOT NULL,
  status        text NOT NULL DEFAULT 'not_invited'
                CHECK (status IN ('not_invited','sent','active','expired')),
  token         text UNIQUE,
  sent_at       timestamptz,
  activated_at  timestamptz,
  expires_at    timestamptz DEFAULT (now() + interval '7 days'),
  last_login_at timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.owner_portal_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage portal invites" ON public.owner_portal_invites FOR ALL
  USING (is_staff() OR is_platform_operator());

-- ─── Owner Packets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_packets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','completed','archived')),
  owner_info          jsonb DEFAULT '{}',       -- name, email, phone, dob
  unit_info           jsonb DEFAULT '{}',       -- unit_id, address, move_in_date
  emergency_contact   jsonb DEFAULT '{}',       -- name, phone, relationship
  vehicle_info        jsonb DEFAULT '[]',       -- [{make, model, year, plate, color}]
  pet_info            jsonb DEFAULT '[]',       -- [{name, type, breed, esa, service_animal}]
  communication_pref  text DEFAULT 'email',     -- email, sms, both
  acknowledgments     jsonb DEFAULT '{}',       -- {rules: bool, lead_paint: bool, etc}
  submitted_at        timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.owner_packets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage packets" ON public.owner_packets FOR ALL
  USING (is_staff() OR is_platform_operator());
CREATE POLICY "Owners read own packet" ON public.owner_packets FOR SELECT
  USING (owner_id IN (SELECT id FROM public.owners WHERE email = auth.email()));

-- ─── Owner Form Submissions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  form_type     text NOT NULL
                CHECK (form_type IN (
                  'owner_contact','emergency_contact','tenant_info',
                  'vehicle_parking','pet_esa','ach_setup','management_agreement'
                )),
  status        text DEFAULT 'draft'
                CHECK (status IN ('draft','submitted','approved','rejected')),
  form_data     jsonb DEFAULT '{}',
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid REFERENCES auth.users(id),
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.owner_form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage form submissions" ON public.owner_form_submissions FOR ALL
  USING (is_staff() OR is_platform_operator());
CREATE POLICY "Owners read own forms" ON public.owner_form_submissions FOR SELECT
  USING (owner_id IN (SELECT id FROM public.owners WHERE email = auth.email()));

-- ─── ACH Status ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_ach_status (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL UNIQUE REFERENCES public.owners(id) ON DELETE CASCADE,
  status          text DEFAULT 'not_started'
                  CHECK (status IN ('not_started','invite_sent','completed','verified','failed')),
  payment_method_id text,                    -- Stripe payment method ID
  invited_at      timestamptz,
  completed_at    timestamptz,
  verified_at     timestamptz,
  last_error      text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.owner_ach_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ACH status" ON public.owner_ach_status FOR ALL
  USING (is_staff() OR is_platform_operator());

-- ─── Management Agreements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.management_agreements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  unit_id         uuid REFERENCES public.units(id) ON DELETE SET NULL,
  status          text DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','signed_by_owner','signed_by_manager','active','expired','cancelled')),
  agreement_data  jsonb DEFAULT '{}',        -- terms, fees, duration, services
  owner_signed_at timestamptz,
  owner_signature text,                      -- e-signature data
  manager_signed_at timestamptz,
  manager_signature text,
  signed_document_url text,                  -- stored PDF if generated
  expires_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.management_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage agreements" ON public.management_agreements FOR ALL
  USING (is_staff() OR is_platform_operator());
CREATE POLICY "Owners read own agreements" ON public.management_agreements FOR SELECT
  USING (owner_id IN (SELECT id FROM public.owners WHERE email = auth.email()));

-- ─── Audit Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,
  entity_id     uuid,
  action        text NOT NULL,
  actor_id      uuid REFERENCES auth.users(id),
  actor_email   text,
  changes       jsonb DEFAULT '{}',
  ip_address    text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read audit logs" ON public.audit_logs FOR SELECT
  USING (is_staff() OR is_platform_operator());
CREATE POLICY "System insert audit logs" ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ─── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_invites_owner ON public.owner_portal_invites(owner_id);
CREATE INDEX IF NOT EXISTS idx_portal_invites_status ON public.owner_portal_invites(status);
CREATE INDEX IF NOT EXISTS idx_packets_owner ON public.owner_packets(owner_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_owner ON public.owner_form_submissions(owner_id, form_type);
CREATE INDEX IF NOT EXISTS idx_agreements_owner ON public.management_agreements(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ─── Audit Log Trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, actor_email, changes)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP, auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
