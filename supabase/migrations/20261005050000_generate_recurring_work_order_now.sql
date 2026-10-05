-- "Generate now" for one recurring work-order plan: claim the occurrence
-- (advance next_due_date only if it still holds the value the caller read)
-- and insert the work order in ONE transaction, so a crash or timeout between
-- the two can never advance the schedule without creating the job.
-- SECURITY INVOKER: the caller's RLS on both tables still applies.
create or replace function public.generate_recurring_work_order_now(
  p_id uuid,
  p_expected_due date,
  p_next date,
  p_scheduled date
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  tpl public.recurring_work_orders%rowtype;
  wo_id uuid;
begin
  update public.recurring_work_orders
     set last_generated_at = now(), next_due_date = p_next
   where id = p_id
     and archived_at is null
     and next_due_date is not distinct from p_expected_due
  returning * into tpl;
  if not found then
    return null;
  end if;

  insert into public.work_orders (
    portfolio_id, association_id, unit_id, vendor_id, title, description,
    category, priority, trade, scheduled_date, status, created_by
  ) values (
    tpl.portfolio_id, tpl.association_id, tpl.unit_id, tpl.vendor_id, tpl.title, tpl.description,
    coalesce(tpl.category::text, 'other')::public.work_order_category,
    coalesce(tpl.priority::text, 'normal')::public.work_order_priority,
    tpl.trade::text::public.vendor_trade,
    p_scheduled,
    (case when tpl.vendor_id is not null then 'assigned' else 'new' end)::public.work_order_status,
    auth.uid()
  ) returning id into wo_id;

  return wo_id;
end;
$$;

revoke all on function public.generate_recurring_work_order_now(uuid, date, date, date) from public, anon;
grant execute on function public.generate_recurring_work_order_now(uuid, date, date, date) to authenticated;
