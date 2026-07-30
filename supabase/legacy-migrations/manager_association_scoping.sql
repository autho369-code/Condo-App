-- ─────────────────────────────────────────────────────────────────────────
-- Per-manager property scoping.
--
-- Requirement: a manager should only see the associations they are explicitly
-- assigned (association_managers). Today every manager sees the whole portfolio
-- (can_access_portfolio keys off hoa_role='manager' alone).
--
-- Design (deliberately zero-regression): enforcement is a RESTRICTIVE RLS policy.
-- Restrictive policies are AND-ed with the existing permissive policies, so they
-- can only REMOVE access, never grant it. The gate returns TRUE for everyone
-- except a manager who actually has ≥1 assignment, so platform operators,
-- company admins, owners, board members, vendors, and today's unscoped managers
-- are provably unaffected. Scoping only activates once a manager is given
-- specific associations.
-- ─────────────────────────────────────────────────────────────────────────

-- A manager who has at least one explicit association assignment is "scoped".
CREATE OR REPLACE FUNCTION public.manager_is_scoped()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $$
  select public.is_staff()
     and exists (select 1 from public.association_managers am where am.user_id = auth.uid());
$$;

-- Restrictive gate used across every association-scoped table. Returns TRUE for
-- everyone except a scoped manager looking at an association they are not
-- assigned to. NULL association (portfolio-level/shared rows) is always allowed.
CREATE OR REPLACE FUNCTION public.can_view_association_row(p_assoc uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $$
  select case
    when public.manager_is_scoped() then
      p_assoc is null
      or exists (
        select 1 from public.association_managers am
        where am.user_id = auth.uid() and am.association_id = p_assoc
      )
    else true
  end;
$$;

-- Apply the restrictive policy to every public table that has an association_id
-- column. Idempotent (drops first). New tables can be re-run through this loop.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.relname
          AND col.column_name = 'association_id'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mgr_assoc_scope ON public.%I', r.relname);
    EXECUTE format(
      'CREATE POLICY mgr_assoc_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_view_association_row(association_id))',
      r.relname);
  END LOOP;
END $$;

-- The associations table keys on its own id.
DROP POLICY IF EXISTS mgr_assoc_scope ON public.associations;
CREATE POLICY mgr_assoc_scope ON public.associations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_view_association_row(id));

-- Units have no association_id; they reach it through building_id → buildings.
DROP POLICY IF EXISTS mgr_assoc_scope ON public.units;
CREATE POLICY mgr_assoc_scope ON public.units AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_view_association_row((select b.association_id from public.buildings b where b.id = units.building_id)));

-- ─────────────────────────────────────────────────────────────────────────
-- On invitation acceptance, materialize association_managers from the
-- invitation's association_ids. Previously this only fired for mvp_role; the
-- staff-invite path sets hoa_role='manager' (mvp_role stays null), so also
-- honor hoa_role='manager'.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_pending_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invitation public.user_invitations%ROWTYPE;
  v_assoc_id uuid;
BEGIN
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

  -- Managers (or assistant managers) get their association_managers rows from
  -- the invitation's association_ids, so they are scoped to exactly those.
  IF (v_invitation.hoa_role = 'manager'
      OR v_invitation.mvp_role IN ('manager', 'assistant_manager'))
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

  UPDATE public.user_invitations
     SET status  = 'accepted',
         used_at = now(),
         used_by = NEW.id,
         updated_at = now()
   WHERE id = v_invitation.id;

  RETURN NEW;
END;
$function$;
