-- Scheduled move-outs actually end the occupancy.
--
-- An owner occupancy with a move_out_date kept status 'current' after that
-- date until someone edited it, so everything keyed on "current" (unit_owners
-- open rows, letters, inbox, parking, portal access) kept treating the former
-- owner as the owner. A daily job now flips such occupancies to 'past', and
-- the unit_owners sync trigger closes the ownership row when that happens.
--
-- 1. Trigger fix: the "was open" test ignored the move-out date only on the
--    new row, so a status change made on/after the move-out date skipped the
--    closure. An occupancy that was a current owner occupancy now counts as
--    open regardless of the date; closure ends it on its move-out date.
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
      and old.status = 'current';
  end if;

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

-- 2. Daily job: end occupancies whose move-out date has arrived (Central date).
create or replace function public.end_occupancies_past_move_out()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare n integer;
begin
  update public.occupancies
     set status = 'past', updated_at = now()
   where status = 'current'
     and move_out_date is not null
     and move_out_date <= current_date;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.end_occupancies_past_move_out() from public, anon, authenticated;

-- Runs before the 11:00 UTC unit recurring charges.
select cron.schedule('end-occupancies-past-move-out', '55 10 * * *',
  $$ select public.end_occupancies_past_move_out(); $$);

-- Catch up now.
select public.end_occupancies_past_move_out();
