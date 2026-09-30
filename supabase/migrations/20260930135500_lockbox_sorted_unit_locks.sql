-- Review fix: post_lockbox_batch takes all of the batch's per-unit locks up
-- front in sorted order, so two batches touching the same units in different
-- row orders cannot deadlock.
do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.post_lockbox_batch(uuid)'::regprocedure) into v_def;
  v_old := '  for i in select * from public.lockbox_items';
  if position(v_old in v_def) = 0 then raise exception 'post_lockbox_batch loop not found'; end if;
  execute replace(v_def, v_old,
    '  perform pg_advisory_xact_lock(hashtextextended(''unit-apply:'' || u.unit_id::text, 0))' || chr(10) ||
    '     from (select distinct unit_id from public.lockbox_items' || chr(10) ||
    '            where batch_id = p_batch and not rejected and payment_id is null and unit_id is not null' || chr(10) ||
    '            order by unit_id) u;' || chr(10) || v_old);
end $$;
