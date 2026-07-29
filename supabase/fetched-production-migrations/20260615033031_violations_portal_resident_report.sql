-- Allow portal residents (owners) to file a violation REPORT for their own
-- association only, constrained to the neutral 'open' status (no "reported/pending"
-- value exists in violation_status enum). Managers/board SELECT policies are
-- untouched, so these rows surface in the manager workflow via can_view_association_row.
create policy violations_portal_resident_report
  on public.violations
  for insert
  to authenticated
  with check (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
    and status = 'open'::violation_status
  );;
