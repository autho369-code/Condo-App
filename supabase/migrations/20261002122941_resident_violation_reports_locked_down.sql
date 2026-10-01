-- Residents report concerns by inserting a violation row, but the policy only
-- checked association, resident and status 'open'. Through the API a resident
-- could file a "violation" against a neighbour (unit_id/owner_id), which then
-- showed in that neighbour's portal, or pre-set board_decision/fines/hearing
-- fields that later skip the hearing-before-fine gate. A report is now only
-- an unassigned, unfined, open concern created by the reporter.
alter policy violations_portal_resident_report on public.violations
  with check (
    public.is_portal_resident()
    and association_id in (select public.current_resident_association_ids())
    and status = 'open'::public.violation_status
    and created_by = auth.uid()
    and owner_id is null
    and unit_id is null
    and board_decision is null
    and hearing_requested_at is null
    and hearing_at is null
    and hearing_date is null
    and notice_sent_at is null
    and cured_at is null
    and closed_at is null
    and fine_amount is null
    and coalesce(fines_total, 0) = 0
    and coalesce(current_step, 0) = 0
  );
