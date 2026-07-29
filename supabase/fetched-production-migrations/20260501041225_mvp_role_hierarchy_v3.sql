-- ============================================================================
-- MVP Role Hierarchy (v3 — extends existing helpers without dropping)
-- ============================================================================

-- ----- 1. Role enum -----
DO $$ BEGIN
  CREATE TYPE public.mvp_company_role AS ENUM ('company_admin', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- 2. profiles.mvp_role -----
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mvp_role public.mvp_company_role;

COMMENT ON COLUMN public.profiles.mvp_role IS
  'MVP role within their portfolio. NULL = not company staff.';

-- ----- 3. association_managers join -----
CREATE TABLE IF NOT EXISTS public.association_managers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  association_id  uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  portfolio_id    uuid NOT NULL REFERENCES public.portfolios(id)   ON DELETE CASCADE,
  assigned_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  UNIQUE (user_id, association_id)
);

CREATE INDEX IF NOT EXISTS idx_assoc_mgrs_user        ON public.association_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_assoc_mgrs_association ON public.association_managers(association_id);
CREATE INDEX IF NOT EXISTS idx_assoc_mgrs_portfolio   ON public.association_managers(portfolio_id);

ALTER TABLE public.association_managers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.association_managers IS
  'Manager-to-association assignments. A manager can access only the associations they have an active row for. Company admins do NOT need rows here.';

-- ----- 4. Helper functions -----

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'company_admin'
      AND portfolio_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'manager'
      AND portfolio_id IS NOT NULL
  );
$$;

-- A new helper used by future RLS policies on association-scoped tables.
-- The existing can_access_association(a_id) stays untouched (23 policies depend on it).
-- New policies should reference can_access_association_mvp() for MVP role-aware access.
CREATE OR REPLACE FUNCTION public.can_access_association_mvp(a_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a_id IS NOT NULL
    AND (
      public.is_platform_operator()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'company_admin'
          AND a.id = a_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.association_managers am
        WHERE am.user_id = auth.uid()
          AND am.association_id = a_id
          AND am.ended_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.board_members bm
        WHERE bm.auth_user_id = auth.uid()
          AND bm.association_id = a_id
          AND bm.active = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.occupancies oc
        JOIN public.units u     ON u.id = oc.unit_id
        JOIN public.buildings b ON b.id = u.building_id
        JOIN public.owners o    ON o.id = oc.owner_id
        WHERE b.association_id = a_id
          AND o.auth_user_id = auth.uid()
          AND oc.status = 'current'
      )
    );
$$;

COMMENT ON FUNCTION public.can_access_association_mvp(uuid) IS
  'MVP role-aware access check. Use this in new RLS policies. Replaces the broader can_access_association(a_id) which only checks portfolio scope.';

-- ----- 5. RLS policies on association_managers -----
DROP POLICY IF EXISTS am_select_visible ON public.association_managers;
DROP POLICY IF EXISTS am_insert_admins  ON public.association_managers;
DROP POLICY IF EXISTS am_update_admins  ON public.association_managers;
DROP POLICY IF EXISTS am_delete_admins  ON public.association_managers;

CREATE POLICY am_select_visible ON public.association_managers
  FOR SELECT TO authenticated
  USING (
    public.is_platform_operator()
    OR (
      public.is_company_admin()
      AND portfolio_id IN (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid())
    )
    OR user_id = auth.uid()
  );

CREATE POLICY am_insert_admins ON public.association_managers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_operator()
    OR (
      public.is_company_admin()
      AND portfolio_id IN (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY am_update_admins ON public.association_managers
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_operator()
    OR (
      public.is_company_admin()
      AND portfolio_id IN (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_platform_operator()
    OR (
      public.is_company_admin()
      AND portfolio_id IN (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY am_delete_admins ON public.association_managers
  FOR DELETE TO authenticated
  USING (
    public.is_platform_operator()
    OR (
      public.is_company_admin()
      AND portfolio_id IN (SELECT portfolio_id FROM public.profiles WHERE id = auth.uid())
    )
  );
;
