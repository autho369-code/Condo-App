-- =============================================================================
-- Phase 10 — Admin RPC library
-- Functions the admin UI calls to perform multi-step admin actions safely.
-- Each function enforces authorization via the helpers built in earlier phases.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. provision_portfolio  (platform-operator only)
--    Creates a portfolio + subscription + first-admin invitation in one call.
-- -----------------------------------------------------------------------------
create or replace function public.provision_portfolio(
  p_company_name text,
  p_first_admin_email text,
  p_first_admin_name text default null,
  p_tier public.portfolio_tier default 'core',
  p_seats integer default 5,
  p_trial_days integer default 14,
  p_allowed_email_domains text[] default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  new_portfolio public.portfolios;
  new_subscription public.subscriptions;
  new_invitation public.user_invitations;
  president_role_id uuid;
begin
  if not public.is_platform_operator() then
    raise exception 'provision_portfolio: platform operator required';
  end if;

  insert into public.portfolios (
    company_name, tier, allowed_email_domains, created_by
  ) values (
    p_company_name, p_tier, coalesce(p_allowed_email_domains, '{}'), auth.uid()
  ) returning * into new_portfolio;

  insert into public.subscriptions (
    portfolio_id, tier, status, seats_included, trial_ends_at,
    billing_email, current_period_start
  ) values (
    new_portfolio.id, p_tier, 'trialing', p_seats,
    now() + make_interval(days => p_trial_days),
    p_first_admin_email,
    now()
  ) returning * into new_subscription;

  select id into president_role_id from public.user_roles
   where is_system and name = 'President' limit 1;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by,
    message, expires_at
  ) values (
    new_portfolio.id, lower(p_first_admin_email),
    'manager', president_role_id, auth.uid(),
    format('Welcome to %s — your management platform is ready.', p_company_name),
    now() + interval '30 days'
  ) returning * into new_invitation;

  return jsonb_build_object(
    'portfolio_id', new_portfolio.id,
    'subscription_id', new_subscription.id,
    'invitation_id', new_invitation.id,
    'invitation_token', new_invitation.token,
    'invitation_expires_at', new_invitation.expires_at,
    'trial_ends_at', new_subscription.trial_ends_at
  );
end;
$$;

grant execute on function public.provision_portfolio(text, text, text, public.portfolio_tier, integer, integer, text[]) to authenticated;
comment on function public.provision_portfolio(text, text, text, public.portfolio_tier, integer, integer, text[]) is 'Platform operator onboards a new management company. Creates portfolio + trialing subscription + invitation to the first President.';

-- -----------------------------------------------------------------------------
-- 2. invite_staff  (portfolio admin only)
-- -----------------------------------------------------------------------------
create or replace function public.invite_staff(
  p_portfolio_id uuid,
  p_email text,
  p_role_name text default 'Property Manager',
  p_message text default null,
  p_expires_days integer default 14
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target_role_id uuid;
  new_invitation public.user_invitations;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'invite_staff: must be portfolio admin';
  end if;

  select id into target_role_id from public.user_roles
   where name = p_role_name
     and (portfolio_id = p_portfolio_id or (is_system and portfolio_id is null))
   order by (portfolio_id = p_portfolio_id) desc nulls last
   limit 1;

  if target_role_id is null then
    raise exception 'invite_staff: role "%" not found for portfolio', p_role_name;
  end if;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by, message, expires_at
  ) values (
    p_portfolio_id, lower(p_email), 'manager', target_role_id, auth.uid(),
    p_message, now() + make_interval(days => p_expires_days)
  ) returning * into new_invitation;

  return jsonb_build_object(
    'invitation_id', new_invitation.id,
    'token', new_invitation.token,
    'expires_at', new_invitation.expires_at
  );
end;
$$;

grant execute on function public.invite_staff(uuid, text, text, text, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. invite_homeowner  (staff only — invites a homeowner to the portal)
-- -----------------------------------------------------------------------------
create or replace function public.invite_homeowner(
  p_portfolio_id uuid,
  p_owner_id uuid,
  p_email text default null,
  p_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  resolved_email text;
  new_invitation public.user_invitations;
begin
  if not public.can_access_portfolio(p_portfolio_id) then
    raise exception 'invite_homeowner: must be staff of portfolio';
  end if;

  resolved_email := coalesce(p_email, (select email from public.owners where id = p_owner_id));
  if resolved_email is null then
    raise exception 'invite_homeowner: no email on owner % and none provided', p_owner_id;
  end if;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, invited_by, message, expires_at
  ) values (
    p_portfolio_id, lower(resolved_email), 'owner', auth.uid(),
    coalesce(p_message, 'You have been invited to the homeowner portal.'),
    now() + interval '30 days'
  ) returning * into new_invitation;

  return jsonb_build_object(
    'invitation_id', new_invitation.id,
    'token', new_invitation.token,
    'email', resolved_email,
    'expires_at', new_invitation.expires_at
  );
end;
$$;

grant execute on function public.invite_homeowner(uuid, uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. invite_vendor  (staff only — invites a vendor to the vendor portal)
-- -----------------------------------------------------------------------------
create or replace function public.invite_vendor(
  p_portfolio_id uuid,
  p_vendor_id uuid,
  p_email text,
  p_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  new_invitation public.user_invitations;
  v public.vendors;
begin
  if not public.can_access_portfolio(p_portfolio_id) then
    raise exception 'invite_vendor: must be staff of portfolio';
  end if;

  select * into v from public.vendors where id = p_vendor_id and portfolio_id = p_portfolio_id;
  if not found then
    raise exception 'invite_vendor: vendor % not in portfolio %', p_vendor_id, p_portfolio_id;
  end if;

  -- Add the email to the vendor's emails array if not already present
  if not v.emails @> to_jsonb(array[lower(p_email)]) then
    update public.vendors
       set emails = emails || to_jsonb(array[lower(p_email)]),
           portal_activated = true,
           updated_at = now()
     where id = p_vendor_id;
  end if;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, invited_by, message, expires_at
  ) values (
    p_portfolio_id, lower(p_email), 'manager', auth.uid(),
    coalesce(p_message, format('Vendor portal access for %s.', v.name)),
    now() + interval '30 days'
  ) returning * into new_invitation;

  return jsonb_build_object(
    'invitation_id', new_invitation.id,
    'token', new_invitation.token,
    'vendor_id', p_vendor_id,
    'email', p_email
  );
end;
$$;

grant execute on function public.invite_vendor(uuid, uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. assign_role  (portfolio admin only)
-- -----------------------------------------------------------------------------
create or replace function public.assign_role(
  p_profile_id uuid,
  p_role_id uuid
)
returns public.profiles
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target public.profiles;
  target_role public.user_roles;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'assign_role: profile % not found', p_profile_id;
  end if;

  if not public.can_admin_portfolio(target.portfolio_id) then
    raise exception 'assign_role: must be admin of profile''s portfolio';
  end if;

  select * into target_role from public.user_roles where id = p_role_id;
  if not found then
    raise exception 'assign_role: role % not found', p_role_id;
  end if;
  if target_role.portfolio_id is not null and target_role.portfolio_id <> target.portfolio_id then
    raise exception 'assign_role: role belongs to a different portfolio';
  end if;

  update public.profiles
     set role_id = p_role_id, updated_at = now()
   where id = p_profile_id
   returning * into target;
  return target;
end;
$$;

grant execute on function public.assign_role(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. transfer_user_to_portfolio  (platform operator only)
-- -----------------------------------------------------------------------------
create or replace function public.transfer_user_to_portfolio(
  p_profile_id uuid,
  p_new_portfolio_id uuid,
  p_new_role_id uuid default null,
  p_new_hoa_role public.hoa_role default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  updated public.profiles;
begin
  if not public.is_platform_operator() then
    raise exception 'transfer_user_to_portfolio: platform operator required';
  end if;

  update public.profiles
     set portfolio_id = p_new_portfolio_id,
         role_id = coalesce(p_new_role_id, role_id),
         hoa_role = coalesce(p_new_hoa_role, hoa_role),
         updated_at = now()
   where id = p_profile_id
   returning * into updated;

  if not found then
    raise exception 'transfer_user_to_portfolio: profile % not found', p_profile_id;
  end if;
  return updated;
end;
$$;

grant execute on function public.transfer_user_to_portfolio(uuid, uuid, uuid, public.hoa_role) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. remove_staff_member  (portfolio admin only — demotes to 'owner' not deletes)
-- -----------------------------------------------------------------------------
create or replace function public.remove_staff_member(p_profile_id uuid, p_reason text default null)
returns public.profiles
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target public.profiles;
  updated public.profiles;
begin
  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'remove_staff_member: profile not found';
  end if;

  if not public.can_admin_portfolio(target.portfolio_id) then
    raise exception 'remove_staff_member: must be admin of profile''s portfolio';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'remove_staff_member: cannot remove yourself';
  end if;

  update public.profiles
     set portfolio_id = null,
         role_id = null,
         hoa_role = 'owner',
         updated_at = now()
   where id = p_profile_id
   returning * into updated;

  -- Log reason separately into audit log details
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, details
  ) values (
    auth.uid(), target.portfolio_id, 'profile', p_profile_id,
    'staff_removed',
    jsonb_build_object('reason', p_reason)
  );

  return updated;
end;
$$;

grant execute on function public.remove_staff_member(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. suspend_portfolio / reactivate_portfolio  (platform operator only)
-- -----------------------------------------------------------------------------
create or replace function public.suspend_portfolio(p_portfolio_id uuid, p_reason text)
returns public.portfolios
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  updated public.portfolios;
begin
  if not public.is_platform_operator() then
    raise exception 'suspend_portfolio: platform operator required';
  end if;

  update public.portfolios
     set suspended_at = now(), suspension_reason = p_reason, updated_at = now()
   where id = p_portfolio_id
   returning * into updated;

  update public.subscriptions set status = 'paused', updated_at = now()
   where portfolio_id = p_portfolio_id;

  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, details
  ) values (
    auth.uid(), null, 'portfolio', p_portfolio_id,
    'suspended',
    jsonb_build_object('reason', p_reason)
  );
  return updated;
end;
$$;

create or replace function public.reactivate_portfolio(p_portfolio_id uuid)
returns public.portfolios
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  updated public.portfolios;
begin
  if not public.is_platform_operator() then
    raise exception 'reactivate_portfolio: platform operator required';
  end if;

  update public.portfolios
     set suspended_at = null, suspension_reason = null, updated_at = now()
   where id = p_portfolio_id
   returning * into updated;

  update public.subscriptions set status = 'active', updated_at = now()
   where portfolio_id = p_portfolio_id and status = 'paused';
  return updated;
end;
$$;

grant execute on function public.suspend_portfolio(uuid, text) to authenticated;
grant execute on function public.reactivate_portfolio(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. rotate_api_key  (admin only — revokes old key, issues new)
-- -----------------------------------------------------------------------------
create or replace function public.rotate_api_key(p_api_key_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  old_key public.api_keys;
  new_key_result jsonb;
begin
  select * into old_key from public.api_keys where id = p_api_key_id;
  if not found then
    raise exception 'rotate_api_key: key not found';
  end if;
  if not public.can_admin_portfolio(old_key.portfolio_id) then
    raise exception 'rotate_api_key: must be portfolio admin';
  end if;

  update public.api_keys
     set revoked_at = now(), revoked_by = auth.uid(), updated_at = now()
   where id = p_api_key_id;

  new_key_result := public.create_api_key(
    old_key.portfolio_id,
    old_key.name || ' (rotated)',
    old_key.scopes,
    case when old_key.expires_at is not null then extract(day from (old_key.expires_at - now()))::integer end
  );

  return jsonb_build_object(
    'old_key_id', p_api_key_id,
    'new_key', new_key_result
  );
end;
$$;

grant execute on function public.rotate_api_key(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. resend_invitation  (creates a new token, invalidates the old)
-- -----------------------------------------------------------------------------
create or replace function public.resend_invitation(p_invitation_id uuid)
returns public.user_invitations
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  old_inv public.user_invitations;
  new_inv public.user_invitations;
begin
  select * into old_inv from public.user_invitations where id = p_invitation_id;
  if not found then raise exception 'resend_invitation: not found'; end if;
  if not public.can_admin_portfolio(old_inv.portfolio_id) then
    raise exception 'resend_invitation: must be admin of portfolio';
  end if;
  if old_inv.status <> 'pending' then
    raise exception 'resend_invitation: only pending invitations can be resent';
  end if;

  update public.user_invitations set status = 'revoked', updated_at = now() where id = p_invitation_id;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by, message, expires_at
  ) values (
    old_inv.portfolio_id, old_inv.email, old_inv.hoa_role, old_inv.role_id,
    auth.uid(), old_inv.message, now() + interval '14 days'
  ) returning * into new_inv;
  return new_inv;
end;
$$;

grant execute on function public.resend_invitation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 11. Convenience: the current user's identity and capabilities (for app bootstrap)
-- -----------------------------------------------------------------------------
create or replace function public.me()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (select to_jsonb(po) from public.portfolios po
                  where po.id = public.current_portfolio_id()),
    'role_name', public.current_role_name(),
    'is_platform_operator', public.is_platform_operator(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'owner_id', public.current_owner_id(),
    'vendor_id', public.current_vendor_id(),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids())
  );
$$;

grant execute on function public.me() to authenticated;

comment on function public.me() is 'Single-call bootstrap for the admin/portal UI. Returns the user''s identity, portfolio, role, and all the boolean capability flags.';
;
