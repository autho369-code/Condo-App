-- Migration: Invite System RPCs (v2 — fixed type casts)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/termxngysvotnfbzbgrv/sql/new

BEGIN;

-- 1. Ensure user_invitations has needed columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'status') THEN
    ALTER TABLE public.user_invitations ADD COLUMN status text DEFAULT 'sent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'role') THEN
    ALTER TABLE public.user_invitations ADD COLUMN role text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'association_id') THEN
    ALTER TABLE public.user_invitations ADD COLUMN association_id uuid REFERENCES public.associations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'token') THEN
    ALTER TABLE public.user_invitations ADD COLUMN token text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'expires_at') THEN
    ALTER TABLE public.user_invitations ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '7 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'accepted_at') THEN
    ALTER TABLE public.user_invitations ADD COLUMN accepted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'created_by') THEN
    ALTER TABLE public.user_invitations ADD COLUMN created_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'portfolio_id') THEN
    ALTER TABLE public.user_invitations ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_invitations' AND column_name = 'metadata') THEN
    ALTER TABLE public.user_invitations ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- 3. Token helper
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- 4. INVITE STAFF
CREATE OR REPLACE FUNCTION public.invite_staff(
  p_email text,
  p_full_name text,
  p_role text
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

  SELECT portfolio_id INTO v_portfolio_id FROM public.profiles WHERE id = v_user_id;
  
  IF v_portfolio_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.platform_operators WHERE auth_user_id = v_user_id AND active = true) THEN
      SELECT id INTO v_portfolio_id FROM public.portfolios WHERE archived_at IS NULL ORDER BY created_at LIMIT 1;
    END IF;
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_full_name, p_role, v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days', 
          jsonb_build_object('type', 'staff', 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;

-- 5. INVITE BOARD MEMBER
CREATE OR REPLACE FUNCTION public.invite_board_member(
  p_email text,
  p_full_name text,
  p_association_id uuid,
  p_board_role text DEFAULT NULL
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

  SELECT portfolio_id INTO v_portfolio_id FROM public.associations WHERE id = p_association_id;
  IF v_portfolio_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Association not found');
  END IF;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, association_id, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_full_name, 'board_member', p_association_id, v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days',
          jsonb_build_object('type', 'board_member', 'board_role', p_board_role, 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;

-- 6. INVITE HOMEOWNER
CREATE OR REPLACE FUNCTION public.invite_owner(
  p_email text,
  p_full_name text,
  p_association_id uuid,
  p_unit_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_portfolio_id uuid;
  v_unit_id uuid;
  v_token text;
  v_invitation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT portfolio_id INTO v_portfolio_id FROM public.associations WHERE id = p_association_id;
  
  SELECT u.id INTO v_unit_id 
  FROM public.units u 
  JOIN public.buildings b ON b.id = u.building_id 
  WHERE b.association_id = p_association_id AND u.unit_number = p_unit_number AND u.archived_at IS NULL
  LIMIT 1;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, association_id, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_full_name, 'homeowner', p_association_id, v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days',
          jsonb_build_object('type', 'homeowner', 'unit_id', v_unit_id, 'unit_number', p_unit_number, 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;

-- 7. INVITE VENDOR
CREATE OR REPLACE FUNCTION public.invite_vendor(
  p_name text,
  p_email text,
  p_trade text
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

  SELECT portfolio_id INTO v_portfolio_id FROM public.profiles WHERE id = v_user_id;

  v_token := public.generate_invite_token();
  
  INSERT INTO public.user_invitations (email, full_name, role, portfolio_id, token, created_by, status, expires_at, metadata)
  VALUES (p_email, p_name, 'vendor', v_portfolio_id, v_token, v_user_id::text, 'sent', now() + interval '7 days',
          jsonb_build_object('type', 'vendor', 'trade', p_trade, 'invited_by', v_user_id::text))
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id, 'token', v_token);
END;
$$;

-- 8. RLS policies
DROP POLICY IF EXISTS "Staff can view their portfolio invitations" ON public.user_invitations;
CREATE POLICY "Staff can view their portfolio invitations" ON public.user_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.portfolio_id = user_invitations.portfolio_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.platform_operators po
      WHERE po.auth_user_id = auth.uid()
      AND po.active = true
    )
  );

DROP POLICY IF EXISTS "Staff can insert invitations" ON public.user_invitations;
CREATE POLICY "Staff can insert invitations" ON public.user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()::text
  );

COMMIT;
