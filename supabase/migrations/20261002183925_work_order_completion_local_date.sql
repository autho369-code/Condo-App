-- work_order_stamp_completion stamped completed_date with current_date (UTC):
-- a job finished in a Central evening was dated the next day. Use the
-- association's local date.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.work_order_stamp_completion()'::regprocedure) into v_def;
  v_new := replace(v_def, 'current_date', 'public.association_local_date(new.association_id)');
  if (length(v_new) - length(replace(v_new, 'association_local_date(new.association_id)', '')))
     / length('association_local_date(new.association_id)') <> 2 then
    raise exception 'work_order_stamp_completion did not match the expected definition';
  end if;
  execute v_new;
end $$;
