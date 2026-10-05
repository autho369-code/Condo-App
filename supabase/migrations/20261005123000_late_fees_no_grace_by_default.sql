-- Late fees apply as soon as the due date passes (owner directive): the
-- default grace period is 0 days, so a charge unpaid on its due date gets its
-- late fee on the next daily run. An association can still set its own grace
-- period on its profile.
alter table public.associations alter column late_fee_grace_days set default 0;
alter table public.portfolios alter column default_late_fee_grace_days set default 0;

-- Existing associations and companies still on the old 10-day default.
update public.associations set late_fee_grace_days = 0 where late_fee_grace_days = 10;
update public.portfolios set default_late_fee_grace_days = 0 where default_late_fee_grace_days = 10;

-- Functions that fell back to 10 days when no grace period is set.
do $$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('cron_assess_late_fees', 'assess_late_fee', 'apply_late_fees',
                                'charge_late_fees_now', 'receivables_task_associations')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(v_def, 'late_fee_grace_days, 10)', 'late_fee_grace_days, 0)');
    v_new := replace(v_new, 'p_association_id), 10)', 'p_association_id), 0)');
    -- Wrappers that delegate to assess_late_fee have no fallback of their own.
    if v_new <> v_def then
      execute v_new;
    end if;
  end loop;
end $$;
