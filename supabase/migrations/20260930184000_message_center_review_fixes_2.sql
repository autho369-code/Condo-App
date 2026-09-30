-- Review fixes for the message center (round 2):
-- 1. The reply deadline only restarts when the resident writes after a staff
--    reply. Follow-ups on a still-unanswered thread keep the original due time
--    (they used to push it back 48 hours each time).
-- 2. A thread can only be assigned to someone who can actually open it:
--    association-scoped managers only for their own associations (same rule
--    as can_view_association_row). message_thread_assignees() lists exactly
--    those people for the picker.
do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.post_message(uuid, text, boolean)'::regprocedure) into v_def;
  v_old := 'first_response_due_at = case when acknowledged_at is null or last_message_role = ''staff''';
  if position(v_old in v_def) = 0 then raise exception 'post_message deadline anchor not found'; end if;
  execute replace(v_def, v_old,
    'first_response_due_at = case when last_message_role is distinct from ''resident'' or first_response_due_at is null');
end $$;

create or replace function public.can_be_assigned_message_thread(p_user uuid, p_portfolio uuid, p_association uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user and p.portfolio_id = p_portfolio and p.disabled_at is null
       and p.hoa_role in ('manager', 'company_admin')
       and (not exists (select 1 from public.association_managers am where am.user_id = p.id)
            or exists (select 1 from public.association_managers am where am.user_id = p.id and am.association_id = p_association)));
$$;
revoke all on function public.can_be_assigned_message_thread(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.assign_message_thread(p_thread uuid, p_user uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare a record;
begin
  select * into a from public.message_thread_access(p_thread);
  if a.role <> 'staff' then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_user is not null and not public.can_be_assigned_message_thread(p_user, (a.thread).portfolio_id, (a.thread).association_id) then
    raise exception 'That person can''t see this association''s conversations' using errcode = '22023';
  end if;
  update public.message_threads set assigned_to = p_user where id = p_thread;
end $$;

create or replace function public.message_thread_assignees(p_thread uuid)
returns table (id uuid, name text) language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare t public.message_threads;
begin
  select * into t from public.message_threads where message_threads.id = p_thread;
  if not found or not public.is_messaging_staff() or not public.can_access_portfolio(t.portfolio_id)
     or not public.can_manage_association(t.association_id) then
    return;
  end if;
  return query
    select p.id, coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email)
      from public.profiles p
     where public.can_be_assigned_message_thread(p.id, t.portfolio_id, t.association_id)
     order by 2;
end $$;
revoke all on function public.message_thread_assignees(uuid) from public, anon;
grant execute on function public.message_thread_assignees(uuid) to authenticated;
