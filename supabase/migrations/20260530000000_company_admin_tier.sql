-- Migration: Invite Company Admin RPC (superadmin-only)
-- Creates the portfolio admin tier in the invite hierarchy

BEGIN;

-- INVITE COMPANY ADMIN (Superadmin only)
-- Only platform_operators can call this. Creates a portfolio and invites the admin.
CREATE OR REPLACE FUNCTION public.invite_company_admin(
  p_email text,
  p_full_name text,
  p_company_name text,
  p_portfolio_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- SUPERADMIN GATE: only platform operators can invite company admins
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_operators 
    WHERE auth_user_id = v_user_id AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Only platform operators can invite company admins');
  END IF;

  -- Use existing portfolio or create new one
  IF p_portfolio_id IS NOT NULL THEN
    v_portfolio_id := p_portfolio_id;
  ELSE
    INSERT INTO public.portfolios (company_name, created_by)
    VALUES (p_company_name, v_user_id::text)
    RETURNING id INTO v_portfolio_id;
  END IF;

  -- Check if this email already has a pending invitation for this portfolio
  IF EXISTS (
    SELECT 1 FROM public.user_invitations
    WHERE email = p_email AND portfolio_id = v_portfolio_id AND status = 'sent'
  ) THEN
    RETURN jsonb_build_object('error', 'An invitation is already pending for this email');
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (
    email, full_name, role, portfolio_id, token, created_by, 
    status, expires_at, metadata
  )
  VALUES (
    p_email, p_full_name, 'company_admin', v_portfolio_id, v_token, v_user_id::text, 
    'sent', now() + interval '7 days',
    jsonb_build_object(
      'type', 'company_admin', 
      'company_name', p_company_name,
      'invited_by', v_user_id::text
    )
  )
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true, 
    'invitation_id', v_invitation_id, 
    'portfolio_id', v_portfolio_id,
    'token', v_token
  );
END;
$$;

-- INVITE PROPERTY MANAGER (Company Admin only, with property scope)
CREATE OR REPLACE FUNCTION public.invite_property_manager(
  p_email text,
  p_full_name text,
  p_unit_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_token text;
  v_invitation_id uuid;
  v_unit_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Get the caller's portfolio from their profile
  SELECT portfolio_id INTO v_portfolio_id FROM public.profiles WHERE id = v_user_id;
  
  IF v_portfolio_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No portfolio found for your account');
  END IF;

  -- Verify the caller is a company_admin or manager in this portfolio
  IF NOT EXISTS (
    SELECT 1 FROM public.user_invitations 
    WHERE email = (SELECT email FROM auth.users WHERE id = v_user_id)
    AND portfolio_id = v_portfolio_id 
    AND (role = 'company_admin' OR role = 'manager')
    AND status = 'accepted'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.platform_operators 
    WHERE auth_user_id = v_user_id AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Only company admins can invite property managers');
  END IF;

  -- Verify all unit_ids belong to this portfolio
  IF array_length(p_unit_ids, 1) > 0 THEN
    FOR v_unit_id IN SELECT unnest(p_unit_ids) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.units u
        JOIN public.buildings b ON b.id = u.building_id
        WHERE u.id = v_unit_id AND b.association_id IN (
          SELECT id FROM public.associations WHERE portfolio_id = v_portfolio_id
        )
      ) THEN
        RETURN jsonb_build_object('error', 'Unit ' || v_unit_id || ' does not belong to your portfolio');
      END IF;
    END LOOP;
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (
    email, full_name, role, portfolio_id, token, created_by, 
    status, expires_at, metadata
  )
  VALUES (
    p_email, p_full_name, 'property_manager', v_portfolio_id, v_token, v_user_id::text, 
    'sent', now() + interval '7 days',
    jsonb_build_object(
      'type', 'property_manager',
      'unit_ids', p_unit_ids,
      'invited_by', v_user_id::text
    )
  )
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true, 
    'invitation_id', v_invitation_id, 
    'token', v_token
  );
END;
$$;

-- Helper: list pending invitations for superadmin
CREATE OR REPLACE FUNCTION public.list_company_invitations()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  company_name text,
  portfolio_id uuid,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_operators 
    WHERE auth_user_id = auth.uid() AND active = true
  ) THEN
    RAISE EXCEPTION 'Only platform operators can view company invitations';
  END IF;

  RETURN QUERY
  SELECT 
    ui.id, ui.email, ui.full_name,
    ui.metadata->>'company_name' as company_name,
    ui.portfolio_id, ui.status, ui.created_at
  FROM public.user_invitations ui
  WHERE ui.role = 'company_admin'
  ORDER BY ui.created_at DESC;
END;
$$;

COMMIT;
