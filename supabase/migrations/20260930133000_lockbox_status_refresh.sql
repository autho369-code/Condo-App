-- Review fix: rejecting the last open check (or re-opening one by matching it)
-- now recalculates the batch status, so a batch whose checks are all posted
-- or rejected stops showing as needing review.
create or replace function public.refresh_lockbox_batch_status(p_batch uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_open int; v_posted int;
begin
  select count(*) filter (where not rejected and payment_id is null), count(*) filter (where payment_id is not null)
    into v_open, v_posted from public.lockbox_items where batch_id = p_batch;
  update public.lockbox_batches
     set status = case
                    when v_open > 0 and v_posted > 0 then 'processing'::public.lockbox_batch_status
                    when v_open > 0 then 'received'::public.lockbox_batch_status
                    when v_posted > 0 then 'deposited'::public.lockbox_batch_status
                    else 'rejected'::public.lockbox_batch_status end,
         deposited_at = case when v_open = 0 and v_posted > 0 then coalesce(deposited_at, now()) else deposited_at end,
         updated_at = now()
   where id = p_batch;
end $$;
revoke all on function public.refresh_lockbox_batch_status(uuid) from public, anon, authenticated;

create or replace function public.reject_lockbox_item(p_item uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare s record;
begin
  select * into s from public.lockbox_item_scope(p_item);
  update public.lockbox_items set rejected = true, rejection_reason = coalesce(nullif(btrim(p_reason), ''), 'Rejected by staff')
   where id = p_item;
  perform public.refresh_lockbox_batch_status(s.batch_id);
end $$;

do $$
declare v_def text;
begin
  select pg_get_functiondef('public.match_lockbox_item(uuid, uuid)'::regprocedure) into v_def;
  if position('   where id = p_item;' || chr(10) || 'end $function$' in v_def) = 0 then raise exception 'match_lockbox_item tail not found'; end if;
  execute replace(v_def, '   where id = p_item;' || chr(10) || 'end $function$',
                  '   where id = p_item;' || chr(10) || '  perform public.refresh_lockbox_batch_status(s.batch_id);' || chr(10) || 'end $function$');
end $$;
