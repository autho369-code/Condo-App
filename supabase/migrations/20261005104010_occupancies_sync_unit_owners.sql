-- Keep unit_owners in step with owner occupancies.
--
-- Ownership is written through several paths that only touch occupancies
-- (linkOccupancy, endOccupancy, owner create, owner CSV import). Readers such
-- as resolveUnitOwnerId (lib/notifications/status-change.ts) consult the open
-- unit_owners row FIRST, so a stale row sent work-order updates to the former
-- owner. This trigger mirrors every owner occupancy change into unit_owners.
--
-- Idempotent with transfer_unit_ownership / change_unit_homeowner: those RPCs
-- also upsert unit_owners ON CONFLICT (unit_id, owner_id) and set end_date on
-- the previous owner's row; the trigger uses the same conflict target and only
-- touches still-open rows, so running both never double-inserts
-- (unit_owners_active_unique is a plain unique index on (unit_id, owner_id)).

create or replace function public.sync_unit_owners_from_occupancy()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_new_open boolean := false;
  v_old_open boolean := false;
  v_end date;
begin
  v_new_open := new.occupancy_type = 'owner'
    and new.owner_id is not null
    and new.status = 'current'
    and (new.move_out_date is null or new.move_out_date > current_date);

  if tg_op = 'UPDATE' then
    v_old_open := old.occupancy_type = 'owner'
      and old.owner_id is not null
      and old.status = 'current'
      and (old.move_out_date is null or old.move_out_date > current_date);
  end if;

  -- Close the previous owner's row when this occupancy stops being a current
  -- owner occupancy (ended, moved out, re-pointed to another owner/unit), unless
  -- that owner still holds another current owner occupancy on the same unit.
  if v_old_open and not (
       v_new_open and new.owner_id = old.owner_id and new.unit_id = old.unit_id
     ) then
    if not exists (
      select 1 from public.occupancies o
      where o.id <> new.id
        and o.unit_id = old.unit_id
        and o.owner_id = old.owner_id
        and o.occupancy_type = 'owner'
        and o.status = 'current'
        and (o.move_out_date is null or o.move_out_date > current_date)
    ) then
      v_end := coalesce(
        case when new.unit_id = old.unit_id and new.owner_id = old.owner_id
             then new.move_out_date end,
        current_date
      );
      update public.unit_owners uo
         set end_date = greatest(v_end, uo.start_date)
       where uo.unit_id = old.unit_id
         and uo.owner_id = old.owner_id
         and uo.end_date is null;
    end if;
  end if;

  -- A current owner occupancy must have an open unit_owners row.
  if v_new_open then
    insert into public.unit_owners (unit_id, owner_id, is_primary, share_pct, start_date, end_date)
    values (
      new.unit_id, new.owner_id, coalesce(new.is_primary, true),
      coalesce(new.share_pct, 100), coalesce(new.move_in_date, current_date), null
    )
    on conflict (unit_id, owner_id) do update
       set is_primary = excluded.is_primary,
           share_pct  = excluded.share_pct,
           start_date = case when public.unit_owners.end_date is null
                             then public.unit_owners.start_date
                             else excluded.start_date end,
           end_date   = null;
  end if;

  return null;
end;
$$;

revoke all on function public.sync_unit_owners_from_occupancy() from public, anon, authenticated;

drop trigger if exists trg_occupancies_sync_unit_owners on public.occupancies;
create trigger trg_occupancies_sync_unit_owners
  after insert or update of status, move_out_date, move_in_date, owner_id, unit_id, occupancy_type, is_primary, share_pct
  on public.occupancies
  for each row execute function public.sync_unit_owners_from_occupancy();

-- One-time reconciliation (no-op on consistent data): close open unit_owners
-- rows whose owner has no current/future owner occupancy on that unit, and open
-- rows for current owner occupancies that lack one.
update public.unit_owners uo
   set end_date = greatest(current_date, uo.start_date)
 where uo.end_date is null
   and not exists (
     select 1 from public.occupancies o
     where o.unit_id = uo.unit_id and o.owner_id = uo.owner_id
       and o.occupancy_type = 'owner' and o.status in ('current', 'future')
   );

insert into public.unit_owners (unit_id, owner_id, is_primary, share_pct, start_date, end_date)
select distinct on (o.unit_id, o.owner_id)
       o.unit_id, o.owner_id, o.is_primary, o.share_pct,
       coalesce(o.move_in_date, current_date), null
  from public.occupancies o
 where o.occupancy_type = 'owner' and o.status = 'current' and o.owner_id is not null
   and (o.move_out_date is null or o.move_out_date > current_date)
 order by o.unit_id, o.owner_id, o.is_primary desc
on conflict (unit_id, owner_id) do update
   set end_date = null,
       start_date = excluded.start_date
 where public.unit_owners.end_date is not null;
