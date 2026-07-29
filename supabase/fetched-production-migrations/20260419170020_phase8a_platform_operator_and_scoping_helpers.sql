-- =============================================================================
-- Phase 8a — Multi-tenant SaaS foundation
--   • platform_operators (super admin for the SaaS vendor)
--   • Scoping helpers: current_portfolio_id, can_access_portfolio, can_access_association
--   • Auto-profile creation on signup (no more orphaned auth.users)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. platform_operators  (you + your support team — not tied to any portfolio)
-- -----------------------------------------------------------------------------
create table public.platform_operators (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade unique,
  email text not null,
  full_name text,
  role text not null default 'admin' check (role in ('admin','support','readonly')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_platform_operators_active on public.platform_operators(auth_user_id) where active;
create trigger trg_platform_operators_updated before update on public.platform_operators
  for each row execute function public.touch_updated_at();

alter table public.platform_operators enable row level security;
-- Only platform_operators can see platform_operators (bootstrap via service role)
create policy platform_operators_self_read on public.platform_operators
  for select to authenticated using (auth_user_id = auth.uid());
create policy platform_operators_admin_all on public.platform_operators
  for all to authenticated
  using (exists (select 1 from public.platform_operators po
                 where po.auth_user_id = auth.uid() and po.active and po.role = 'admin'))
  with check (exists (select 1 from public.platform_operators po
                 where po.auth_user_id = auth.uid() and po.active and po.role = 'admin'));

comment on table public.platform_operators is 'SaaS vendor staff (super admins). Separate from portfolio staff. Bypasses portfolio_id isolation for support, cross-tenant analytics, and platform admin.';

-- -----------------------------------------------------------------------------
-- 2. Scoping helpers
-- -----------------------------------------------------------------------------

create or replace function public.is_platform_operator()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.platform_operators po
    where po.auth_user_id = auth.uid() and po.active
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.platform_operators po
    where po.auth_user_id = auth.uid() and po.active and po.role = 'admin'
  );
$$;

create or replace function public.current_portfolio_id()
returns uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select p.portfolio_id
    from public.profiles p
   where p.id = auth.uid();
$$;

-- Can the current user access data in this portfolio?
--   - Platform operators: always yes
--   - Staff: only their own portfolio
--   - Portal users: no (portal access is scoped through other helpers)
create or replace function public.can_access_portfolio(p_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select p_id is not null
    and (
      public.is_platform_operator()
      or (public.is_any_staff() and p_id = public.current_portfolio_id())
    );
$$;

-- Can the current user access data tied to this association?
-- Traverses association.portfolio_id.
create or replace function public.can_access_association(a_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select a_id is not null
    and exists (
      select 1 from public.associations a
      where a.id = a_id
        and public.can_access_portfolio(a.portfolio_id)
    );
$$;

-- Can access data tied to a unit (via building → association → portfolio)
create or replace function public.can_access_unit(u_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select u_id is not null
    and exists (
      select 1 from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = u_id and public.can_access_association(b.association_id)
    );
$$;

-- Finance access scoped to portfolio
create or replace function public.can_manage_finance(p_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select p_id is not null
    and (
      public.is_platform_operator()
      or (public.is_finance_staff() and p_id = public.current_portfolio_id())
    );
$$;

-- Full access scoped to portfolio (for admin actions like managing users/roles)
create or replace function public.can_admin_portfolio(p_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select p_id is not null
    and (
      public.is_platform_operator()
      or (public.is_full_access_staff() and p_id = public.current_portfolio_id())
    );
$$;

comment on function public.can_access_portfolio(uuid) is 'Tier C (any staff) + portfolio isolation. Use in operations/people RLS policies.';
comment on function public.can_manage_finance(uuid) is 'Tier B (finance staff) + portfolio isolation. Use in finance RLS policies.';
comment on function public.can_admin_portfolio(uuid) is 'Tier A (full access staff) + portfolio isolation. Use for admin actions (managing users, roles, portfolio settings).';

-- -----------------------------------------------------------------------------
-- 3. Auto-create profile on signup
--    Every new auth.users insert triggers a matching profiles row.
--    Portfolio assignment happens via the invitation flow (next migration).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, email, hoa_role)
  values (
    new.id,
    new.email,
    -- Default to 'owner' for portal signups. Staff get upgraded via invitation acceptance.
    'owner'::public.hoa_role
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 4. Portfolio guard on profiles updates
--    Only platform admins or portfolio admins can change a profile's portfolio_id,
--    role_id, or hoa_role. Everyone else (including the user themselves) can't
--    self-escalate.
-- -----------------------------------------------------------------------------
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
$$;

drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_changes();

comment on function public.guard_profile_privilege_changes() is 'Prevents self-escalation. A user cannot change their own portfolio_id / role_id / hoa_role via UPDATE; only platform operators or portfolio admins can.';
;
