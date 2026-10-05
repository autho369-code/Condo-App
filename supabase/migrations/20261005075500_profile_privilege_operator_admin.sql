-- guard_profile_privilege_changes() let ANY active platform operator change a
-- profile's privileged columns (portfolio_id, hoa_role, role_id, mvp_role,
-- disabled_at, MFA and access settings). With non-admin operators allowed to
-- write their own profiles row (20261005074000), a support/readonly operator
-- could make themselves a company admin. Only operator admins pass as
-- operators now; non-operators keep the existing company-admin check.
-- Rewrites the live definition in place; re-running is a no-op.
do $$
declare
  def text := pg_get_functiondef('public.guard_profile_privilege_changes()'::regprocedure);
begin
  if position('public.is_platform_admin()' in def) = 0 then
    execute replace(def,
      'if public.is_platform_operator() or public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id)) then return new; end if;',
      'if (public.is_platform_operator() and public.is_platform_admin())'
      || ' or (not public.is_platform_operator() and public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id))) then return new; end if;');
  end if;
end $$;
