-- =============================================================================
-- Phase 8c — Invitation system + permission audit log
-- =============================================================================

create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  email text not null check (length(email) between 3 and 320),
  hoa_role public.hoa_role not null default 'manager',
  role_id uuid references public.user_roles(id) on delete set null,
  token text not null unique default (
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
  ),
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  invited_by uuid references auth.users(id) on delete set null,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_user_invitations_portfolio on public.user_invitations(portfolio_id);
create index idx_user_invitations_email on public.user_invitations(lower(email));
create index idx_user_invitations_pending on public.user_invitations(portfolio_id, status) where status = 'pending';
create trigger trg_user_invitations_updated before update on public.user_invitations
  for each row execute function public.touch_updated_at();

alter table public.user_invitations enable row level security;
create policy user_invitations_platform_all on public.user_invitations
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy user_invitations_admin_all on public.user_invitations
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id))
  with check (public.can_admin_portfolio(portfolio_id));

comment on table public.user_invitations is 'Tokenized email invites. Portfolio admins create invitations; recipients accept via token RPC → auto-links profile to portfolio + role.';

-- -----------------------------------------------------------------------------
-- RPC functions
-- -----------------------------------------------------------------------------

create or replace function public.create_invitation(
  p_portfolio_id uuid,
  p_email text,
  p_hoa_role public.hoa_role default 'manager',
  p_role_id uuid default null,
  p_message text default null,
  p_expires_days integer default 14
)
returns public.user_invitations
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  inv public.user_invitations;
begin
  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, message, invited_by, expires_at
  ) values (
    p_portfolio_id, lower(p_email), p_hoa_role, p_role_id, p_message, auth.uid(),
    now() + make_interval(days => p_expires_days)
  )
  returning * into inv;
  return inv;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
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

  update public.profiles
     set portfolio_id = inv.portfolio_id,
         role_id = inv.role_id,
         hoa_role = inv.hoa_role,
         updated_at = now()
   where id = calling_user;

  update public.user_invitations
     set status = 'accepted', used_at = now(), used_by = calling_user
   where id = inv.id;

  return jsonb_build_object(
    'success', true,
    'portfolio_id', inv.portfolio_id,
    'hoa_role', inv.hoa_role,
    'role_id', inv.role_id
  );
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language sql security invoker set search_path = pg_catalog, public
as $$
  update public.user_invitations
     set status = 'revoked', updated_at = now()
   where id = p_invitation_id and status = 'pending';
$$;

-- -----------------------------------------------------------------------------
-- permission_audit_log
-- -----------------------------------------------------------------------------
create table public.permission_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_portfolio_id uuid references public.portfolios(id) on delete set null,
  target_entity_type text not null,
  target_entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  at timestamptz not null default now()
);
create index idx_perm_audit_actor on public.permission_audit_log(actor_user_id, at desc);
create index idx_perm_audit_target on public.permission_audit_log(target_entity_type, target_entity_id, at desc);
create index idx_perm_audit_portfolio on public.permission_audit_log(actor_portfolio_id, at desc);
create index idx_perm_audit_action on public.permission_audit_log(action, at desc);

alter table public.permission_audit_log enable row level security;
create policy perm_audit_platform_all on public.permission_audit_log
  for select to authenticated using (public.is_platform_operator());
create policy perm_audit_admin_own_portfolio on public.permission_audit_log
  for select to authenticated
  using (public.is_full_access_staff() and actor_portfolio_id = public.current_portfolio_id());

comment on table public.permission_audit_log is 'Immutable log of privilege-changing events (role assignments, invitations, portfolio moves). Only platform operators and portfolio admins can read; writes come from triggers.';

-- Triggers

create or replace function public.log_profile_privilege_change()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.portfolio_id is distinct from old.portfolio_id
    or new.role_id is distinct from old.role_id
    or new.hoa_role is distinct from old.hoa_role
  ) then
    insert into public.permission_audit_log (
      actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
      action, before_state, after_state
    ) values (
      auth.uid(), public.current_portfolio_id(), 'profile', new.id,
      'privilege_change',
      jsonb_build_object('portfolio_id', old.portfolio_id, 'role_id', old.role_id, 'hoa_role', old.hoa_role),
      jsonb_build_object('portfolio_id', new.portfolio_id, 'role_id', new.role_id, 'hoa_role', new.hoa_role)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_profile_privilege on public.profiles;
create trigger trg_log_profile_privilege
  after update on public.profiles
  for each row execute function public.log_profile_privilege_change();

create or replace function public.log_user_role_change()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), public.current_portfolio_id(), 'user_role', coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_user_role on public.user_roles;
create trigger trg_log_user_role
  after insert or update or delete on public.user_roles
  for each row execute function public.log_user_role_change();

create or replace function public.log_platform_operator_change()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), null, 'platform_operator', coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_platform_operator on public.platform_operators;
create trigger trg_log_platform_operator
  after insert or update or delete on public.platform_operators
  for each row execute function public.log_platform_operator_change();

create or replace function public.log_invitation_event()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), coalesce(new.portfolio_id, old.portfolio_id),
    'user_invitation', coalesce(new.id, old.id),
    case
      when tg_op = 'INSERT' then 'invitation_created'
      when tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then 'invitation_accepted'
      when tg_op = 'UPDATE' and new.status = 'revoked' and old.status = 'pending' then 'invitation_revoked'
      when tg_op = 'UPDATE' and new.status = 'expired' then 'invitation_expired'
      else 'invitation_update'
    end,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists trg_log_invitation on public.user_invitations;
create trigger trg_log_invitation
  after insert or update on public.user_invitations
  for each row execute function public.log_invitation_event();

-- -----------------------------------------------------------------------------
-- Bootstrap helper for first platform admin
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_platform_admin(p_auth_user_id uuid, p_full_name text default null)
returns public.platform_operators
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  existing_count integer;
  po_row public.platform_operators;
  user_email text;
begin
  select count(*) into existing_count from public.platform_operators;
  if existing_count > 0 then
    raise exception 'platform_operators already bootstrapped; use the regular admin flow';
  end if;

  select email into user_email from auth.users where id = p_auth_user_id;
  if user_email is null then
    raise exception 'no auth.users row for %', p_auth_user_id;
  end if;

  insert into public.platform_operators (auth_user_id, email, full_name, role)
  values (p_auth_user_id, user_email, p_full_name, 'admin')
  returning * into po_row;
  return po_row;
end;
$$;

comment on function public.bootstrap_platform_admin(uuid, text) is 'ONE-TIME bootstrap: call via service role to register the first platform admin. Refuses to run once platform_operators has any rows.';

-- -----------------------------------------------------------------------------
-- Convenience view for admin UIs
-- -----------------------------------------------------------------------------
create view public.v_pending_invitations
  with (security_invoker = true) as
select
  inv.id,
  inv.portfolio_id,
  p.company_name as portfolio_name,
  inv.email,
  inv.hoa_role,
  ur.name as role_name,
  inv.expires_at,
  inv.invited_by,
  inv.created_at,
  inv.message
from public.user_invitations inv
join public.portfolios p on p.id = inv.portfolio_id
left join public.user_roles ur on ur.id = inv.role_id
where inv.status = 'pending'
  and inv.expires_at > now();

comment on view public.v_pending_invitations is 'Open invitations per portfolio. Inherits RLS from user_invitations.';
;
