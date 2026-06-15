-- Residents (owner portal) can cancel their OWN open service requests.
-- Previously service_requests had resident INSERT + SELECT but no UPDATE, so the
-- Cancel button (cancelServiceRequest) silently no-opped under RLS.
-- USING gates which rows are visible-for-update (own + still open);
-- WITH CHECK constrains the post-update row to status='cancelled' so residents
-- cannot flip a request to any other status.
drop policy if exists service_requests_resident_cancel on public.service_requests;
create policy service_requests_resident_cancel on public.service_requests
  for update
  using (
    is_portal_resident()
    and (homeowner_id = current_owner_id() or owner_id = current_owner_id())
    and status = 'open'
  )
  with check (
    is_portal_resident()
    and (homeowner_id = current_owner_id() or owner_id = current_owner_id())
    and status = 'cancelled'
  );
