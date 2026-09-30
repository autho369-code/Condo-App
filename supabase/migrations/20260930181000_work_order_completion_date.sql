-- Review fix: only "completed" and "closed" stamped completed_date, so work
-- orders moved straight to "done" or "billed" (by staff, bulk actions, or any
-- other path) had no completion date and dropped out of completion metrics
-- (team scoreboard, vendor scorecards, reports). Every finishing status now
-- gets today's date if it has none; cancelling clears it. Existing undated
-- finished rows are backfilled from their last update.
create or replace function public.work_order_stamp_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.status in ('done', 'completed', 'billed', 'closed') then
    if new.completed_date is null then new.completed_date := current_date; end if;
  elsif new.status = 'cancelled' and (tg_op = 'INSERT' or old.status is distinct from 'cancelled') then
    new.completed_date := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_work_order_stamp_completion on public.work_orders;
create trigger trg_work_order_stamp_completion before insert or update of status, completed_date on public.work_orders
  for each row execute function public.work_order_stamp_completion();

update public.work_orders
   set completed_date = coalesce(updated_at, created_at)::date
 where status in ('done', 'completed', 'billed', 'closed') and completed_date is null;
