-- Review fixes (after #78):
-- 1. Internal notes: readable only by staff who can access the THREAD'S
--    association (not by anyone holding a staff role — a scoped manager who is
--    also the resident on a thread elsewhere must not see its internal notes).
-- 2. Notification fallbacks (resident messages and emergency service
--    requests) no longer email managers who are scoped to OTHER associations:
--    the company-wide fallback now only includes unscoped managers.

drop policy if exists message_thread_messages_read on public.message_thread_messages;
create policy message_thread_messages_read on public.message_thread_messages for select to authenticated
  using (exists (
    select 1 from public.message_threads t
     where t.id = message_thread_messages.thread_id
       and (not message_thread_messages.internal
            or (public.is_messaging_staff()
                and public.can_access_portfolio(t.portfolio_id)
                and public.can_view_association_row(t.association_id)))));

do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.message_notify()'::regprocedure) into v_def;
  v_old := E'           where not v_assignee_ok and pr.portfolio_id = t.portfolio_id and pr.hoa_role = ''manager'' and pr.disabled_at is null\n';
  if position(v_old in v_def) = 0 then raise exception 'message_notify fallback anchor not found'; end if;
  v_new := v_old || E'             and not exists (select 1 from public.association_managers own where own.user_id = pr.id)\n';
  execute replace(v_def, v_old, v_new);

  select pg_get_functiondef('public.service_request_emergency_alert()'::regprocedure) into v_def;
  v_old := E'         where pr.portfolio_id = new.portfolio_id and pr.hoa_role = ''manager'' and pr.disabled_at is null\n';
  if position(v_old in v_def) = 0 then raise exception 'emergency alert fallback anchor not found'; end if;
  v_new := v_old || E'           and not exists (select 1 from public.association_managers own where own.user_id = pr.id)\n';
  execute replace(v_def, v_old, v_new);
end $$;
