-- Allow service_role / seed scripts (no auth.uid()) to bypass the privilege guard.
-- Justification: service_role already bypasses RLS. This is consistent posture.
create or replace function public.guard_profile_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  is_privilege_change boolean;
begin
  is_privilege_change :=
    (new.portfolio_id is distinct from old.portfolio_id)
    or (new.role_id is distinct from old.role_id)
    or (new.hoa_role is distinct from old.hoa_role);

  if is_privilege_change then
    if auth.uid() is null then
      return new;
    end if;
    if not (
      public.is_platform_operator()
      or public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id))
    ) then
      raise exception 'profile privilege change denied: requires platform operator or full-access staff in portfolio %',
        coalesce(new.portfolio_id, old.portfolio_id)::text;
    end if;
  end if;
  return new;
end;
$$;;
