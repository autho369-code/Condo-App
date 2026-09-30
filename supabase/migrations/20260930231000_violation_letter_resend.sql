-- #84 review fix: if a step letter fails after advance_violation has recorded
-- the step, staff need a way to send it without advancing again. This returns
-- the letter settings of the violation's CURRENT step (same shape as
-- advance_violation's result) so the app can (re)send that step's letter.
create or replace function public.violation_current_step_letter(p_violation_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v public.violations;
  s record;
begin
  select * into v from public.violations where id = p_violation_id;
  if v.id is null or not public.can_manage_violations(v.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if coalesce(v.current_step, 0) < 1 then
    raise exception 'No follow-up step has been recorded yet' using errcode = '22023';
  end if;
  select * into s from public.violation_schedule(v.association_id, v.house_rule_id) where ordinal = v.current_step;
  if not found then
    raise exception 'The current step is no longer in the follow-up schedule' using errcode = '22023';
  end if;
  return jsonb_build_object('step', s.ordinal, 'step_name', s.follow_up_name, 'fee', s.fee,
    'letter_template_id', s.letter_template_id, 'delivery_methods', s.delivery_methods, 'offers_hearing', s.offers_hearing);
end $$;
revoke all on function public.violation_current_step_letter(uuid) from public, anon;
grant execute on function public.violation_current_step_letter(uuid) to authenticated;
