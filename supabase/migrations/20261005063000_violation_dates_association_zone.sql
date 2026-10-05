-- Violation dates in the association's own time zone. open_violation and
-- advance_violation used current_date (UTC on the database), so on a US
-- evening a violation's reported date, the fine charge's due date and the
-- next follow-up date were a day late, and "observed date cannot be in the
-- future" allowed tomorrow. Swap every current_date for
-- association_local_date(<association>), which defaults to now() in the
-- association's zone (America/Chicago when none is set).
--
-- Rewrites the live definitions in place (CREATE OR REPLACE keeps grants);
-- re-running is a no-op once no current_date remains.
do $$
begin
  execute replace(
    pg_get_functiondef('public.open_violation(uuid,uuid,uuid,text,text,date,public.violation_type)'::regprocedure),
    'current_date', 'public.association_local_date(p_association_id)');
  execute replace(
    pg_get_functiondef('public.advance_violation(uuid,text)'::regprocedure),
    'current_date', 'public.association_local_date(v.association_id)');
end $$;
