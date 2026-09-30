-- TEMPORARY compatibility shims. #76 was merged before its final commit, so
-- the deployed app still calls post_message(thread, body, internal) and
-- mark_message_thread_read(thread) while the database only had the newer
-- p_as versions — replies and read-marking failed. These shims restore the
-- original behaviour (staff if the caller can manage the thread, otherwise
-- resident — unambiguous today because one login holds one role) until the
-- app code that passes p_as is deployed; drop them afterwards.
create or replace function public.post_message(p_thread uuid, p_body text, p_internal boolean)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare t public.message_threads;
begin
  select * into t from public.message_threads where id = p_thread;
  if found and public.is_messaging_staff() and public.can_access_portfolio(t.portfolio_id)
     and public.can_manage_association(t.association_id) then
    return public.post_message(p_thread, p_body, p_internal, 'staff');
  end if;
  return public.post_message(p_thread, p_body, p_internal, 'resident');
end $$;

create or replace function public.mark_message_thread_read(p_thread uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare t public.message_threads;
begin
  select * into t from public.message_threads where id = p_thread;
  if found and public.is_messaging_staff() and public.can_access_portfolio(t.portfolio_id)
     and public.can_manage_association(t.association_id) then
    perform public.mark_message_thread_read(p_thread, 'staff');
  else
    perform public.mark_message_thread_read(p_thread, 'resident');
  end if;
end $$;

revoke all on function public.post_message(uuid, text, boolean) from public, anon;
revoke all on function public.mark_message_thread_read(uuid) from public, anon;
grant execute on function public.post_message(uuid, text, boolean) to authenticated;
grant execute on function public.mark_message_thread_read(uuid) to authenticated;
