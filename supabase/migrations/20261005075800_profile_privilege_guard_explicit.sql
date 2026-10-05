-- 20261005075500 rewrote guard_profile_privilege_changes() with a text
-- replace that only matches the single-line body production carries; a
-- database built from the migration files (multi-line body in
-- 20260930204500) would silently keep the old rule. Define the function
-- explicitly: operators pass only as operator admins, non-operators keep the
-- company-admin check. Same body as production plus that one change.
create or replace function public.guard_profile_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  is_role_change boolean;
  is_account_control_change boolean;
begin
  is_role_change := (new.portfolio_id is distinct from old.portfolio_id) or (new.role_id is distinct from old.role_id)
    or (new.hoa_role is distinct from old.hoa_role) or (new.mvp_role is distinct from old.mvp_role);
  is_account_control_change := (new.disabled_at is distinct from old.disabled_at) or (new.mfa_required is distinct from old.mfa_required)
    or (new.profile_access is distinct from old.profile_access) or (new.gl_account_permissions is distinct from old.gl_account_permissions);
  if not (is_role_change or is_account_control_change) then return new; end if;
  if auth.uid() is null then return new; end if;
  if (public.is_platform_operator() and public.is_platform_admin())
     or (not public.is_platform_operator() and public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id))) then
    return new;
  end if;
  if not is_account_control_change and new.id = auth.uid() and exists (
       select 1 from public.user_invitations i
        where i.used_by = auth.uid() and i.status = 'accepted' and i.used_at = now()
          and i.portfolio_id is not distinct from new.portfolio_id and i.hoa_role is not distinct from new.hoa_role
          and i.role_id is not distinct from new.role_id and i.mvp_role is not distinct from new.mvp_role) then
    return new;
  end if;
  raise exception 'profile privilege change denied: requires platform operator or full-access staff in portfolio %',
    coalesce(new.portfolio_id, old.portfolio_id)::text;
end $function$;
