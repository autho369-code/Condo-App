-- Owner portal lease page: owners had no read access to `tenants`, so the
-- page never showed who rents their unit (and its form edited the owner's own
-- occupancy dates instead). These functions expose only tenants on units the
-- signed-in owner currently owns, and let the owner correct lease dates.
create or replace function public.owner_unit_tenants()
returns table (
  id uuid, unit_id uuid, unit_number text, first_name text, last_name text,
  email text, phone text, lease_start date, lease_end date, status text,
  insurance_expiration date
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select t.id, t.unit_id, u.unit_number, t.first_name, t.last_name, t.email, t.phone,
         t.lease_start, t.lease_end, t.status, t.insurance_expiration
    from public.tenants t
    join public.units u on u.id = t.unit_id
   where t.archived_at is null
     and public.current_owner_id() is not null
     and t.unit_id in (
       select occ.unit_id from public.occupancies occ
        where occ.owner_id = public.current_owner_id()
          and occ.status = 'current'
          and occ.occupancy_type = 'owner')
   order by u.unit_number, t.lease_start desc nulls last, t.last_name;
$$;

create or replace function public.owner_update_tenant_lease(p_tenant_id uuid, p_lease_start date, p_lease_end date)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_owner uuid := public.current_owner_id();
begin
  if v_owner is null then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_lease_start is null then
    raise exception 'Enter the lease start date' using errcode = '22023';
  end if;
  if p_lease_end is not null and p_lease_end < p_lease_start then
    raise exception 'The lease end date must be on or after the start date' using errcode = '22023';
  end if;
  update public.tenants t
     set lease_start = p_lease_start, lease_end = p_lease_end, updated_at = now()
   where t.id = p_tenant_id
     and t.archived_at is null
     and t.unit_id in (
       select occ.unit_id from public.occupancies occ
        where occ.owner_id = v_owner and occ.status = 'current' and occ.occupancy_type = 'owner');
  if not found then
    raise exception 'That tenant is not on a unit you own' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.owner_unit_tenants() from public, anon;
revoke all on function public.owner_update_tenant_lease(uuid, date, date) from public, anon;
grant execute on function public.owner_unit_tenants() to authenticated;
grant execute on function public.owner_update_tenant_lease(uuid, date, date) to authenticated;
