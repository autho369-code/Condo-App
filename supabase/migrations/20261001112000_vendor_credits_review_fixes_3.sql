-- Vendor credits review fixes 3: everything that reports what is still owed on a bill,
-- or what was paid in cash, uses amount - credit_applied.
--   * year_end_readiness: 1099 $600 missing-TIN check uses net cash paid
--   * get_meeting_financial_snapshot: open payables net of applied credits
--   * report_data_ap_transaction_summary: total_unpaid net of applied credits

create or replace function pg_temp.patch(p_fn regprocedure, p_pattern text, p_replacement text, p_expected integer)
returns void
language plpgsql
as $$
declare
  v_def text := pg_get_functiondef(p_fn);
  v_hits integer := (select count(*) from regexp_matches(v_def, p_pattern, 'g'));
begin
  if v_hits <> p_expected then
    raise exception 'vendor_credits_review_fixes_3: % drifted (% matches of %, expected %)', p_fn, v_hits, p_pattern, p_expected;
  end if;
  execute regexp_replace(v_def, p_pattern, p_replacement, 'g');
end $$;

select pg_temp.patch('public.year_end_readiness(uuid, integer)',
  'having sum\(b\.amount\) >= 600', 'having sum(b.amount - b.credit_applied) >= 600', 1);

select pg_temp.patch('public.get_meeting_financial_snapshot(uuid)',
  'coalesce\(sum\(pb\.amount\), 0\)(\s+into v_total_payables)', 'coalesce(sum(pb.amount - pb.credit_applied), 0)\1', 1);

select pg_temp.patch('public.report_data_ap_transaction_summary(uuid, jsonb)',
  'sum\(b\.amount\) filter \(where b\.status::text in \(''draft'',''pending_approval'',''approved''\)\) as total_unpaid',
  'sum(b.amount - b.credit_applied) filter (where b.status::text in (''draft'',''pending_approval'',''approved'')) as total_unpaid', 1);
