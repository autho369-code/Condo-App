-- Review fixes for completion dates (round 2):
-- 1. Moving between finishing statuses (done -> completed -> closed ->
--    billed) keeps the ORIGINAL completion date; only a status change that
--    starts a new finish (from an active or cancelled status) stamps today.
--    The date can still be corrected directly without a status change.
-- 2. Rows reopened before the reopen fix still carried a stale date while
--    active — cleared here.
create or replace function public.work_order_stamp_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare finishing text[] := array['done', 'completed', 'billed', 'closed'];
begin
  if new.status::text = any (finishing) then
    if tg_op = 'UPDATE' and old.status::text = any (finishing) and new.status is distinct from old.status then
      -- Finished -> finished: the job was completed when it was first finished.
      new.completed_date := coalesce(old.completed_date, new.completed_date, current_date);
    elsif new.completed_date is null then
      new.completed_date := current_date;
    end if;
  elsif new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status is distinct from 'cancelled' then new.completed_date := null; end if;
  elsif tg_op = 'UPDATE' and (old.status::text = any (finishing) or old.status = 'cancelled') then
    new.completed_date := null;
  end if;
  return new;
end $$;

update public.work_orders
   set completed_date = null
 where status in ('new', 'assigned', 'scheduled', 'in_progress') and completed_date is not null;
