-- Fix portal URL to use the real domain
CREATE OR REPLACE FUNCTION public.app_portal_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'portal_base_url' LIMIT 1),
    'https://www.portier369.com'
  );
$$;
