-- Review follow-up: a new charge only takes the per-unit application lock
-- when the unit actually has unapplied credit to consume, so bulk charge
-- postings (assessment fan-out, recurring charges, bulk charges) don't
-- accumulate unit locks in arbitrary order and contend with lockbox/receipt
-- posting. If a deadlock still occurs in the rare credit case, Postgres
-- aborts one transaction cleanly and it can be retried.
do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.auto_apply_credit_on_new_charge()'::regprocedure) into v_def;
  v_old := '  perform pg_advisory_xact_lock(hashtextextended(''unit-apply:'' || new.unit_id::text, 0));';
  if position(v_old in v_def) = 0 then raise exception 'lock line not found'; end if;
  execute replace(v_def, v_old,
    '  if not exists (select 1 from public.v_unapplied_credits where unit_id = new.unit_id) then return new; end if;' || chr(10) || v_old);
end $$;
