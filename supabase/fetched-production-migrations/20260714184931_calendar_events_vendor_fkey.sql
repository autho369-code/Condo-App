-- calendar_events.vendor_id had NO foreign key to vendors, so PostgREST could
-- not resolve the vendors(name) embed — every calendar_events query using it
-- (board calendar since June, the shared association feed) errored silently
-- and returned zero events. Verified 0 orphaned vendor_ids before adding.
alter table public.calendar_events
  add constraint calendar_events_vendor_id_fkey
  foreign key (vendor_id) references public.vendors(id) on delete set null;

-- make PostgREST pick up the new relationship immediately
notify pgrst, 'reload schema';;
