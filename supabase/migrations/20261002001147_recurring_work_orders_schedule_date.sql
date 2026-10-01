-- Recurring work orders generated nightly had no scheduled_date, so they
-- never appeared under Scheduled or Overdue, and stayed 'new' even when the
-- plan names a vendor. Schedule each one for its due date and mark it
-- assigned when a vendor is set (same as "Generate now" in the app).
-- A template with no category (nullable on recurring_work_orders, required on
-- work_orders) aborted the whole nightly run; default it to 'other', and run
-- each template in its own block so one bad template cannot stop the rest.
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
    -- Create parent service_request
    insert into public.service_requests (
      portfolio_id, association_id, unit_id,
      description, priority, source, created_by
    ) values (
      row.portfolio_id, row.association_id, row.unit_id,
      row.description || E'\n(auto-generated from recurring work order)',
      coalesce(row.priority::text, 'normal')::public.service_request_priority,
      'recurring', row.created_by
    ) returning id into new_sr_id;

    -- Create the work order
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

    -- Advance next_due_date based on frequency + interval_count
    next_due := case row.frequency
      when 'daily'     then row.next_due_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_due_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_due_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_due_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_due_date + (row.interval_count || ' years')::interval
    end::date;

    update public.recurring_work_orders
       set next_due_date = next_due,
           last_generated_at = now(),
           updated_at = now()
     where id = row.id;

    n_generated := n_generated + 1;
   exception when others then
    raise warning 'generate_recurring_work_orders: template % skipped: %', row.id, sqlerrm;
   end;
  end loop;

  return n_generated;
end;
$function$;
