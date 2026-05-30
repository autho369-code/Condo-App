-- Create RPCs that bypass RLS for owner invitation workflows
-- These run as SECURITY DEFINER so staff can create invitations
-- without hitting the recursive RLS policy on platform_operators

BEGIN;

-- Send owner portal activation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.stage_owner_activation(
  p_owner_id uuid,
  p_subject text DEFAULT 'Activate your owner portal',
  p_message text DEFAULT 'Click the link to access your owner portal.'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_invitation_id uuid;
BEGIN
  -- Get owner details
  SELECT email, full_name INTO v_email, v_full_name
  FROM public.owners WHERE id = p_owner_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Owner not found');
  END IF;

  -- Check for existing pending invitation
  IF EXISTS (
    SELECT 1 FROM public.user_invitations
    WHERE email = v_email AND role = 'homeowner' AND status IN ('sent', 'staged')
  ) THEN
    RETURN jsonb_build_object('error', 'An invitation is already staged or sent for this owner');
  END IF;

  -- Create invitation
  INSERT INTO public.user_invitations (
    email, full_name, role, status, message, metadata
  ) VALUES (
    v_email, v_full_name, 'homeowner', 'staged',
    p_subject || E'\n\n' || p_message,
    jsonb_build_object('owner_id', p_owner_id, 'template', 'portal_activation')
  )
  RETURNING id INTO v_invitation_id;

  -- Queue email
  INSERT INTO public.email_queue (
    to_address, to_name, subject, body, template,
    reference_type, reference_id, status
  ) VALUES (
    v_email, v_full_name, p_subject, p_message,
    'portal_activation', 'user_invitation', v_invitation_id, 'queued'
  );

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id);
END;
$$;

-- Confirm and send a staged invitation
CREATE OR REPLACE FUNCTION public.confirm_owner_invitation(
  p_invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_invitations
  SET status = 'sent', updated_at = now()
  WHERE id = p_invitation_id AND status = 'staged';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation not found or not in staged status');
  END IF;

  UPDATE public.email_queue
  SET status = 'queued'
  WHERE reference_id = p_invitation_id AND reference_type = 'user_invitation';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Send a general owner form/communication
CREATE OR REPLACE FUNCTION public.stage_owner_form(
  p_owner_id uuid,
  p_template text DEFAULT 'owner_intake',
  p_subject text DEFAULT 'Communication from Stellar Property Management',
  p_message text DEFAULT 'Please review the attached information.'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_comm_id uuid;
BEGIN
  SELECT email, full_name INTO v_email, v_full_name
  FROM public.owners WHERE id = p_owner_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Owner not found');
  END IF;

  -- For portal activation, reuse the activation flow
  IF p_template = 'portal_activation' THEN
    RETURN public.stage_owner_activation(p_owner_id, p_subject, p_message);
  END IF;

  -- Create communication message
  INSERT INTO public.communication_messages (
    recipient_name, recipient_email, subject, body, channel,
    status, template, metadata
  ) VALUES (
    v_full_name, v_email, p_subject, p_message, 'email',
    'staged', p_template,
    jsonb_build_object('owner_id', p_owner_id)
  )
  RETURNING id INTO v_comm_id;

  -- Queue email
  INSERT INTO public.email_queue (
    to_address, to_name, subject, body, template,
    reference_type, reference_id, status
  ) VALUES (
    v_email, v_full_name, p_subject, p_message,
    p_template, 'communication_message', v_comm_id, 'queued'
  );

  RETURN jsonb_build_object('success', true, 'communication_id', v_comm_id);
END;
$$;

COMMIT;
