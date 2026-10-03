-- Report runs are removed only by the service role; clients can't erase run
-- history (20261003220000 already took away insert/update).
revoke delete on public.report_runs from authenticated, anon;
