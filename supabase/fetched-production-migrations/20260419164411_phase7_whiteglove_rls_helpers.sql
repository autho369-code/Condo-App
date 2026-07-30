-- =============================================================================
-- Phase 7 — Helpers for AppFolio-style role-aware RLS (white-glove access model)
-- All helpers are SECURITY DEFINER, STABLE, search_path pinned.
-- =============================================================================

-- Any staff member (backward compat with is_manager())
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.hoa_role = 'manager'
  );
$$;

-- Current staff role name (null for portal users or staff without role_id)
create or replace function public.current_role_name()
returns text
language sql stable security definer set search_path = pg_catalog, public
as $$
  select ur.name
    from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
   where p.id = auth.uid()
     and p.hoa_role = 'manager';
$$;

-- Check specific role name
create or replace function public.has_role(role_name text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid() and ur.name = role_name
  );
$$;

-- Tier A: Full staff access (President, Property Manager, or legacy staff with no role_id)
create or replace function public.is_full_access_staff()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and p.hoa_role = 'manager'
      and (ur.name in ('President','Property Manager') or ur.name is null)
  );
$$;

-- Tier B: Finance-capable staff (Tier A + Accountant + Accounts Payable)
create or replace function public.is_finance_staff()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and p.hoa_role = 'manager'
      and (ur.name in ('President','Property Manager','Accountant','Accounts Payable') or ur.name is null)
  );
$$;

-- Tier C: Any staff (for operations)
create or replace function public.is_any_staff()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$ select public.is_staff(); $$;

-- Portal: Board member (via profiles.hoa_role = 'board')
create or replace function public.is_board_user()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.hoa_role = 'board'
  );
$$;

-- Portal: Homeowner or tenant
create or replace function public.is_portal_resident()
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.hoa_role in ('owner','tenant')
  );
$$;

-- Resolve current user to an owner record via email match
create or replace function public.current_owner_id()
returns uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select o.id
    from public.owners o
    join auth.users u on lower(u.email) = lower(o.email)
   where u.id = auth.uid()
     and o.archived_at is null
   limit 1;
$$;

-- Units the current resident currently occupies
create or replace function public.current_resident_unit_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select o.unit_id
    from public.occupancies o
   where o.owner_id = public.current_owner_id()
     and o.status = 'current';
$$;

-- Associations where current user is a current board member
create or replace function public.current_board_association_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select bm.association_id
    from public.board_members bm
    join auth.users u on lower(u.email) = lower(bm.email)
   where u.id = auth.uid() and bm.active;
$$;

-- Associations where current resident lives (for access to HOA-level info like bylaws)
create or replace function public.current_resident_association_ids()
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select distinct b.association_id
    from public.occupancies o
    join public.units un on un.id = o.unit_id
    join public.buildings b on b.id = un.building_id
   where o.owner_id = public.current_owner_id()
     and o.status = 'current';
$$;

-- Vendor linked to current user via vendors.emails jsonb array
create or replace function public.current_vendor_id()
returns uuid
language sql stable security definer set search_path = pg_catalog, public
as $$
  select v.id
    from public.vendors v
   where exists (
     select 1
       from auth.users u
       cross join lateral jsonb_array_elements_text(v.emails) as e(email)
      where u.id = auth.uid()
        and lower(e.email) = lower(u.email)
   )
     and v.archived_at is null
     and v.portal_activated
   limit 1;
$$;

-- Per-GL access check (uses gl_account_role_permissions; falls back to full-access staff)
create or replace function public.can_read_gl(gl_id uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select public.is_full_access_staff()
      or exists (
        select 1 from public.profiles p
        join public.gl_account_role_permissions grp on grp.role_id = p.role_id
        where p.id = auth.uid()
          and grp.gl_account_id = gl_id
          and grp.permission in ('read','full')
      );
$$;

comment on function public.is_full_access_staff() is 'Tier A: President, Property Manager, and legacy staff (profile.role_id IS NULL). Full CRUD across all domains.';
comment on function public.is_finance_staff() is 'Tier B: Tier A + Accountant + Accounts Payable. Full CRUD over financial tables.';
comment on function public.is_any_staff() is 'Tier C: any staff user. Full CRUD over operations (maintenance, inspections, calendar, comms).';
comment on function public.current_owner_id() is 'Resolves auth user → owners.id via email match. Null if no linked owner.';
comment on function public.current_vendor_id() is 'Resolves auth user → vendors.id via email in vendors.emails jsonb + portal_activated.';
;
