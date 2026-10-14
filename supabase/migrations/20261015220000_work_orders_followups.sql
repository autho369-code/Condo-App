-- Work orders follow-ups (Next gaps after #385).
-- A completed service request goes back to waiting whenever an open work
-- order shows up in it: moved in from another request, unarchived, reopened
-- from cancelled, added already open, or (as before) a finished one reopened
-- in place. Reopening clears resolved_at and resolved_by; staff's resolution
-- note is kept (nothing they wrote is lost; Decisions.md). A cancelled
-- request stays cancelled.
--
-- Recurring jobs the nightly generator assigns are emailed to their vendor
-- by /api/work-orders/notify-recurring. Every vendor assignment email
-- (lib/notifications/vendor-assignment.ts, service role) stamps
-- vendor_notified_at, so the cron skips jobs already emailed (a time window
-- alone re-sent yesterday's jobs). Vendors can't set it (vendor guard); a
-- staff edit can at most skip the email for its own company's vendor.
alter table public.work_orders add column if not exists vendor_notified_at timestamptz;

create index if not exists work_orders_recurring_unnotified_idx
  on public.work_orders (created_at)
  where vendor_notified_at is null and vendor_id is not null and archived_at is null;

create or replace function public.work_order_sync_request_triage()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  -- work_orders_fixes: open = not finished, cancelled or archived.
  v_old_open boolean := tg_op <> 'INSERT' and old.archived_at is null
    and old.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled');
  v_new_open boolean := tg_op <> 'DELETE' and new.archived_at is null
    and new.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled');
  v_sr uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.service_request_id is not null then
    perform public.refresh_service_request_open_work_order(old.service_request_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.service_request_id is not null
     and (tg_op = 'INSERT' or new.service_request_id is distinct from old.service_request_id
          or new.status is distinct from old.status or new.archived_at is distinct from old.archived_at) then
    perform public.refresh_service_request_open_work_order(new.service_request_id);
  end if;

  -- An open work order finished, was cancelled, archived, deleted or moved
  -- to another request (or one was added already finished): when no open
  -- work order is left and one is finished, the request is completed.
  if v_old_open and old.service_request_id is not null
     and (tg_op = 'DELETE' or not v_new_open or new.service_request_id is distinct from old.service_request_id) then
    v_sr := old.service_request_id;
  elsif tg_op = 'INSERT' and new.service_request_id is not null and new.archived_at is null
     and new.status::text in ('done', 'completed', 'billed', 'closed') then
    v_sr := new.service_request_id;
  end if;
  if v_sr is not null then
    update public.service_requests s
       set status = 'completed',
           resolved_at = coalesce(s.resolved_at, now())
     where s.id = v_sr
       and s.archived_at is null
       and s.status in ('open', 'waiting')
       and not exists (
         select 1 from public.work_orders w
          where w.service_request_id = s.id
            and w.archived_at is null
            and w.status::text not in ('done', 'completed', 'billed', 'closed', 'cancelled'))
       and exists (
         select 1 from public.work_orders w
          where w.service_request_id = s.id
            and w.archived_at is null
            and w.status::text in ('done', 'completed', 'billed', 'closed'));
  end if;

  -- work_orders_followups: an open work order newly in this request (added,
  -- moved in, unarchived, or reopened from finished or cancelled): its
  -- completed request is waiting again (a cancelled request stays cancelled).
  if v_new_open and new.service_request_id is not null
     and (tg_op = 'INSERT' or not v_old_open
          or new.service_request_id is distinct from old.service_request_id) then
    update public.service_requests s
       set status = 'waiting',
           resolved_at = null,
           resolved_by = null
     where s.id = new.service_request_id
       and s.archived_at is null
       and s.status = 'completed';
  end if;
  return null;
end $function$;

revoke all on function public.work_order_sync_request_triage() from public, anon, authenticated;

-- A vendor's or owner's status change reaches the request through the
-- trigger above (depth > 1): keep the trigger's resolved_by too, not only
-- has_open_work_order and resolved_at.
create or replace function public.service_request_guard_update()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_status public.service_request_status;
  v_open boolean;
  v_resolved timestamptz; -- work_orders_fixes
  v_resolved_by uuid; -- work_orders_followups
  v_is_staff boolean := public.is_platform_operator() or public.is_any_staff() or public.is_company_admin();
begin
  if not v_is_staff and auth.uid() is not null then
    v_status := new.status;
    v_open := new.has_open_work_order;
    v_resolved := new.resolved_at;
    v_resolved_by := new.resolved_by;
    new := old;
    new.status := v_status;
    if pg_trigger_depth() > 1 then
      new.has_open_work_order := v_open;
      new.resolved_at := v_resolved;
      new.resolved_by := v_resolved_by;
    end if;
    new.updated_at := now();
    return new;
  end if;
  if old.acknowledged_at is null and new.acknowledged_at is null
     and (new.status is distinct from old.status or new.resolution_note is distinct from old.resolution_note)
     and auth.uid() is not null then
    new.acknowledged_at := now();
    new.acknowledged_by := auth.uid();
  end if;
  if new.acknowledged_at is null and new.priority is distinct from old.priority then
    new.first_response_due_at := old.created_at + public.service_request_response_window(new.priority);
  end if;
  return new;
end $function$;

revoke all on function public.service_request_guard_update() from public, anon, authenticated;
