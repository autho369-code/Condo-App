-- ============================================================================
-- Helper functions + a permission summary view
-- ============================================================================

-- ----- Helpers -----

CREATE OR REPLACE FUNCTION public.is_assistant_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'assistant_manager'
      AND portfolio_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND mvp_role = 'accountant'
      AND portfolio_id IS NOT NULL
  );
$$;

-- can_edit_association_mvp(): write-permission check.
-- Read access uses can_access_association_mvp().
-- Assistant managers and board members have READ but not EDIT.
CREATE OR REPLACE FUNCTION public.can_edit_association_mvp(a_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a_id IS NOT NULL
    AND (
      public.is_platform_operator()
      -- company admins: full edit on their portfolio
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'company_admin'
          AND a.id = a_id
      )
      -- accountants: full edit on their portfolio
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'accountant'
          AND a.id = a_id
      )
      -- managers: full edit on assigned associations only
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.association_managers am ON am.user_id = p.id
        WHERE p.id = auth.uid()
          AND p.mvp_role = 'manager'
          AND am.association_id = a_id
          AND am.ended_at IS NULL
      )
    );
$$;

COMMENT ON FUNCTION public.can_edit_association_mvp(uuid) IS
  'Write-permission check. Returns true for super admins, company admins, accountants, and managers (assigned associations only). Assistant managers, board members, owners, and tenants get false here — they have read access via can_access_association_mvp() but cannot edit.';

-- ----- Update can_access_association_mvp to include all four company roles + board + owner -----
CREATE OR REPLACE FUNCTION public.can_access_association_mvp(a_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a_id IS NOT NULL
    AND (
      public.is_platform_operator()
      -- company_admin OR accountant: any association in their portfolio
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.associations a ON a.portfolio_id = p.portfolio_id
        WHERE p.id = auth.uid()
          AND p.mvp_role IN ('company_admin', 'accountant')
          AND a.id = a_id
      )
      -- manager OR assistant_manager: only assigned associations
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.association_managers am ON am.user_id = p.id
        WHERE p.id = auth.uid()
          AND p.mvp_role IN ('manager', 'assistant_manager')
          AND am.association_id = a_id
          AND am.ended_at IS NULL
      )
      -- board member: their own association
      OR EXISTS (
        SELECT 1
        FROM public.board_members bm
        WHERE bm.auth_user_id = auth.uid()
          AND bm.association_id = a_id
          AND bm.active = true
      )
      -- owner / tenant: associations where they have a current occupancy
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

-- ----- Permission summary view -----
-- Single source of truth that the UI and docs can read.
-- This is informational only; actual enforcement is in RLS + application code.
CREATE OR REPLACE VIEW public.v_role_permissions AS
SELECT * FROM (VALUES
  -- role, scope, view_assoc, edit_assoc, view_finance, edit_finance, manage_owners, create_wo, send_notices, invite_users, assign_managers
  ('super_admin',       'platform',       true,  true,  true,  true,  true,  true,  true,  true,  true ),
  ('company_admin',     'company',        true,  true,  true,  true,  true,  true,  true,  true,  true ),
  ('accountant',        'company',        true,  true,  true,  true,  false, false, false, false, false),
  ('manager',           'assigned_assocs',true,  true,  true,  true,  true,  true,  true,  false, false),
  ('assistant_manager', 'assigned_assocs',true,  false, true,  false, false, false, false, false, false),
  ('board_member',      'own_assoc',      true,  false, true,  false, false, false, false, false, false),
  ('owner',             'own_unit',       true,  false, false, false, false, false, false, false, false),
  ('tenant',            'own_unit',       true,  false, false, false, false, false, false, false, false)
) AS t(
  role, scope,
  view_associations, edit_associations,
  view_financials, edit_financials,
  manage_owners, create_work_orders, send_notices,
  invite_users, assign_managers
);

COMMENT ON VIEW public.v_role_permissions IS
  'Reference matrix of role → permission. Used by the UI to show/hide buttons and by docs. Actual enforcement happens in RLS policies and route guards.';;
