CREATE OR REPLACE FUNCTION public.manager_is_scoped()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $$
  select public.is_staff()
     and exists (select 1 from public.association_managers am where am.user_id = auth.uid());
$$;

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

DROP POLICY IF EXISTS mgr_assoc_scope ON public.associations;
CREATE POLICY mgr_assoc_scope ON public.associations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_view_association_row(id));

DROP POLICY IF EXISTS mgr_assoc_scope ON public.units;
CREATE POLICY mgr_assoc_scope ON public.units AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_view_association_row((select b.association_id from public.buildings b where b.id = units.building_id)));

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
$function$;;
