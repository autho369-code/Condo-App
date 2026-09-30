-- Review fix (pre-existing race, surfaced by lockbox): two payments for the
-- same unit inserted concurrently (two lockbox batches, a portal payment and
-- an office receipt, …) each computed charge balances without a lock and
-- could both apply the full balance, overpaying a charge instead of leaving
-- the second as unapplied credit. Every path that applies money to a unit's
-- charges now takes the same per-unit transaction lock first.
-- Also: post_lockbox_batch derives its final status from what actually
-- posted (a batch where every post failed stays "received").
do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.apply_payment(uuid, text, uuid[])'::regprocedure) into v_def;
  v_old := 'if not found then raise exception ''payment % not found'', p_payment_id; end if;';
  if position(v_old in v_def) = 0 then raise exception 'apply_payment anchor not found'; end if;
  execute replace(v_def, v_old, v_old || chr(10) || '  perform pg_advisory_xact_lock(hashtextextended(''unit-apply:'' || pay.unit_id::text, 0));');

  select pg_get_functiondef('public.auto_apply_credit_on_new_charge()'::regprocedure) into v_def;
  v_old := '  remaining_charge := new.amount;';
  if position(v_old in v_def) = 0 then raise exception 'auto_apply_credit anchor not found'; end if;
  execute replace(v_def, v_old, '  perform pg_advisory_xact_lock(hashtextextended(''unit-apply:'' || new.unit_id::text, 0));' || chr(10) || v_old);

  select pg_get_functiondef('public.auto_apply_new_payment()'::regprocedure) into v_def;
  v_old := '  if new.charge_id is not null then';
  if position(v_old in v_def) = 0 then raise exception 'auto_apply_new_payment anchor not found'; end if;
  execute replace(v_def, v_old, '  perform pg_advisory_xact_lock(hashtextextended(''unit-apply:'' || new.unit_id::text, 0));' || chr(10) || v_old);

  select pg_get_functiondef('public.post_lockbox_batch(uuid)'::regprocedure) into v_def;
  v_old := '  update public.lockbox_batches' || chr(10)
        || '     set status = case when v_open = 0 then ''deposited''::public.lockbox_batch_status else ''processing''::public.lockbox_batch_status end,' || chr(10)
        || '         deposited_at = case when v_open = 0 then coalesce(deposited_at, now()) else deposited_at end,' || chr(10)
        || '         updated_at = now()' || chr(10)
        || '   where id = p_batch;';
  if position(v_old in v_def) = 0 then raise exception 'post_lockbox_batch status block not found'; end if;
  execute replace(v_def, v_old, '  perform public.refresh_lockbox_batch_status(p_batch);');
end $$;
