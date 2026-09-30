-- Review fix: reopening a finished work order (back to new / assigned /
-- scheduled / in progress) kept its old completed_date, so finishing it again
-- reused the stale date and put the completion in the wrong period. Moving to
-- an active status now clears it; the next finish stamps a fresh date.
create or replace function public.work_order_stamp_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.status in ('done', 'completed', 'billed', 'closed') then
    if new.completed_date is null then new.completed_date := current_date; end if;
  elsif new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status is distinct from 'cancelled' then new.completed_date := null; end if;
  elsif tg_op = 'UPDATE' and old.status in ('done', 'completed', 'billed', 'closed', 'cancelled') then
    -- Reopened: the job isn't finished any more.
    new.completed_date := null;
  end if;
  return new;
end $$;
