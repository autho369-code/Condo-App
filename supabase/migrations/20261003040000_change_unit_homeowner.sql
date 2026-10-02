-- change_unit_homeowner(unit, new_owner, date): one transaction for a unit sale.
-- Locks the unit, moves the buyer in (owner occupancy, carrying the seller's
-- dues, 0 when the unit had no owner) unless they already own it, then calls
-- transfer_unit_ownership to end the seller's ownership on the transfer date.
-- Before this the app inserted the occupancy and called the transfer in two
-- separate requests, so a crash or a concurrent sale could leave two current
-- owners.

create or replace function public.change_unit_homeowner(
  p_unit_id uuid,
  p_new_owner_id uuid,
  p_transfer_date date
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_association_id uuid;
  v_portfolio_id uuid;
  v_owner_portfolio_id uuid;
  v_dues numeric;
  v_frequency public.recurring_frequency;
begin
  if p_unit_id is null or p_new_owner_id is null or p_transfer_date is null then
    raise exception 'Unit, new owner and transfer date are required.' using errcode = '22023';
  end if;

  select b.association_id, a.portfolio_id
    into v_association_id, v_portfolio_id
  from public.units u
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  where u.id = p_unit_id and u.archived_at is null;

  if v_association_id is null then
    raise exception 'Unit not found.' using errcode = 'P0002';
  end if;

  if not public.can_manage_association(v_association_id)
     or not public.can_access_portfolio(v_portfolio_id) then
    raise exception 'You are not authorized to manage this unit.' using errcode = '42501';
  end if;

  select ow.portfolio_id into v_owner_portfolio_id
  from public.owners ow
  where ow.id = p_new_owner_id and ow.archived_at is null;

  if v_owner_portfolio_id is null or v_owner_portfolio_id <> v_portfolio_id then
    raise exception 'The new owner does not belong to this unit''s portfolio.' using errcode = '42501';
  end if;

  -- Serialize sales of the same unit for the whole transaction.
  perform 1 from public.units where id = p_unit_id for update;

  if not exists (
    select 1 from public.occupancies o
    where o.unit_id = p_unit_id and o.owner_id = p_new_owner_id
      and o.occupancy_type = 'owner' and o.status = 'current'
  ) then
    select o.dues_amount, o.dues_frequency
      into v_dues, v_frequency
    from public.occupancies o
    where o.unit_id = p_unit_id and o.occupancy_type = 'owner' and o.status = 'current'
    order by o.is_primary desc nulls last, o.move_in_date desc nulls last
    limit 1;

    insert into public.occupancies (
      owner_id, unit_id, association_id, occupancy_type, status,
      move_in_date, dues_amount, dues_frequency, share_pct, is_primary
    ) values (
      p_new_owner_id, p_unit_id, v_association_id, 'owner', 'current',
      p_transfer_date, coalesce(v_dues, 0), coalesce(v_frequency, 'monthly'::public.recurring_frequency), 100, false
    );
  elsif not exists (
    select 1 from public.occupancies o
    where o.unit_id = p_unit_id and o.owner_id is distinct from p_new_owner_id
      and o.occupancy_type = 'owner' and o.status = 'current'
  ) then
    raise exception 'That owner already owns this unit.' using errcode = '22023';
  end if;

  return public.transfer_unit_ownership(p_unit_id, p_new_owner_id, p_transfer_date);
end;
$$;

revoke all on function public.change_unit_homeowner(uuid, uuid, date) from public;
revoke all on function public.change_unit_homeowner(uuid, uuid, date) from anon;
grant execute on function public.change_unit_homeowner(uuid, uuid, date) to authenticated;
