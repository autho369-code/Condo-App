-- Codex on #353: the owner violation page needs the hearing request deadline
-- and today's date in the association's time zone.
--
-- request_owner_violation_hearing (20261014080000) refuses requests after
-- hearing_request_days from the first notice, but the page still showed the
-- request form, so owners filled in a form that could only fail. Owners
-- can't read association_violation_settings, and a date-only hearing day
-- must be compared with the association's calendar day, not UTC midnight.
-- This returns both for one of the caller's own violations (nothing for any
-- other violation); deadline is null before a notice was sent.

create or replace function public.owner_violation_hearing_window(p_violation_id uuid)
returns table(deadline date, today date)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v public.violations%rowtype;
  v_days integer;
begin
  if auth.uid() is null then
    return;
  end if;
  select * into v
    from public.violations x
   where x.id = p_violation_id
     and x.owner_id in (select public.current_owner_ids())
     and x.archived_at is null;
  if not found then
    return;
  end if;
  select coalesce(s.hearing_request_days, 14) into v_days
    from (select 1) one left join public.association_violation_settings s on s.association_id = v.association_id;
  today := public.association_local_date(v.association_id, now());
  deadline := case when v.notice_sent_at is null then null
                   else public.association_local_date(v.association_id, v.notice_sent_at) + coalesce(v_days, 14) end;
  return next;
end
$function$;

revoke all on function public.owner_violation_hearing_window(uuid) from public, anon;
grant execute on function public.owner_violation_hearing_window(uuid) to authenticated;
