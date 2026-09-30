-- Review fix: the 12-files-per-record limit was checked in application code
-- before inserting, so two concurrent uploads could both pass and leave 13.
-- Enforce it in the database under a per-record transaction lock.
create or replace function public.maintenance_attachments_enforce_limit()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_count int;
begin
  if new.work_order_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('maint-files:' || new.work_order_id::text, 0));
    select count(*) into v_count from public.maintenance_attachments where work_order_id = new.work_order_id;
  else
    perform pg_advisory_xact_lock(hashtextextended('maint-files:' || new.service_request_id::text, 0));
    select count(*) into v_count from public.maintenance_attachments
     where service_request_id = new.service_request_id and work_order_id is null;
  end if;
  if coalesce(v_count, 0) >= 12 then
    raise exception 'Limit of 12 files reached' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_maintenance_attachments_limit on public.maintenance_attachments;
create trigger trg_maintenance_attachments_limit before insert on public.maintenance_attachments
  for each row execute function public.maintenance_attachments_enforce_limit();
