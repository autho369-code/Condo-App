-- Revert 20260930135800: checking for credit before taking the unit lock can
-- miss a concurrently committing payment and leave an open charge next to
-- unused credit. Correct application wins: a new charge always takes the
-- per-unit lock before looking for credit. The remaining risk is a rare
-- deadlock between a multi-unit charge posting and a lockbox/receipt post;
-- Postgres detects it and aborts one transaction cleanly (no partial data),
-- and the aborted action can simply be retried.
do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.auto_apply_credit_on_new_charge()'::regprocedure) into v_def;
  v_old := '  if not exists (select 1 from public.v_unapplied_credits where unit_id = new.unit_id) then return new; end if;' || chr(10);
  if position(v_old in v_def) = 0 then raise exception 'pre-check not found'; end if;
  execute replace(v_def, v_old, '');
end $$;
