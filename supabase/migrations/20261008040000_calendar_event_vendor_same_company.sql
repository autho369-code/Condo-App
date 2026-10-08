-- calendar_events.vendor_id takes the form's vendor id, and its foreign key
-- accepts any company's vendor. calendar_events_vendor_read shows an event to
-- the vendor it names, so another company's vendor could see it. Work orders
-- already refuse this (work_order_vendor_in_company, 20261005030001) and
-- maintenance_tasks do through RLS (maintenance_task_links_valid); this
-- applies the same rule to calendar events. The app now checks too
-- (checkLinkedRecords compares the vendor's and the association's company).
--
-- The company an event belongs to is its association's when it has one (a
-- platform operator's older events carry the operator's own portfolio_id), so
-- the check reads associations.portfolio_id and also fires when the
-- association changes; events with no association use portfolio_id.
-- Production had no mismatched rows when this was written (2 calendar events
-- with a vendor, both same-company).
-- Additive only: no DROP, no DELETE.

create or replace function public.calendar_event_vendor_in_company()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_company uuid;
begin
  if new.vendor_id is null then
    return new;
  end if;
  -- An update that keeps the vendor, association and company needs no check
  -- (and takes no locks).
  if tg_op = 'UPDATE'
     and new.vendor_id is not distinct from old.vendor_id
     and new.association_id is not distinct from old.association_id
     and new.portfolio_id is not distinct from old.portfolio_id then
    return new;
  end if;
  if new.association_id is not null then
    -- FOR SHARE: a concurrent move of the association waits for this check.
    select a.portfolio_id into v_company
      from public.associations a where a.id = new.association_id for share;
  else
    v_company := new.portfolio_id;
  end if;
  -- FOR SHARE on the vendor too, so it can't move company under this check.
  if v_company is null or not exists (
    select 1 from public.vendors v
     where v.id = new.vendor_id and v.portfolio_id = v_company
       for share
  ) then
    raise exception 'That vendor belongs to a different company' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.calendar_event_vendor_in_company() from public, anon, authenticated;

do $mig$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'calendar_events_vendor_company'
       and tgrelid = 'public.calendar_events'::regclass
  ) then
    create trigger calendar_events_vendor_company
      before insert or update of vendor_id, portfolio_id, association_id on public.calendar_events
      for each row execute function public.calendar_event_vendor_in_company();
  end if;
end
$mig$;
