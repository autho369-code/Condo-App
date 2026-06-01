-- Multi-tenant email infrastructure (schema only)
-- Each portfolio can configure its own sender identity.

BEGIN;

-- 1. Add email_settings to portfolios (JSONB for flexible provider config)
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS email_settings jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.portfolios.email_settings IS
'Per-portfolio email configuration. Shape:
{
  "provider": "resend" | "smtp" | "sendgrid" | "postmark",
  "from_address": "manager@company.com",
  "from_name": "Company Name",
  "reply_to": "support@company.com",
  "smtp": { "host": "", "port": 587, "user": "", "pass_encrypted": null }
}';

-- 2. Add portfolio_id + sender identity columns to email_queue
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES public.portfolios(id),
  ADD COLUMN IF NOT EXISTS from_address text,
  ADD COLUMN IF NOT EXISTS from_name text,
  ADD COLUMN IF NOT EXISTS reply_to text;

-- Index for the queue processor (pending emails sorted by age)
CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
  ON public.email_queue (status, created_at) 
  WHERE status = 'pending';

-- 3. Update the queue_invitation_email trigger to include portfolio + sender context
CREATE OR REPLACE FUNCTION public.queue_invitation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rendered jsonb;
  pf_email jsonb;
  pf_from_addr text;
  pf_from_name text;
  pf_reply_to text;
BEGIN
  IF new.status <> 'pending' THEN
    RETURN new;
  END IF;

  rendered := public.render_invitation_email(new);

  -- Read portfolio email settings
  SELECT email_settings INTO pf_email
    FROM public.portfolios WHERE id = new.portfolio_id;

  pf_from_addr := pf_email->>'from_address';
  pf_from_name := pf_email->>'from_name';
  pf_reply_to  := pf_email->>'reply_to';

  -- Fallback to platform default
  IF pf_from_addr IS NULL OR pf_from_addr = '' THEN
    pf_from_addr := 'noreply@portier369.com';
  END IF;
  IF pf_from_name IS NULL OR pf_from_name = '' THEN
    SELECT company_name INTO pf_from_name
      FROM public.portfolios WHERE id = new.portfolio_id;
  END IF;

  INSERT INTO public.email_queue (
    portfolio_id, to_email, to_name, subject, body,
    from_address, from_name, reply_to, status
  ) VALUES (
    new.portfolio_id,
    new.email,
    new.full_name,
    rendered->>'subject',
    rendered->>'html',
    pf_from_addr,
    pf_from_name,
    pf_reply_to,
    'pending'
  );

  RETURN new;
END;
$$;

COMMIT;
