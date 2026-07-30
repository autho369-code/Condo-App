-- A profile soft-disable must revoke authorization immediately, not merely
-- change a badge in the platform-operator UI. Supabase Auth is also banned by
-- the application action, but access tokens can remain valid briefly; these
-- helpers are the database/RLS backstop during that window.

create or replace function public.is_current_identity_enabled()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select auth.uid() is not null
     and not exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.disabled_at is not null
     );
$function$;

revoke all on function public.is_current_identity_enabled() from public, anon;
grant execute on function public.is_current_identity_enabled() to authenticated, service_role;

create or replace function public.current_portfolio_id()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select p.portfolio_id
  from public.profiles p
  where p.id = auth.uid()
    and p.disabled_at is null;
$function$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    ur.name,
    case p.hoa_role
      when 'owner' then 'Owner'
      when 'board' then 'Board Member'
      when 'tenant' then 'Tenant'
      when 'company_admin' then 'Company Admin'
      when 'manager' then 'Manager'
      else p.hoa_role::text
    end
  )
  from public.profiles p
  left join public.user_roles ur on ur.id = p.role_id
  where p.id = auth.uid()
    and p.disabled_at is null;
$function$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.disabled_at is null
      and p.hoa_role = 'manager'
  );
$function$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and p.disabled_at is null
      and (p.hoa_role = 'company_admin' or ur.name = 'President')
  );
$function$;

create or replace function public.is_full_access_staff()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and p.disabled_at is null
      and p.hoa_role = 'manager'
      and (ur.name in ('President', 'Property Manager') or ur.name is null)
  );
$function$;

create or replace function public.is_finance_staff()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    left join public.user_roles ur on ur.id = p.role_id
    where p.id = auth.uid()
      and p.disabled_at is null
      and (
        p.hoa_role = 'company_admin'
        or (
          p.hoa_role = 'manager'
          and (ur.name in ('President', 'Property Manager', 'Accountant') or ur.name is null)
        )
      )
  );
$function$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.disabled_at is null
      and p.mvp_role = 'manager'
      and p.portfolio_id is not null
  );
$function$;

create or replace function public.is_assistant_manager()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.disabled_at is null
      and p.mvp_role = 'assistant_manager'
      and p.portfolio_id is not null
  );
$function$;

create or replace function public.is_accountant()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.disabled_at is null
      and p.mvp_role = 'accountant'
      and p.portfolio_id is not null
  );
$function$;

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.is_current_identity_enabled()
     and exists (
       select 1 from public.platform_operators po
       where po.auth_user_id = auth.uid()
         and po.active
     );
$function$;

create or replace function public.is_platform_operator_safe()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.is_platform_operator();
$function$;

create or replace function public.current_owner_id()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select case when public.is_current_identity_enabled() then coalesce(
    (select o.id
     from public.owners o
     where o.auth_user_id = auth.uid()
       and o.archived_at is null
     limit 1),
    (select o.id
     from public.owners o
     join auth.users u on lower(u.email) = lower(o.email)
     where u.id = auth.uid()
       and o.archived_at is null
     limit 1)
  ) end;
$function$;

create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select case when public.is_current_identity_enabled() then coalesce(
    (select v.id
     from public.vendors v
     where v.auth_user_id = auth.uid()
       and v.archived_at is null
       and v.portal_activated
     limit 1),
    (select v.id
     from public.vendors v
     where v.archived_at is null
       and v.portal_activated
       and v.auth_user_id is null
       and exists (
         select 1
         from auth.users u
         cross join lateral jsonb_array_elements_text(v.emails) as e(email)
         where u.id = auth.uid()
           and lower(e.email) = lower(u.email)
       )
     limit 1)
  ) end;
$function$;

create or replace function public.is_board_user()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.is_current_identity_enabled() and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.hoa_role = 'board'
    )
    or exists (
      select 1 from public.board_members bm
      where bm.active and bm.auth_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.board_members bm
      join auth.users u on lower(u.email) = lower(bm.email)
      where u.id = auth.uid()
        and bm.active
        and bm.auth_user_id is null
    )
  );
$function$;

create or replace function public.current_board_association_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select bm.association_id
  from public.board_members bm
  where public.is_current_identity_enabled()
    and bm.auth_user_id = auth.uid()
    and bm.active
  union
  select bm.association_id
  from public.board_members bm
  join auth.users u on lower(u.email) = lower(bm.email)
  where public.is_current_identity_enabled()
    and u.id = auth.uid()
    and bm.active
    and bm.auth_user_id is null;
$function$;

create or replace function public.is_portal_resident()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.is_current_identity_enabled()
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid()
         and (
           p.hoa_role in ('owner', 'tenant')
           or (p.hoa_role = 'board' and public.current_owner_id() is not null)
         )
     );
$function$;

-- CREATE OR REPLACE preserves existing ACLs. Reassert that the new identity
-- helper is never anonymous and that database/application clients may call it.
revoke all on function public.is_current_identity_enabled() from public, anon;
grant execute on function public.is_current_identity_enabled() to authenticated, service_role;

