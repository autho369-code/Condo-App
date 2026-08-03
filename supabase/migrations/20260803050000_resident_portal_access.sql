-- First-class resident portal access for non-owner occupants.
--
-- Portier369 remains an HOA/condominium platform: these users may see their
-- community, unit, shared documents, events, and maintenance activity, but
-- they are intentionally excluded from owner accounting, payments,
-- statements, violations, elections, and board-only records.

alter table public.tenants
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists portal_activated boolean not null default false;

alter table public.service_requests
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

alter table public.communications_log
  add column if not exists announcement_audience text;

alter table public.communications_log
  drop constraint if exists communications_log_announcement_audience_check;
alter table public.communications_log
  add constraint communications_log_announcement_audience_check
  check (announcement_audience is null or announcement_audience in ('owners', 'tenants', 'both'));

create unique index if not exists idx_tenants_one_active_portal_identity
  on public.tenants(auth_user_id)
  where auth_user_id is not null
    and portal_activated
    and status = 'active'
    and archived_at is null;

create index if not exists idx_service_requests_tenant
  on public.service_requests(tenant_id)
  where tenant_id is not null and archived_at is null;

comment on column public.tenants.auth_user_id is
  'Strong resident-portal identity link. Scoped to the tenant record portfolio and unit.';
comment on column public.tenants.portal_activated is
  'Tenant-local resident portal access switch. Never ban the shared Auth identity to disable it.';
comment on column public.service_requests.tenant_id is
  'Resident occupant who submitted the request. Owner accounting remains linked only through owner_id/homeowner_id.';

-- Migrate legacy vendor-only profiles and pending invitations that previously
-- used hoa_role=owner because the enum had no vendor value. Preserve a true
-- dual owner/vendor identity as owner until a future multi-role identity model
-- can represent both explicitly.
update public.profiles p
set hoa_role = 'vendor'
where p.hoa_role = 'owner'
  and exists (
    select 1 from public.vendors v
    where v.auth_user_id = p.id
      and v.portfolio_id = p.portfolio_id
      and v.portal_activated
      and v.archived_at is null
  )
  and not exists (
    select 1 from public.owners o
    where o.auth_user_id = p.id
      and o.portfolio_id = p.portfolio_id
      and o.portal_activated
      and o.archived_at is null
  );

update public.user_invitations ui
set hoa_role = 'vendor', updated_at = now()
where ui.hoa_role = 'owner'
  and ui.status = 'pending'
  and exists (
    select 1
    from public.vendors v
    cross join lateral jsonb_array_elements_text(v.emails) as e(email)
    where v.portfolio_id = ui.portfolio_id
      and v.archived_at is null
      and lower(e.email) = lower(ui.email)
  )
  and not exists (
    select 1 from public.owners o
    where o.portfolio_id = ui.portfolio_id
      and o.archived_at is null
      and lower(o.email) = lower(ui.email)
  );

-- Strong and email-fallback portal identities must resolve inside the profile's
-- management-company portfolio. Portal switches are enforced in RLS helpers,
-- not only by Next.js layouts, so a valid but disabled JWT cannot read data via
-- the REST API directly.
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
     join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role in ('owner', 'board')
     where o.auth_user_id = auth.uid()
       and o.portfolio_id = p.portfolio_id
       and o.portal_activated
       and o.archived_at is null
     order by o.created_at, o.id
     limit 1),
    (select o.id
     from public.owners o
     join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role in ('owner', 'board')
     join auth.users u on u.id = auth.uid() and lower(u.email) = lower(o.email)
     where o.auth_user_id is null
       and o.portfolio_id = p.portfolio_id
       and o.portal_activated
       and o.archived_at is null
     order by o.created_at, o.id
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
     join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = 'vendor'
     where v.auth_user_id = auth.uid()
       and v.portfolio_id = p.portfolio_id
       and v.portal_activated
       and v.archived_at is null
     order by v.created_at, v.id
     limit 1),
    (select v.id
     from public.vendors v
     join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = 'vendor'
     where v.auth_user_id is null
       and v.portfolio_id = p.portfolio_id
       and v.portal_activated
       and v.archived_at is null
       and exists (
         select 1
         from auth.users u
         cross join lateral jsonb_array_elements_text(v.emails) as e(email)
         where u.id = auth.uid() and lower(e.email) = lower(u.email)
       )
     order by v.created_at, v.id
     limit 1)
  ) end;
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
  join public.associations a on a.id = bm.association_id and a.archived_at is null
  join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = 'board' and p.portfolio_id = a.portfolio_id
  where public.is_current_identity_enabled()
    and bm.auth_user_id = auth.uid()
    and bm.active
  union
  select bm.association_id
  from public.board_members bm
  join public.associations a on a.id = bm.association_id and a.archived_at is null
  join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = 'board' and p.portfolio_id = a.portfolio_id
  join auth.users u on u.id = auth.uid() and lower(u.email) = lower(bm.email)
  where public.is_current_identity_enabled()
    and bm.active
    and bm.auth_user_id is null;
$function$;

create or replace function public.is_board_user()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.is_current_identity_enabled()
     and exists (select 1 from public.current_board_association_ids());
$function$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select t.id
  from public.tenants t
  join public.profiles p
    on p.id = auth.uid()
   and p.disabled_at is null
   and p.hoa_role = 'tenant'
   and p.portfolio_id = t.portfolio_id
  where public.is_current_identity_enabled()
    and t.auth_user_id = auth.uid()
    and t.portal_activated
    and t.status = 'active'
    and t.archived_at is null
  order by t.created_at, t.id
  limit 1;
$function$;

create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select t.id
  from public.tenants t
  join public.profiles p
    on p.id = auth.uid()
   and p.disabled_at is null
   and p.hoa_role = 'tenant'
   and p.portfolio_id = t.portfolio_id
  where public.is_current_identity_enabled()
    and t.auth_user_id = auth.uid()
    and t.portal_activated
    and t.status = 'active'
    and t.archived_at is null;
$function$;

create or replace function public.current_tenant_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select distinct u.id
  from public.tenants t
  join public.units u
    on u.id = t.unit_id
   and u.archived_at is null
  join public.buildings b
    on b.id = u.building_id
   and b.archived_at is null
  join public.associations a
    on a.id = b.association_id
   and a.portfolio_id = t.portfolio_id
   and a.archived_at is null
  where t.id in (select public.current_tenant_ids())
    and (t.association_id is null or t.association_id = a.id);
$function$;

create or replace function public.current_tenant_association_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select distinct a.id
  from public.tenants t
  join public.units u
    on u.id = t.unit_id
   and u.archived_at is null
  join public.buildings b
    on b.id = u.building_id
   and b.archived_at is null
  join public.associations a
    on a.id = b.association_id
   and a.portfolio_id = t.portfolio_id
   and a.archived_at is null
  where t.id in (select public.current_tenant_ids())
    and (t.association_id is null or t.association_id = a.id);
$function$;

create or replace function public.is_tenant_user()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (select 1 from public.current_tenant_ids());
$function$;

-- A resident capability is valid only when an active owner/occupant entity is
-- linked. A role label by itself must never unlock a portal.
create or replace function public.is_portal_resident()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.is_current_identity_enabled()
     and exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.disabled_at is null
         and (
           (p.hoa_role = 'owner' and public.current_owner_id() is not null)
           or (p.hoa_role = 'tenant' and public.is_tenant_user())
           or (p.hoa_role = 'board' and public.current_owner_id() is not null)
         )
     );
$function$;

-- Invitation application performs the tenant link itself. This avoids relying
-- on trigger ordering and fails the Auth insert atomically when an invitation
-- does not match a current occupant in the invited portfolio and unit.
create or replace function public.apply_pending_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_invitation public.user_invitations%rowtype;
  v_invitation_id uuid;
  v_assoc_id uuid;
  v_tenant_id uuid;
begin
  begin
    v_invitation_id := nullif(new.raw_user_meta_data ->> 'invitation_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid invitation reference';
  end;

  -- A matching email is not an invitation credential. Every current invite
  -- flow binds the exact invitation id into Auth metadata; unbound signups
  -- must never claim whichever pending invitation happens to share an email.
  if v_invitation_id is null then
    return new;
  end if;

  select *
    into v_invitation
  from public.user_invitations
  where id = v_invitation_id
    and lower(email) = lower(new.email)
    and status = 'pending'
    and expires_at > now();

  if not found then
    raise exception 'Invitation is invalid, expired, or belongs to another email';
  end if;

  if v_invitation.hoa_role = 'tenant' then
    select t.id
      into v_tenant_id
    from public.tenants t
    where t.portfolio_id = v_invitation.portfolio_id
      and t.unit_id = v_invitation.unit_id
      and lower(t.email) = lower(new.email)
      and t.status = 'active'
      and t.archived_at is null
      and (t.auth_user_id is null or t.auth_user_id = new.id)
    order by t.created_at desc
    limit 1;

    if v_tenant_id is null then
      raise exception 'Resident invitation does not match an active tenant record';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, portfolio_id, mvp_role, hoa_role)
  values (
    new.id,
    new.email,
    coalesce(v_invitation.full_name, ''),
    v_invitation.portfolio_id,
    v_invitation.mvp_role,
    v_invitation.hoa_role
  )
  on conflict (id) do update
    set portfolio_id = excluded.portfolio_id,
        mvp_role     = excluded.mvp_role,
        hoa_role     = excluded.hoa_role,
        full_name    = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  if (v_invitation.hoa_role = 'manager'
      or v_invitation.mvp_role in ('manager', 'assistant_manager'))
     and array_length(v_invitation.association_ids, 1) > 0 then
    foreach v_assoc_id in array v_invitation.association_ids loop
      insert into public.association_managers (
        user_id, association_id, portfolio_id, assigned_by, assigned_at
      ) values (
        new.id, v_assoc_id, v_invitation.portfolio_id, v_invitation.invited_by, now()
      )
      on conflict (user_id, association_id) do nothing;
    end loop;
  end if;

  if v_tenant_id is not null then
    update public.tenants
       set auth_user_id = new.id,
           portal_activated = true,
           updated_at = now()
     where id = v_tenant_id;
  end if;

  update public.user_invitations
     set status = 'accepted',
         used_at = now(),
         used_by = new.id,
         accepted_at = coalesce(accepted_at, now()),
         updated_at = now()
   where id = v_invitation.id;

  return new;
end;
$function$;

-- All email fallback linking is now constrained to the Auth user's profile
-- portfolio. The old global email match could link same-address records from a
-- different management company.
create or replace function public.auto_link_portal_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
begin
  select p.portfolio_id into v_portfolio_id
  from public.profiles p
  where p.id = new.id and p.disabled_at is null;

  if v_portfolio_id is null then
    return new;
  end if;

  update public.owners o
     set auth_user_id = new.id, portal_activated = true
   where o.portfolio_id = v_portfolio_id
     and o.auth_user_id is null
     and o.archived_at is null
     and lower(o.email) = lower(new.email)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role in ('owner', 'board') and p.disabled_at is null
     );

  update public.vendors v
     set auth_user_id = new.id, portal_activated = true
   where v.portfolio_id = v_portfolio_id
     and v.auth_user_id is null
     and v.archived_at is null
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'vendor' and p.disabled_at is null
     )
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  update public.board_members bm
     set auth_user_id = new.id
   where bm.auth_user_id is null
     and bm.active
     and lower(bm.email) = lower(new.email)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'board' and p.disabled_at is null
     )
     and exists (
       select 1 from public.associations a
       where a.id = bm.association_id and a.portfolio_id = v_portfolio_id
     );

  update public.tenants t
     set auth_user_id = new.id,
         portal_activated = true,
         updated_at = now()
   where t.id = (
     select candidate.id
     from public.tenants candidate
     where candidate.portfolio_id = v_portfolio_id
       and candidate.auth_user_id is null
       and candidate.status = 'active'
       and candidate.archived_at is null
       and lower(candidate.email) = lower(new.email)
       and exists (
         select 1 from public.profiles p
         where p.id = new.id and p.hoa_role = 'tenant' and p.disabled_at is null
       )
     order by candidate.created_at desc, candidate.id
     limit 1
   );

  update public.profiles p
     set hoa_role = 'board'
   where p.id = new.id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = new.id and bm.active
     );

  return new;
end;
$function$;

create or replace function public.relink_portal_user_on_email_change()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.email is distinct from old.email then
    update public.owners set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.board_members set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.vendors v set auth_user_id = null
      where v.auth_user_id = new.id
        and not exists (
          select 1 from jsonb_array_elements_text(v.emails) as e(email)
          where lower(e.email) = lower(new.email)
        );
    update public.tenants set auth_user_id = null, portal_activated = false, updated_at = now()
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    perform public.auto_link_portal_user() from (select new.*) s;
  end if;
  return new;
end;
$function$;

create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
  n_tenants integer;
begin
  with upd as (
    update public.owners o
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role in ('owner', 'board')
     where o.auth_user_id is null
       and o.archived_at is null
       and o.portfolio_id = p.portfolio_id
       and lower(u.email) = lower(o.email)
    returning 1
  ) select count(*) into n_owners from upd;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board'
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
       and exists (
         select 1 from public.associations a
         where a.id = bm.association_id and a.portfolio_id = p.portfolio_id
       )
    returning 1
  ) select count(*) into n_board from upd;

  with upd as (
    update public.vendors v
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'vendor'
     where v.auth_user_id is null
       and v.archived_at is null
       and v.portfolio_id = p.portfolio_id
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
    returning 1
  ) select count(*) into n_vendors from upd;

  with candidates as (
    select distinct on (u.id) t.id as tenant_id, u.id as auth_user_id
    from auth.users u
    join public.profiles p
      on p.id = u.id
     and p.disabled_at is null
     and p.hoa_role = 'tenant'
    join public.tenants t
      on t.portfolio_id = p.portfolio_id
     and t.auth_user_id is null
     and t.status = 'active'
     and t.archived_at is null
     and lower(u.email) = lower(t.email)
    order by u.id, t.created_at desc, t.id
  ), upd as (
    update public.tenants t
       set auth_user_id = candidates.auth_user_id,
           portal_activated = true,
           updated_at = now()
      from candidates
     where t.id = candidates.tenant_id
    returning 1
  ) select count(*) into n_tenants from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors),
    ('tenants', n_tenants);
end;
$function$;

create or replace function public.tenant_service_request_scope_valid(
  p_tenant_id uuid,
  p_portfolio_id uuid,
  p_association_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.tenants t
    join public.units u on u.id = t.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
    where t.id = p_tenant_id
      and t.id in (select public.current_tenant_ids())
      and t.portfolio_id = p_portfolio_id
      and t.unit_id = p_unit_id
      and a.portfolio_id = t.portfolio_id
      and a.id = p_association_id
      and (t.association_id is null or t.association_id = a.id)
      and t.archived_at is null
      and u.archived_at is null
      and b.archived_at is null
      and a.archived_at is null
  );
$function$;

create or replace function public.submit_tenant_service_request(
  p_unit_id uuid,
  p_description text,
  p_priority public.service_request_priority default 'normal',
  p_permission_to_enter boolean default false,
  p_access_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_tenant public.tenants%rowtype;
  v_association_id uuid;
  v_request_id uuid;
  v_description text;
begin
  if auth.uid() is null or not public.is_tenant_user() then
    raise exception 'Resident portal access is required';
  end if;

  v_description := btrim(coalesce(p_description, ''));
  if char_length(v_description) < 10 or char_length(v_description) > 10000 then
    raise exception 'Description must be between 10 and 10000 characters';
  end if;
  if p_access_notes is not null and char_length(p_access_notes) > 2000 then
    raise exception 'Access notes must be 2000 characters or fewer';
  end if;

  select t.*
    into v_tenant
  from public.tenants t
  where t.id in (select public.current_tenant_ids())
    and t.unit_id = p_unit_id
  order by t.created_at, t.id
  limit 1;

  if not found then
    raise exception 'Unit is not linked to this resident account';
  end if;

  select b.association_id
    into v_association_id
  from public.units u
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  where u.id = v_tenant.unit_id
    and u.archived_at is null
    and b.archived_at is null
    and a.archived_at is null
    and a.portfolio_id = v_tenant.portfolio_id
    and (v_tenant.association_id is null or v_tenant.association_id = a.id);

  if v_association_id is null
     or (v_tenant.association_id is not null and v_tenant.association_id <> v_association_id) then
    raise exception 'Resident unit association is invalid';
  end if;

  if nullif(btrim(coalesce(p_access_notes, '')), '') is not null then
    v_description := v_description || E'\n\nAccess notes: ' || btrim(p_access_notes);
  end if;

  insert into public.service_requests (
    portfolio_id,
    association_id,
    unit_id,
    tenant_id,
    homeowner_id,
    owner_id,
    description,
    priority,
    permission_to_enter,
    source,
    status,
    created_by
  ) values (
    v_tenant.portfolio_id,
    v_association_id,
    v_tenant.unit_id,
    v_tenant.id,
    null,
    null,
    v_description,
    coalesce(p_priority, 'normal'),
    coalesce(p_permission_to_enter, false),
    'resident',
    'open',
    auth.uid()
  )
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.cancel_tenant_service_request(p_service_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_updated uuid;
begin
  if auth.uid() is null or not public.is_tenant_user() then
    raise exception 'Resident portal access is required';
  end if;

  update public.service_requests sr
     set status = 'cancelled', updated_at = now()
   where sr.id = p_service_request_id
     and sr.tenant_id in (select public.current_tenant_ids())
     and sr.status in ('open', 'waiting')
     and sr.archived_at is null
     and not exists (
       select 1 from public.work_orders wo
       where wo.service_request_id = sr.id and wo.archived_at is null
     )
  returning sr.id into v_updated;

  return v_updated is not null;
end;
$function$;

create or replace function public.update_tenant_portal_profile(
  p_tenant_id uuid,
  p_phone text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_insurance_policy_number text,
  p_insurance_expiration date
)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_updated uuid;
begin
  if auth.uid() is null or not public.is_tenant_user() then
    raise exception 'Resident portal access is required';
  end if;

  if char_length(coalesce(p_phone, '')) > 50
     or char_length(coalesce(p_emergency_contact_name, '')) > 200
     or char_length(coalesce(p_emergency_contact_phone, '')) > 50
     or char_length(coalesce(p_insurance_policy_number, '')) > 200 then
    raise exception 'One or more profile fields are too long';
  end if;

  update public.tenants t
     set phone = nullif(btrim(p_phone), ''),
         emergency_contact_name = nullif(btrim(p_emergency_contact_name), ''),
         emergency_contact_phone = nullif(btrim(p_emergency_contact_phone), ''),
         insurance_policy_number = nullif(btrim(p_insurance_policy_number), ''),
         insurance_expiration = p_insurance_expiration,
         updated_at = now()
   where t.id = p_tenant_id
     and t.id in (select public.current_tenant_ids())
  returning t.id into v_updated;

  return v_updated is not null;
end;
$function$;

create or replace function public.submit_tenant_message(
  p_subject text,
  p_body text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_tenant public.tenants%rowtype;
  v_association_id uuid;
  v_unit_number text;
  v_message_id uuid;
  v_existing_id uuid;
  v_sender_name text;
  v_sender_email text;
  v_safe_body text;
  v_recipient record;
  v_recipient_count integer := 0;
begin
  if auth.uid() is null or not public.is_tenant_user() then
    raise exception 'Resident portal access is required';
  end if;
  if p_idempotency_key is null then
    raise exception 'Message request key is required';
  end if;

  p_subject := btrim(coalesce(p_subject, ''));
  p_body := btrim(coalesce(p_body, ''));
  if char_length(p_subject) < 2 or char_length(p_subject) > 200 then
    raise exception 'Subject must be between 2 and 200 characters';
  end if;
  if char_length(p_body) < 2 or char_length(p_body) > 10000 then
    raise exception 'Message must be between 2 and 10000 characters';
  end if;

  select t.* into v_tenant
  from public.tenants t
  where t.id = public.current_tenant_id();
  if not found then
    raise exception 'No active resident record was found';
  end if;

  select b.association_id, u.unit_number
    into v_association_id, v_unit_number
  from public.units u
  join public.buildings b on b.id = u.building_id
  where u.id = v_tenant.unit_id and u.archived_at is null;
  if v_association_id is null then
    raise exception 'No active association was found for this resident';
  end if;

  select id into v_existing_id
  from public.communications_log
  where sender_id = auth.uid() and idempotency_key = p_idempotency_key;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if (
    select count(*)
    from public.communications_log
    where sender_id = auth.uid()
      and direction = 'inbound'
      and created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Message limit reached. Please wait before sending another message';
  end if;

  v_sender_name := nullif(btrim(concat_ws(' ', v_tenant.first_name, v_tenant.last_name)), '');
  v_sender_name := coalesce(v_sender_name, 'A resident');
  v_sender_email := v_tenant.email;
  v_safe_body := replace(replace(replace(p_body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  insert into public.communications_log (
    portfolio_id, association_id, sender_id, direction, channel,
    recipient_count, status, subject, body, idempotency_key
  ) values (
    v_tenant.portfolio_id, v_association_id, auth.uid(), 'inbound', 'email',
    0, 'sent', p_subject, p_body, p_idempotency_key
  ) returning id into v_message_id;

  for v_recipient in
    with candidates as (
      select p.email, p.full_name as name, 1 as priority
      from public.associations a
      join public.profiles p on p.id = a.site_manager_user_id
      where a.id = v_association_id and nullif(btrim(p.email), '') is not null
      union all
      select p.email, p.full_name, 2
      from public.profiles p
      where p.portfolio_id = v_tenant.portfolio_id
        and p.hoa_role = 'company_admin'
        and p.disabled_at is null
        and nullif(btrim(p.email), '') is not null
      union all
      select p.support_email, p.company_name, 3
      from public.portfolios p
      where p.id = v_tenant.portfolio_id
        and nullif(btrim(p.support_email), '') is not null
    ), selected as (
      select * from candidates where priority = (select min(priority) from candidates)
    )
    select distinct on (lower(email)) email, name
    from selected
    order by lower(email)
  loop
    insert into public.email_queue (
      to_email, to_name, subject, body, association_id, portfolio_id,
      sent_by, status, from_address, from_name, reply_to, communication_log_id
    ) values (
      v_recipient.email,
      v_recipient.name,
      '[Resident message] ' || p_subject,
      '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
        || 'New message from ' || v_sender_name
        || case when v_unit_number is null then '' else ' (Unit ' || v_unit_number || ')' end
        || ' via the resident portal.' || E'\n\n' || v_safe_body || E'\n\n— Sent by ' || v_sender_name
        || case when v_sender_email is null then '' else ' &lt;' || v_sender_email || '&gt;' end || '</div>',
      v_association_id,
      v_tenant.portfolio_id,
      auth.uid(),
      'pending',
      'hello@portier369.com',
      'Portier369',
      v_sender_email,
      v_message_id
    );
    v_recipient_count := v_recipient_count + 1;
  end loop;

  if v_recipient_count = 0 then
    raise exception 'No management email recipient is configured for this association';
  end if;

  update public.communications_log
     set recipient_count = v_recipient_count
   where id = v_message_id;
  return v_message_id;
end;
$function$;

revoke all on function public.current_tenant_id() from public, anon;
revoke all on function public.current_tenant_ids() from public, anon;
revoke all on function public.current_tenant_unit_ids() from public, anon;
revoke all on function public.current_tenant_association_ids() from public, anon;
revoke all on function public.is_tenant_user() from public, anon;
revoke all on function public.tenant_service_request_scope_valid(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.submit_tenant_service_request(uuid, text, public.service_request_priority, boolean, text) from public, anon;
revoke all on function public.cancel_tenant_service_request(uuid) from public, anon;
revoke all on function public.update_tenant_portal_profile(uuid, text, text, text, text, date) from public, anon;
revoke all on function public.submit_tenant_message(text, text, uuid) from public, anon;

grant execute on function public.current_tenant_id() to authenticated, service_role;
grant execute on function public.current_tenant_ids() to authenticated, service_role;
grant execute on function public.current_tenant_unit_ids() to authenticated, service_role;
grant execute on function public.current_tenant_association_ids() to authenticated, service_role;
grant execute on function public.is_tenant_user() to authenticated, service_role;
grant execute on function public.tenant_service_request_scope_valid(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_tenant_service_request(uuid, text, public.service_request_priority, boolean, text) to authenticated, service_role;
grant execute on function public.cancel_tenant_service_request(uuid) to authenticated, service_role;
grant execute on function public.update_tenant_portal_profile(uuid, text, text, text, text, date) to authenticated, service_role;
grant execute on function public.submit_tenant_message(text, text, uuid) to authenticated, service_role;

-- Resident occupants may read only their own identity and nonfinancial
-- community/unit records. Mutations go through the narrow RPCs above.
-- The legacy associations_select policy granted every authenticated profile
-- every association in its portfolio, bypassing the explicit owner, board,
-- vendor, manager, and resident scopes. Those role policies are complete, so
-- remove the broad fallback instead of weakening the new resident boundary.
drop policy if exists associations_select on public.associations;

drop policy if exists tenants_self_read on public.tenants;
create policy tenants_self_read on public.tenants
  for select to authenticated
  using (id in (select public.current_tenant_ids()));

drop policy if exists associations_tenant_read on public.associations;
create policy associations_tenant_read on public.associations
  for select to authenticated
  using (public.is_tenant_user() and id in (select public.current_tenant_association_ids()));

drop policy if exists buildings_tenant_read on public.buildings;
create policy buildings_tenant_read on public.buildings
  for select to authenticated
  using (public.is_tenant_user() and association_id in (select public.current_tenant_association_ids()));

drop policy if exists units_tenant_read on public.units;
create policy units_tenant_read on public.units
  for select to authenticated
  using (public.is_tenant_user() and id in (select public.current_tenant_unit_ids()));

drop policy if exists calendar_events_tenant_read on public.calendar_events;
create policy calendar_events_tenant_read on public.calendar_events
  for select to authenticated
  using (
    public.is_tenant_user()
    and archived_at is null
    and (
      association_id in (select public.current_tenant_association_ids())
      or (association_id is null and portfolio_id = public.current_portfolio_id())
    )
  );

-- Fix the legacy owner policy's global-event branch at the same time: a null
-- association means portfolio-wide, not platform-wide.
drop policy if exists calendar_events_resident_read on public.calendar_events;
create policy calendar_events_resident_read on public.calendar_events
  for select to authenticated
  using (
    public.is_portal_resident()
    and archived_at is null
    and (
      association_id in (select public.current_resident_association_ids())
      or (association_id is null and portfolio_id = public.current_portfolio_id())
    )
  );

-- The legacy resident policies were written when "resident" meant owner.
-- Tenants must not inherit owner-only surveys or accounting configuration,
-- and owner reads must stay inside the active management-company portfolio.
drop policy if exists surveys_resident_read on public.surveys;
create policy surveys_resident_read on public.surveys
  for select to authenticated
  using (
    public.current_owner_id() is not null
    and active
    and archived_at is null
    and portfolio_id = public.current_portfolio_id()
  );

drop policy if exists charge_categories_resident_read on public.charge_categories;
create policy charge_categories_resident_read on public.charge_categories
  for select to authenticated
  using (
    public.current_owner_id() is not null
    and active
    and portfolio_id = public.current_portfolio_id()
  );

drop policy if exists communications_tenant_read on public.communications_log;
create policy communications_tenant_read on public.communications_log
  for select to authenticated
  using (
    public.is_tenant_user()
    and (
      sender_id = auth.uid()
      or (
        channel = 'announcement'
        and coalesce(announcement_audience, 'both') in ('tenants', 'both')
        and association_id in (select public.current_tenant_association_ids())
      )
    )
  );

drop policy if exists communications_resident_read on public.communications_log;
create policy communications_resident_read on public.communications_log
  for select to authenticated
  using (
    public.current_owner_id() is not null
    and (
      sender_id = auth.uid()
      or (
        channel = 'announcement'
        and coalesce(announcement_audience, 'both') in ('owners', 'both')
        and association_id in (select public.current_resident_association_ids())
      )
    )
  );

drop policy if exists documents_tenant_read on public.documents;
create policy documents_tenant_read on public.documents
  for select to authenticated
  using (
    public.is_tenant_user()
    and entity_type = 'association'
    and entity_id in (select public.current_tenant_association_ids())
    and doc_type in (
      'declaration_ccrs',
      'bylaws',
      'articles_of_incorporation',
      'rules_regulations',
      'master_insurance_policy'
    )
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
  );

drop policy if exists meetings_portal_resident_read on public.meetings;
create policy meetings_portal_resident_read on public.meetings
  for select to authenticated
  using (
    public.current_owner_id() is not null
    and association_id in (select public.current_resident_association_ids())
    and archived_at is null
    and meeting_type <> 'executive_session'
    and (
      status in ('scheduled', 'in_progress')
      or (status = 'completed' and minutes is not null)
    )
  );

drop policy if exists meetings_tenant_read on public.meetings;
create policy meetings_tenant_read on public.meetings
  for select to authenticated
  using (
    public.is_tenant_user()
    and association_id in (select public.current_tenant_association_ids())
    and archived_at is null
    and meeting_type <> 'executive_session'
    and (
      status in ('scheduled', 'in_progress')
      or (status = 'completed' and minutes is not null)
    )
  );

-- Align security-definer meeting helpers with the row policies. Open-meeting
-- access is available to owners and tenants; executive sessions remain staff
-- and board only. Tenants may view open meeting records but cannot mutate
-- association quorum calculations.
create or replace function public.can_access_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.meetings m
      join public.associations a
        on a.id = m.association_id
       and a.portfolio_id = m.portfolio_id
      where m.id = p_meeting_id
        and (
          public.is_platform_operator()
          or (
            (public.is_any_staff() or public.is_company_admin())
            and public.can_access_portfolio(a.portfolio_id)
            and public.can_access_association(a.id)
          )
          or (
            public.is_board_user()
            and a.id in (select public.current_board_association_ids())
          )
          or (
            m.meeting_type <> 'executive_session'
            and (
              (
                public.current_owner_id() is not null
                and a.id in (select public.current_resident_association_ids())
              )
              or (
                public.is_tenant_user()
                and a.id in (select public.current_tenant_association_ids())
              )
            )
          )
        )
    );
$function$;

create or replace function public.calculate_meeting_quorum(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $function$
declare
  v_meeting public.meetings%rowtype;
  v_quorum_pct integer;
  v_total_units integer;
  v_attendee_count integer;
  v_board_count integer;
  v_owner_count integer;
  v_quorum_needed integer;
  v_quorum_reached boolean;
  v_authorized boolean;
begin
  if auth.uid() is null or p_meeting_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_meeting
  from public.meetings m
  where m.id = p_meeting_id
  for update;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  v_authorized := public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_meeting.portfolio_id)
    )
    or (
      public.is_board_user()
      and v_meeting.association_id in (select public.current_board_association_ids())
    )
    or (
      public.current_owner_id() is not null
      and v_meeting.meeting_type <> 'executive_session'
      and v_meeting.association_id in (select public.current_resident_association_ids())
    );

  if not v_authorized then
    raise exception 'Not authorized for this meeting' using errcode = '42501';
  end if;

  select greatest(1, least(100, coalesce(a.quorum_percentage, 51))),
         greatest(0, coalesce(a.unit_count, 0))
  into v_quorum_pct, v_total_units
  from public.associations a
  where a.id = v_meeting.association_id;

  select count(*)::integer,
         count(*) filter (where ma.attendee_role = 'board_member')::integer,
         count(distinct ma.owner_id) filter (
           where ma.owner_id is not null
             and coalesce(ma.voting_eligible, false)
             and exists (
               select 1 from public.occupancies o
               where o.owner_id = ma.owner_id
                 and o.association_id = v_meeting.association_id
                 and o.status = 'current'
             )
         )::integer
  into v_attendee_count, v_board_count, v_owner_count
  from public.meeting_attendees ma
  where ma.meeting_id = p_meeting_id
    and ma.present;

  v_quorum_needed := ceil(v_total_units * v_quorum_pct / 100.0)::integer;
  v_quorum_reached := v_owner_count >= v_quorum_needed;

  update public.meetings m
  set quorum_met = v_quorum_reached,
      quorum_requirement = v_quorum_needed,
      total_units = v_total_units
  where m.id = p_meeting_id;

  return jsonb_build_object(
    'meeting_id', p_meeting_id,
    'total_units', v_total_units,
    'quorum_percentage', v_quorum_pct,
    'quorum_needed', v_quorum_needed,
    'attendee_count', v_attendee_count,
    'board_count', v_board_count,
    'owner_count', v_owner_count,
    'quorum_reached', v_quorum_reached
  );
end;
$function$;

drop policy if exists maintenance_tasks_resident_read on public.maintenance_tasks;
create policy maintenance_tasks_resident_read on public.maintenance_tasks
  for select to authenticated
  using (
    auth.uid() is not null
    and public.current_owner_id() is not null
    and association_id in (select public.current_resident_association_ids())
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  );

drop policy if exists work_orders_tenant_read on public.work_orders;
create policy work_orders_tenant_read on public.work_orders
  for select to authenticated
  using (
    public.is_tenant_user()
    and unit_id in (select public.current_tenant_unit_ids())
    and archived_at is null
  );

drop policy if exists service_requests_tenant_read on public.service_requests;
create policy service_requests_tenant_read on public.service_requests
  for select to authenticated
  using (
    public.is_tenant_user()
    and tenant_id in (select public.current_tenant_ids())
    and archived_at is null
  );

create or replace function public.me()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (select to_jsonb(po) from public.portfolios po where po.id = public.current_portfolio_id()),
    'role_name', public.current_role_name(),
    'is_platform_operator', public.is_platform_operator(),
    'is_company_admin', public.is_company_admin(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'is_tenant', public.is_tenant_user(),
    'owner_id', public.current_owner_id(),
    'tenant_id', public.current_tenant_id(),
    'vendor_id', public.current_vendor_id(),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids()),
    'tenant_association_ids', array(select public.current_tenant_association_ids()),
    'tenant_unit_ids', array(select public.current_tenant_unit_ids())
  );
$function$;

comment on function public.me() is
  'Single-call identity bootstrap, including separate owner and resident-occupant scopes.';
