-- ============================================================================
-- Slice 1: Onboarding — extend user_invitations for the MVP role flow
-- ============================================================================

ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS mvp_role public.mvp_company_role,
  ADD COLUMN IF NOT EXISTS unit_id  uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS association_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS full_name text;

CREATE INDEX IF NOT EXISTS idx_user_invitations_email_lower
  ON public.user_invitations (lower(email));

CREATE INDEX IF NOT EXISTS idx_user_invitations_status
  ON public.user_invitations (status);

COMMENT ON COLUMN public.user_invitations.mvp_role IS
  'Role to assign on accept: company_admin / manager / assistant_manager / accountant. NULL when invitation is for board/owner/tenant (those use hoa_role + unit_id / board_members links instead).';

COMMENT ON COLUMN public.user_invitations.association_ids IS
  'For manager/assistant_manager invitations: associations they will be assigned to on accept. Empty for company_admin/accountant (full company access) or non-staff invites.';

-- ----------------------------------------------------------------------------
-- Trigger: when a new auth.users row is inserted (i.e. user accepts an invite
-- and signs up), look up the matching pending invitation by email and apply:
--   1. profile.portfolio_id + mvp_role
--   2. association_managers rows for assignments
--   3. mark invitation used
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_pending_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.user_invitations%ROWTYPE;
  v_assoc_id uuid;
BEGIN
  -- Find the most recent pending invitation matching this email (case-insensitive)
  SELECT *
    INTO v_invitation
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Update / insert profile with portfolio + role
  INSERT INTO public.profiles (id, email, full_name, portfolio_id, mvp_role, hoa_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_invitation.full_name, ''),
    v_invitation.portfolio_id,
    v_invitation.mvp_role,
    v_invitation.hoa_role
  )
  ON CONFLICT (id) DO UPDATE
    SET portfolio_id = EXCLUDED.portfolio_id,
        mvp_role     = EXCLUDED.mvp_role,
        hoa_role     = EXCLUDED.hoa_role,
        full_name    = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

  -- For manager/assistant_manager: create association_managers rows
  IF v_invitation.mvp_role IN ('manager', 'assistant_manager')
     AND array_length(v_invitation.association_ids, 1) > 0 THEN
    FOREACH v_assoc_id IN ARRAY v_invitation.association_ids LOOP
      INSERT INTO public.association_managers (
        user_id, association_id, portfolio_id, assigned_by, assigned_at
      ) VALUES (
        NEW.id, v_assoc_id, v_invitation.portfolio_id, v_invitation.invited_by, now()
      )
      ON CONFLICT (user_id, association_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Mark invitation used
  UPDATE public.user_invitations
     SET status  = 'accepted',
         used_at = now(),
         used_by = NEW.id,
         updated_at = now()
   WHERE id = v_invitation.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_pending_invitation ON auth.users;

CREATE TRIGGER trg_apply_pending_invitation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_pending_invitation();

COMMENT ON FUNCTION public.apply_pending_invitation() IS
  'Trigger function: when a user signs up, finds the most recent pending invitation for their email and applies portfolio_id + mvp_role + association assignments. Marks the invitation accepted.';

-- ----------------------------------------------------------------------------
-- RPC: Super Admin creates a new company + first Company Admin invitation
-- (Called from /admin/companies/new page)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_create_company(
  p_company_name text,
  p_admin_email text,
  p_admin_full_name text,
  p_message text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_portfolio_id uuid;
  v_invitation_id uuid;
  v_token text;
BEGIN
  -- Only platform operators can call this
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'Only platform operators can onboard companies' USING ERRCODE = '42501';
  END IF;

  IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;
  IF p_admin_email IS NULL OR length(trim(p_admin_email)) = 0 THEN
    RAISE EXCEPTION 'Admin email is required';
  END IF;

  -- Create the portfolio (company)
  INSERT INTO public.portfolios (company_name)
  VALUES (trim(p_company_name))
  RETURNING id INTO v_portfolio_id;

  -- Create the invitation for the first Company Admin
  INSERT INTO public.user_invitations (
    portfolio_id, email, mvp_role, hoa_role,
    full_name, message, invited_by
  ) VALUES (
    v_portfolio_id,
    lower(trim(p_admin_email)),
    'company_admin',
    'manager',
    trim(coalesce(p_admin_full_name, '')),
    p_message,
    auth.uid()
  )
  RETURNING id, token INTO v_invitation_id, v_token;

  RETURN jsonb_build_object(
    'portfolio_id', v_portfolio_id,
    'invitation_id', v_invitation_id,
    'invitation_token', v_token,
    'admin_email', lower(trim(p_admin_email))
  );
END;
$$;

COMMENT ON FUNCTION public.platform_create_company IS
  'Super-admin RPC: creates a portfolio + first Company Admin invitation. Returns IDs and the invitation token (the calling code is then responsible for sending the email via the invite-user edge function).';

REVOKE ALL ON FUNCTION public.platform_create_company FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_create_company TO authenticated;;
