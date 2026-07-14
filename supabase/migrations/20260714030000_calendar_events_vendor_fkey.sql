-- calendar_events.vendor_id had NO foreign key to vendors, so PostgREST could
-- not resolve the vendors(name) embed — every calendar_events query using it
-- (the board calendar since June, then the shared association feed) errored
-- silently and returned zero events. This is why calendars showed meetings but
-- no community events/vendor visits. Verified 0 orphaned vendor_ids first.
-- Applied via MCP 2026-07-14.
alter table public.calendar_events
  add constraint calendar_events_vendor_id_fkey
  foreign key (vendor_id) references public.vendors(id) on delete set null;

notify pgrst, 'reload schema';
