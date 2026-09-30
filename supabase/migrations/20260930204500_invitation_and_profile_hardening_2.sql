-- Security (follow-up to invitation_hardening, #80 review + profile sweep):
-- 1. Non-admin staff could still create an "owner/board/…" invitation that
--    carries a staff mvp_role, a role_id or association_ids — which the signup
--    trigger (apply_pending_invitation) copies onto the new profile. Only
--    company admins / operators may set those, and association_ids must all
--    belong to the invitation's company.
-- 2. accept_invitation (already-signed-in users) now applies an invitation the
--    same way the signup trigger does: mvp_role, association-scoped manager
--    assignments (without them a scoped invite granted company-wide access),
--    and tenant linking.
-- 3. profiles_update_own let users change their OWN disabled_at (re-enable a
--    disabled account), mfa_required (switch off MFA), mvp_role, profile_access
--    and gl_account_permissions. These are now privileged like hoa_role /
--    portfolio_id / role_id: only operators, company admins of that company,
--    service jobs, or a matching invitation being accepted may change them.

drop policy if exists user_invitations_staff_insert on public.user_invitations;
create policy user_invitations_staff_insert on public.user_invitations for insert to authenticated
  with check (
    (public.is_any_staff() or public.is_company_admin())
    and public.can_access_portfolio(portfolio_id)
    and not exists (
      select 1 from unnest(coalesce(association_ids, array[]::uuid[])) a(id)
       where not exists (select 1 from public.associations x where x.id = a.id and x.portfolio_id = user_invitations.portfolio_id))
    and (
      public.can_admin_portfolio(portfolio_id)
      or (hoa_role::text in ('owner', 'tenant', 'vendor', 'board')
          and mvp_role is null and role_id is null
          and coalesce(array_length(association_ids, 1), 0) = 0)
    )
  );

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  inv public.user_invitations;
  calling_user uuid := auth.uid();
  user_email text;
  v_assoc_id uuid;
  v_tenant_id uuid;
begin
  if calling_user is null then
    raise exception 'accept_invitation: must be authenticated';
  end if;
  select email into user_email from auth.users where id = calling_user;
  select * into inv from public.user_invitations
   where token = p_token and status = 'pending'
   for update;
  if not found then
    raise exception 'invitation not found or already used';
  end if;
  if inv.expires_at < now() then
    update public.user_invitations set status = 'expired' where id = inv.id;
    raise exception 'invitation has expired';
  end if;
  if lower(inv.email) <> lower(user_email) then
    raise exception 'invitation email does not match authenticated user';
  end if;
  if inv.hoa_role::text = 'tenant' then
    select t.id into v_tenant_id
      from public.tenants t
     where t.portfolio_id = inv.portfolio_id and t.unit_id = inv.unit_id
       and lower(t.email) = lower(user_email) and t.status = 'active' and t.archived_at is null
       and (t.auth_user_id is null or t.auth_user_id = calling_user)
     order by t.created_at desc limit 1;
    if v_tenant_id is null then
      raise exception 'Resident invitation does not match an active tenant record';
    end if;
  end if;
  -- Record the acceptance first: the profile guard allows exactly this change.
  update public.user_invitations
     set status = 'accepted', used_at = now(), used_by = calling_user,
         accepted_at = coalesce(accepted_at, now()), updated_at = now()
   where id = inv.id;
  update public.profiles
     set portfolio_id = inv.portfolio_id,
         role_id = inv.role_id,
         hoa_role = inv.hoa_role,
         mvp_role = inv.mvp_role,
         updated_at = now()
   where id = calling_user;
  if (inv.hoa_role::text = 'manager' or inv.mvp_role::text in ('manager', 'assistant_manager'))
     and coalesce(array_length(inv.association_ids, 1), 0) > 0 then
    foreach v_assoc_id in array inv.association_ids loop
      insert into public.association_managers (user_id, association_id, portfolio_id, assigned_by, assigned_at)
      values (calling_user, v_assoc_id, inv.portfolio_id, inv.invited_by, now())
      on conflict (user_id, association_id) do nothing;
    end loop;
  end if;
  if v_tenant_id is not null then
    update public.tenants set auth_user_id = calling_user, portal_activated = true, updated_at = now()
     where id = v_tenant_id;
  end if;
  return jsonb_build_object('success', true, 'portfolio_id', inv.portfolio_id, 'hoa_role', inv.hoa_role, 'role_id', inv.role_id);
end $$;

create or replace function public.guard_profile_privilege_changes()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  is_role_change boolean;
  is_account_control_change boolean;
begin
  is_role_change :=
    (new.portfolio_id is distinct from old.portfolio_id)
    or (new.role_id is distinct from old.role_id)
    or (new.hoa_role is distinct from old.hoa_role)
    or (new.mvp_role is distinct from old.mvp_role);
  is_account_control_change :=
    (new.disabled_at is distinct from old.disabled_at)
    or (new.mfa_required is distinct from old.mfa_required)
    or (new.profile_access is distinct from old.profile_access)
    or (new.gl_account_permissions is distinct from old.gl_account_permissions);
  if not (is_role_change or is_account_control_change) then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if public.is_platform_operator()
     or public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id)) then
    return new;
  end if;
  -- The user's own profile, changed to exactly what an invitation they
  -- accepted in this transaction grants (see accept_invitation). Account
  -- controls (disabled/MFA/permissions) are never self-service.
  if not is_account_control_change and new.id = auth.uid() and exists (
       select 1 from public.user_invitations i
        where i.used_by = auth.uid() and i.status = 'accepted' and i.used_at = now()
          and i.portfolio_id is not distinct from new.portfolio_id
          and i.hoa_role is not distinct from new.hoa_role
          and i.role_id is not distinct from new.role_id
          and i.mvp_role is not distinct from new.mvp_role) then
    return new;
  end if;
  raise exception 'profile privilege change denied: requires platform operator or full-access staff in portfolio %',
    coalesce(new.portfolio_id, old.portfolio_id)::text;
end $$;
