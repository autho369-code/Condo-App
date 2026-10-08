-- Completing a maintenance task wrote four rows from the app in separate
-- requests: the task (last completion, next due date or closed), a history
-- entry, the calendar event closed, and the next occurrence's calendar event.
-- A failure part way left the occurrence claimed but without its history or
-- calendar, and a retry was refused (or completed the next occurrence).
-- complete_maintenance_task does all four in one transaction.
--
-- The claim is a compare-and-set on what the page showed: p_seen_completed_at
-- (the last completion the page displayed) and, for a recurring task,
-- p_seen_due (its due date), so a double click, another person or a stale page
-- completes the occurrence once. Removed (archived) tasks can't be completed.
--
-- SECURITY INVOKER: every write runs under the caller's RLS (the restrictive
-- mgr_assoc_scope policies on maintenance_tasks and calendar_events, the
-- maintenance_task_history policy), exactly as the app's own writes did. The
-- app computes the next due date and the event's start/end in the
-- association's time zone and passes them in.
-- Additive only: no DROP, no DELETE. The emoji is written as chr(128295).

create or replace function public.complete_maintenance_task(
  p_task_id uuid,
  p_seen_completed_at timestamptz,
  p_seen_due date,
  p_next_due date,
  p_notes text,
  p_event_type text,
  p_next_start timestamptz,
  p_next_end timestamptz
)
returns void
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t public.maintenance_tasks;
  v_now timestamptz := now();
  v_portfolio uuid;
begin
  if p_next_due is not null and p_seen_due is null then
    raise exception 'A recurring task needs the due date that was shown' using errcode = '22023';
  end if;

  update public.maintenance_tasks
     set last_completed_at = v_now,
         next_due_date = coalesce(p_next_due, next_due_date),
         status = case when p_next_due is not null then 'active' else 'completed' end
   where id = p_task_id
     and archived_at is null
     and last_completed_at is not distinct from p_seen_completed_at
     and (
       (p_next_due is not null and next_due_date = p_seen_due)
       or (p_next_due is null and status is distinct from 'completed')
     )
  returning * into t;
  if not found then
    raise exception 'The task was already completed since this page loaded, or you cannot edit it' using errcode = 'P0002';
  end if;

  insert into public.maintenance_task_history (task_id, completed_at, completed_by, notes, vendor_id, next_due_date)
  values (p_task_id, v_now, auth.uid(), p_notes, t.vendor_id, p_next_due);

  update public.calendar_events
     set operations_status = 'completed'
   where maintenance_task_id = p_task_id
     and archived_at is null
     and operations_status = 'scheduled';

  if p_next_due is not null then
    select a.portfolio_id into v_portfolio from public.associations a where a.id = t.association_id;
    insert into public.calendar_events (
      portfolio_id, association_id, vendor_id, maintenance_task_id, title, event_type,
      calendar_scope, start_datetime, end_datetime, location, description, internal_notes,
      operations_status, notification_recipients, reminder_rules, created_by
    ) values (
      coalesce(v_portfolio, public.current_portfolio_id()), t.association_id, t.vendor_id, p_task_id,
      chr(128295) || ' ' || t.task_name,
      coalesce(nullif(p_event_type, ''), 'custom_event')::public.event_type,
      'daily'::public.calendar_scope, p_next_start, p_next_end, null, null,
      left(nullif(btrim(coalesce(p_notes, '')), ''), 200),
      'scheduled', '["management_office"]'::jsonb,
      '[{"minutes_before": 10080, "actions": ["notify_management_office"]}]'::jsonb,
      auth.uid()
    );
  end if;
end;
$function$;

revoke all on function public.complete_maintenance_task(uuid, timestamptz, date, date, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.complete_maintenance_task(uuid, timestamptz, date, date, text, text, timestamptz, timestamptz) to authenticated, service_role;
