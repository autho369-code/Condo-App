-- The hearing-request window before a fine was counted in UTC days
-- (notice_sent_at::date vs current_date): a notice sent Oct 1 at 8 PM Central
-- counted as Oct 2, and after 7 PM Central "today" was already tomorrow, so a
-- fine could be posted on the owner's last day to ask for a hearing. Both
-- dates now use the association's time zone, and fining is allowed only
-- after the deadline day.
create or replace function public.association_local_date(p_association_id uuid, p_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select (p_at at time zone coalesce(
    (select nullif(a.timezone, '') from public.associations a where a.id = p_association_id),
    'America/Chicago'))::date;
$$;
revoke all on function public.association_local_date(uuid, timestamptz) from public, anon;
grant execute on function public.association_local_date(uuid, timestamptz) to authenticated, service_role;

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.advance_violation(uuid,text)'::regprocedure) into v_def;
  v_new := replace(v_def,
    'if v.notice_sent_at::date + v_hearing_days > current_date then',
    'if public.association_local_date(v.association_id, v.notice_sent_at) + v_hearing_days >= public.association_local_date(v.association_id) then');
  v_new := replace(v_new,
    'to_char(v.notice_sent_at::date + v_hearing_days, ''Mon DD, YYYY'')',
    'to_char(public.association_local_date(v.association_id, v.notice_sent_at) + v_hearing_days, ''Mon DD, YYYY'')');
  if (length(v_new) - length(replace(v_new, 'association_local_date(v.association_id, v.notice_sent_at)', '')))
     / length('association_local_date(v.association_id, v.notice_sent_at)') <> 2 then
    raise exception 'advance_violation did not match the expected due-process check';
  end if;
  execute v_new;
end $$;
