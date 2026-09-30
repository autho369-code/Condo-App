-- Review fix: two work orders on the same request closing concurrently could
-- each recompute has_open_work_order before the other committed, both see the
-- other as still open, and leave the request flagged as triaged forever.
-- The recompute now takes a per-request transaction lock first; the flag is
-- then computed by a fresh statement that sees every committed change (READ
-- COMMITTED takes a new snapshot per statement), so the last writer is right.
create or replace function public.refresh_service_request_open_work_order(p_sr uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('sr-triage:' || p_sr::text, 0));
  update public.service_requests s
     set has_open_work_order = exists (
           select 1 from public.work_orders w
            where w.service_request_id = s.id and w.archived_at is null
              and w.status not in ('done', 'completed', 'billed', 'closed', 'cancelled'))
   where s.id = p_sr;
end $$;
revoke all on function public.refresh_service_request_open_work_order(uuid) from public, anon, authenticated;
