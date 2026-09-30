-- Invitations: close a creation hole and fix acceptance.
--
-- 1. The INSERT policy only required created_by = auth.uid(), so ANY signed-in
--    user (public signup is open) could create a pending invitation into ANY
--    company with ANY role and a token of their choosing. Escalation through
--    accept_invitation was stopped only by the profile-privilege guard.
--    Creating invitations now requires staff of that company, and only company
--    admins / operators may invite staff roles (manager, company_admin).
-- 2. Every profile in a company could SELECT its invitations — including the
--    secret tokens. Reading is now staff of that company only.
-- 3. accept_invitation was blocked by that same guard for every GENUINE invite
--    that changes the invitee's company or role (i.e. all of them): the guard
--    requires the caller to already be an admin. accept_invitation now records
--    the acceptance first, and the guard allows a privilege change that exactly
--    matches an invitation the caller accepted in this same transaction.

drop policy if exists "Staff can insert invitations" on public.user_invitations;
drop policy if exists user_invitations_staff_insert on public.user_invitations;
create policy user_invitations_staff_insert on public.user_invitations for insert to authenticated
  with check (
    (public.is_any_staff() or public.is_company_admin())
    and public.can_access_portfolio(portfolio_id)
    and (hoa_role::text in ('owner', 'tenant', 'vendor', 'board') or public.can_admin_portfolio(portfolio_id))
  );

drop policy if exists "Staff can view their portfolio invitations" on public.user_invitations;
drop policy if exists user_invitations_staff_read on public.user_invitations;
create policy user_invitations_staff_read on public.user_invitations for select to authenticated
  using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  inv public.user_invitations;
  calling_user uuid := auth.uid();
  user_email text;
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
  -- Record the acceptance first: the profile guard allows exactly this change.
  update public.user_invitations
     set status = 'accepted', used_at = now(), used_by = calling_user
   where id = inv.id;
  update public.profiles
     set portfolio_id = inv.portfolio_id,
         role_id = inv.role_id,
         hoa_role = inv.hoa_role,
         updated_at = now()
   where id = calling_user;
  return jsonb_build_object('success', true, 'portfolio_id', inv.portfolio_id, 'hoa_role', inv.hoa_role, 'role_id', inv.role_id);
end $$;

create or replace function public.guard_profile_privilege_changes()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
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
    if public.is_platform_operator()
       or public.can_admin_portfolio(coalesce(new.portfolio_id, old.portfolio_id)) then
      return new;
    end if;
    -- The user's own profile, changed to exactly what an invitation they
    -- accepted in this transaction grants (see accept_invitation).
    if new.id = auth.uid() and exists (
         select 1 from public.user_invitations i
          where i.used_by = auth.uid() and i.status = 'accepted' and i.used_at = now()
            and i.portfolio_id is not distinct from new.portfolio_id
            and i.hoa_role is not distinct from new.hoa_role
            and i.role_id is not distinct from new.role_id) then
      return new;
    end if;
    raise exception 'profile privilege change denied: requires platform operator or full-access staff in portfolio %',
      coalesce(new.portfolio_id, old.portfolio_id)::text;
  end if;
  return new;
end $$;
