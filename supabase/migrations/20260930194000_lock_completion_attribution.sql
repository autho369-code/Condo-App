-- Review fix: completed_by_assignee_id could be rewritten on a finished work
-- order (the trigger coalesced the old value with whatever the caller sent,
-- and staff/assigned vendors can update work_orders through the Data API).
-- It is now derived only by the trigger: set from the assignee at the moment
-- a job finishes, carried unchanged while it stays finished, cleared when it
-- reopens — any value a caller supplies is ignored.
create or replace function public.work_order_stamp_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare finishing text[] := array['done', 'completed', 'billed', 'closed'];
begin
  if new.status::text = any (finishing) then
    if tg_op = 'UPDATE' and old.status::text = any (finishing) then
      if new.status is distinct from old.status then
        -- Finished -> finished: the job was completed when it was first finished.
        new.completed_date := coalesce(old.completed_date, new.completed_date, current_date);
      end if;
      new.completed_by_assignee_id := old.completed_by_assignee_id;
    else
      if new.completed_date is null then new.completed_date := current_date; end if;
      new.completed_by_assignee_id := new.assignee_id;
    end if;
  elsif new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status is distinct from 'cancelled' then new.completed_date := null; end if;
    new.completed_by_assignee_id := null;
  else
    if tg_op = 'UPDATE' and (old.status::text = any (finishing) or old.status = 'cancelled') then
      new.completed_date := null;
    end if;
    new.completed_by_assignee_id := null;
  end if;
  return new;
end $$;
