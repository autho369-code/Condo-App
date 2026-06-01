-- Fix infinite recursion in platform_operators RLS
-- is_platform_operator() reads platform_operators, but platform_operators_admin_all
-- policy also reads platform_operators → infinite recursion.
-- Fix: make is_platform_operator() SECURITY DEFINER to bypass RLS.

BEGIN;

-- 1. Drop the self-referencing policy
DROP POLICY IF EXISTS platform_operators_admin_all ON public.platform_operators;

-- 2. Replace with a policy that uses a non-recursive check
-- Platform operators can see all platform_operators rows via self-read + admin function
CREATE POLICY platform_operators_admin_all ON public.platform_operators
  FOR ALL
  USING (
    -- Allow access if the user can read their own row (self-read handles auth_user_id = auth.uid())
    -- OR if they are an active platform operator (checked via SECURITY DEFINER function)
    (SELECT public.is_platform_operator_safe())
  )
  WITH CHECK (
    (SELECT public.is_platform_operator_safe())
  );

-- 3. Create a SECURITY DEFINER version that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_platform_operator_safe()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_operators po
    WHERE po.auth_user_id = auth.uid() AND po.active
  );
$$;

-- 4. Also fix the self-read policy to be simpler (allow users to read their own row)
DROP POLICY IF EXISTS platform_operators_self_read ON public.platform_operators;
CREATE POLICY platform_operators_self_read ON public.platform_operators
  FOR SELECT
  USING (auth_user_id = auth.uid());

COMMIT;
