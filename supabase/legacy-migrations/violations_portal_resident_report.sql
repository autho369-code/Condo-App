-- Let owners (portal residents) file a violation report that lands directly in
-- the manager's violations workflow. INSERT-only, constrained to their own
-- association and to status 'open' (needs manager review); owners cannot set
-- fines or statuses. Applied to remote DB on 2026-06-14.
create policy violations_portal_resident_report
  on public.violations
  for insert
  to authenticated
  with check (
    is_portal_resident()
    and association_id in (select current_resident_association_ids())
    and status = 'open'::violation_status
  );
