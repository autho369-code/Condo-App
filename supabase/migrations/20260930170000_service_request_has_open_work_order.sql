-- Review fix: "Awaiting triage" vs "In work orders" was decided in memory over
-- the first 500 rows, so a large queue could hide older untriaged requests.
-- service_requests.has_open_work_order is kept in sync by a trigger on
-- work_orders and lets the queue filter in the database.
-- (A plain boolean, deliberately not a foreign key: a second FK path between
-- service_requests and work_orders would make existing embeds ambiguous.)
alter table public.service_requests
  add column if not exists has_open_work_order boolean not null default false;

-- The resident update guard resets every column but status for non-staff
-- callers; a vendor changing their work order's status must still be able to
-- refresh this flag (it is only ever written by the trigger below).
create or replace function public.service_request_guard_update()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_status public.service_request_status;
  v_open boolean;
  v_is_staff boolean := public.is_platform_operator() or public.is_any_staff() or public.is_company_admin();
begin
  if not v_is_staff and auth.uid() is not null then
    v_status := new.status;
    v_open := new.has_open_work_order;
    new := old;
    new.status := v_status;
    if pg_trigger_depth() > 1 then new.has_open_work_order := v_open; end if;
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
end $$;

create or replace function public.refresh_service_request_open_work_order(p_sr uuid)
returns void language sql volatile security definer set search_path = pg_catalog, public as $$
  update public.service_requests s
     set has_open_work_order = exists (
           select 1 from public.work_orders w
            where w.service_request_id = s.id and w.archived_at is null
              and w.status not in ('done', 'completed', 'billed', 'closed', 'cancelled'))
   where s.id = p_sr;
$$;
revoke all on function public.refresh_service_request_open_work_order(uuid) from public, anon, authenticated;

create or replace function public.work_order_sync_request_triage()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.service_request_id is not null then
    perform public.refresh_service_request_open_work_order(old.service_request_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.service_request_id is not null
     and (tg_op = 'INSERT' or new.service_request_id is distinct from old.service_request_id
          or new.status is distinct from old.status or new.archived_at is distinct from old.archived_at) then
    perform public.refresh_service_request_open_work_order(new.service_request_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_work_order_sync_request_triage on public.work_orders;
create trigger trg_work_order_sync_request_triage
  after insert or update of status, service_request_id, archived_at or delete on public.work_orders
  for each row execute function public.work_order_sync_request_triage();

update public.service_requests s
   set has_open_work_order = exists (
         select 1 from public.work_orders w
          where w.service_request_id = s.id and w.archived_at is null
            and w.status not in ('done', 'completed', 'billed', 'closed', 'cancelled'));

create index if not exists service_requests_open_triage_idx
  on public.service_requests (has_open_work_order, created_at desc)
  where archived_at is null and status in ('open', 'waiting');
