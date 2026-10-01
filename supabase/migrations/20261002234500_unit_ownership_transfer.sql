-- Unit sale / ownership transfer.
--
-- Adding a new owner to a unit used to insert a second "current" primary
-- occupancy and never touch unit_owners. Receivables code that resolves the
-- owner through unit_owners (receivable_payments_ledger, delinquency_cases,
-- /charges?owner=) then kept pointing at the seller, and owner ledgers counted
-- the unit for both owners.
--
-- 1. transfer_unit_ownership(unit, new_owner, date) closes out the previous
--    owners in one transaction: their current owner occupancies on the unit
--    become 'past' (move_out_date = transfer date), their open unit_owners rows
--    get end_date = transfer date, and the new owner gets a current primary
--    unit_owners row starting on the transfer date. The unit balance stays
--    with the unit (settled at closing); nothing is moved.
--
-- 2. Data repair: every current owner occupancy gets a matching current
--    unit_owners row when it has none. Existing duplicate current owners are
--    NOT ended automatically.
--
-- Note: unit_owners_active_unique is a full (not partial) unique index on
-- (unit_id, owner_id), so a returning owner's old row is reopened rather than
-- a second row inserted.

create or replace function public.transfer_unit_ownership(
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
  v_share numeric;
  v_ended integer := 0;
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

  if exists (
    select 1 from public.occupancies o
    where o.unit_id = p_unit_id
      and o.occupancy_type = 'owner'
      and o.status = 'current'
      and o.owner_id is distinct from p_new_owner_id
      and o.move_in_date > p_transfer_date
  ) then
    raise exception 'The transfer date is before the previous owner''s move-in date.' using errcode = '22023';
  end if;

  -- Serialize concurrent transfers on the same unit.
  perform 1 from public.units where id = p_unit_id for update;

  update public.occupancies o
     set status = 'past',
         move_out_date = p_transfer_date,
         is_primary = false
   where o.unit_id = p_unit_id
     and o.occupancy_type = 'owner'
     and o.status = 'current'
     and o.owner_id is distinct from p_new_owner_id;
  get diagnostics v_ended = row_count;

  update public.unit_owners uo
     set end_date = greatest(p_transfer_date, uo.start_date)
   where uo.unit_id = p_unit_id
     and uo.end_date is null
     and uo.owner_id <> p_new_owner_id;

  -- The buyer becomes the unit's primary owner.
  update public.occupancies o
     set is_primary = true
   where o.unit_id = p_unit_id
     and o.owner_id = p_new_owner_id
     and o.occupancy_type = 'owner'
     and o.status = 'current';

  select coalesce(max(o.share_pct), 100) into v_share
  from public.occupancies o
  where o.unit_id = p_unit_id and o.owner_id = p_new_owner_id
    and o.occupancy_type = 'owner' and o.status = 'current';

  insert into public.unit_owners (unit_id, owner_id, is_primary, share_pct, start_date, end_date)
  values (p_unit_id, p_new_owner_id, true, v_share, p_transfer_date, null)
  on conflict (unit_id, owner_id) do update
     set is_primary = true,
         share_pct = excluded.share_pct,
         start_date = excluded.start_date,
         end_date = null;

  return v_ended;
end;
$$;

revoke all on function public.transfer_unit_ownership(uuid, uuid, date) from public;
revoke all on function public.transfer_unit_ownership(uuid, uuid, date) from anon;
grant execute on function public.transfer_unit_ownership(uuid, uuid, date) to authenticated;

-- Backfill: current owner occupancies without a current unit_owners row.
insert into public.unit_owners (unit_id, owner_id, is_primary, share_pct, start_date, end_date)
select distinct on (o.unit_id, o.owner_id)
       o.unit_id, o.owner_id, o.is_primary, o.share_pct,
       coalesce(o.move_in_date, o.created_at::date), null
from public.occupancies o
where o.status = 'current'
  and o.occupancy_type = 'owner'
  and o.owner_id is not null
  and not exists (
    select 1 from public.unit_owners uo
    where uo.unit_id = o.unit_id and uo.owner_id = o.owner_id and uo.end_date is null
  )
order by o.unit_id, o.owner_id, o.is_primary desc, o.created_at
on conflict (unit_id, owner_id) do nothing;
