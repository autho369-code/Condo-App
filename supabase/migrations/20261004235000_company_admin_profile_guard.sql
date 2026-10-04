-- Company-admin audit: close a manager → company-admin escalation path.
--
-- profiles_admin_in_portfolio is FOR ALL to full-access staff (managers with
-- the Property Manager / President role) inside their portfolio, and
-- guard_profile_privilege_changes() only runs BEFORE UPDATE. A manager could
-- therefore DELETE a profile in their portfolio (e.g. a second account they
-- invited as an owner, or the company admin's own profile — a lockout) and
-- INSERT it back with hoa_role = 'company_admin', bypassing the role guard.
--
-- This adds a BEFORE INSERT OR DELETE guard with the same authority rule as
-- the update guard: platform operators and the portfolio's company admin may
-- create/delete profiles; system contexts (auth signup triggers, service role,
-- where auth.uid() is null) are unaffected.
--
-- Additive and idempotent: CREATE OR REPLACE FUNCTION + guarded CREATE TRIGGER
-- + ALTER POLICY. No drops.

create or replace function public.guard_profile_insert_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Signup triggers (handle_new_auth_user, apply_pending_invitation), the
  -- service role and migrations run without an end-user JWT.
  if auth.uid() is null or public.is_platform_operator() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.portfolio_id is not null and public.can_admin_portfolio(old.portfolio_id) then
      return old;
    end if;
    raise exception 'profile deletion denied: requires platform operator or company admin of the portfolio'
      using errcode = '42501';
  end if;

  -- INSERT
  if new.portfolio_id is not null and public.can_admin_portfolio(new.portfolio_id) then
    return new;
  end if;

  -- A bare self profile, identical to what handle_new_auth_user creates.
  if new.id = auth.uid()
     and new.portfolio_id is null
     and new.hoa_role = 'owner'
     and new.role_id is null
     and new.mvp_role is null
     and new.disabled_at is null then
    return new;
  end if;

  -- Self profile matching an invitation accepted in this same transaction
  -- (mirrors guard_profile_privilege_changes()).
  if new.id = auth.uid() and new.disabled_at is null and exists (
       select 1 from public.user_invitations i
        where i.used_by = auth.uid() and i.status = 'accepted' and i.used_at = now()
          and i.portfolio_id is not distinct from new.portfolio_id
          and i.hoa_role is not distinct from new.hoa_role
          and i.role_id is not distinct from new.role_id
          and i.mvp_role is not distinct from new.mvp_role) then
    return new;
  end if;

  raise exception 'profile creation denied: requires platform operator or company admin of the portfolio'
    using errcode = '42501';
end
$$;

revoke all on function public.guard_profile_insert_delete() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.profiles'::regclass
       and tgname = 'trg_guard_profile_insert_delete'
  ) then
    create trigger trg_guard_profile_insert_delete
      before insert or delete on public.profiles
      for each row execute function public.guard_profile_insert_delete();
  end if;
end
$$;

-- Hardening: a company admin's own invitations / association assignments may
-- only reference associations of that same portfolio. (The staff insert
-- policy already checked this; the admin policy did not.)
alter policy user_invitations_admin_all on public.user_invitations
  using (public.can_admin_portfolio(portfolio_id))
  with check (
    public.can_admin_portfolio(portfolio_id)
    and (association_id is null or exists (
      select 1 from public.associations x
       where x.id = user_invitations.association_id
         and x.portfolio_id = user_invitations.portfolio_id))
    and not exists (
      select 1
        from unnest(coalesce(user_invitations.association_ids, array[]::uuid[])) a(id)
       where not exists (
         select 1 from public.associations x
          where x.id = a.id and x.portfolio_id = user_invitations.portfolio_id))
  );

alter policy am_insert_admins on public.association_managers
  with check (
    (public.is_platform_operator()
      or (public.is_company_admin()
          and portfolio_id in (select profiles.portfolio_id from public.profiles where profiles.id = (select auth.uid()))))
    and exists (
      select 1 from public.associations a
       where a.id = association_managers.association_id
         and a.portfolio_id = association_managers.portfolio_id)
  );

alter policy am_update_admins on public.association_managers
  using (
    public.is_platform_operator()
    or (public.is_company_admin()
        and portfolio_id in (select profiles.portfolio_id from public.profiles where profiles.id = (select auth.uid())))
  )
  with check (
    (public.is_platform_operator()
      or (public.is_company_admin()
          and portfolio_id in (select profiles.portfolio_id from public.profiles where profiles.id = (select auth.uid()))))
    and exists (
      select 1 from public.associations a
       where a.id = association_managers.association_id
         and a.portfolio_id = association_managers.portfolio_id)
  );
