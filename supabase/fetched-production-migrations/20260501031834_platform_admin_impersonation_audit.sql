-- ManageOps platform admin: support impersonation audit
-- Records every "Login as" action by a super admin so we have a forensic trail.
-- A platform operator clicks "Login as" on a portfolio admin → row inserted here →
-- session cookie is stamped → all subsequent reads/writes filter by the impersonated
-- portfolio. When the operator clicks "Stop impersonating," ended_at is filled.

CREATE TABLE IF NOT EXISTS public.platform_impersonation_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid NOT NULL REFERENCES public.platform_operators(id) ON DELETE RESTRICT,
  operator_email  text NOT NULL,
  impersonated_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  impersonated_email   text,
  impersonated_portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  reason          text,                            -- support ticket #, debug note, etc.
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  ip_address      text,
  user_agent      text
);

CREATE INDEX IF NOT EXISTS idx_platform_imp_operator ON public.platform_impersonation_log(operator_id);
CREATE INDEX IF NOT EXISTS idx_platform_imp_portfolio ON public.platform_impersonation_log(impersonated_portfolio_id);
CREATE INDEX IF NOT EXISTS idx_platform_imp_started_at ON public.platform_impersonation_log(started_at DESC);

ALTER TABLE public.platform_impersonation_log ENABLE ROW LEVEL SECURITY;

-- Only platform operators can read this log
CREATE POLICY platform_imp_select_operators ON public.platform_impersonation_log
  FOR SELECT TO authenticated
  USING (public.is_platform_operator());

-- Only platform operators can insert (start an impersonation session)
CREATE POLICY platform_imp_insert_operators ON public.platform_impersonation_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());

-- Only platform operators can update (end an impersonation session)
CREATE POLICY platform_imp_update_operators ON public.platform_impersonation_log
  FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

COMMENT ON TABLE public.platform_impersonation_log IS
  'Forensic log of every "Login as" action by a ManageOps super admin. Append-only history; ended_at filled when the operator returns to their own session.';;
