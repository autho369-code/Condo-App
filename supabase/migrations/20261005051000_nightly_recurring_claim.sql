-- Nightly recurring generator: claim each occurrence before inserting, with
-- the same conditional advance as generate_recurring_work_order_now. The
-- loop row can be stale (a manager may have clicked "Generate now" since the
-- select); advancing next_due_date only while it still equals the loop's
-- value means exactly one path creates the work order. The claim sits inside
-- the per-template exception block, so a failed insert rolls it back too.
create or replace function public.generate_recurring_work_orders()
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  row record;
  new_sr_id uuid;
  next_due date;
  n_generated integer := 0;
begin
  for row in
    select *
      from public.recurring_work_orders
     where auto_generate
       and archived_at is null
       and next_due_date <= current_date
       and (end_date is null or next_due_date <= end_date)
  loop
   begin
    next_due := public.recurring_next_date(row.next_due_date, row.frequency::text, coalesce(row.interval_count, 1), extract(day from coalesce(row.start_date, row.next_due_date))::integer);

    update public.recurring_work_orders
       set next_due_date = next_due,
           last_generated_at = now(),
           updated_at = now()
     where id = row.id
       and archived_at is null
       and next_due_date = row.next_due_date;
    if not found then
      continue;  -- already generated (manually or by an overlapping run)
    end if;

    insert into public.service_requests (
      portfolio_id, association_id, unit_id,
      description, priority, source, created_by
    ) values (
      row.portfolio_id, row.association_id, row.unit_id,
      row.description || E'\n(auto-generated from recurring work order)',
      coalesce(row.priority::text, 'normal')::public.service_request_priority,
      'recurring', row.created_by
    ) returning id into new_sr_id;

    insert into public.work_orders (
      service_request_id, portfolio_id, unit_id, association_id,
      title, description, category, priority, vendor_id,
      trade, created_by, scheduled_date, status
    ) values (
      new_sr_id, row.portfolio_id, row.unit_id, row.association_id,
      row.title, row.description, coalesce(row.category, 'other'::public.work_order_category), row.priority, row.vendor_id,
      row.trade, row.created_by, row.next_due_date,
      case when row.vendor_id is not null then 'assigned' else 'new' end::public.work_order_status
    );

    n_generated := n_generated + 1;
   exception when others then
    raise warning 'generate_recurring_work_orders: template % skipped: %', row.id, sqlerrm;
   end;
  end loop;

  return n_generated;
end;
$function$;
