-- Follow-up to 20261005124000: an active dues schedule whose end_date has
-- passed posts nothing, so it must not count as the unit's existing dues
-- schedule. Only a schedule still running on the new start date does.
create or replace function public.schedule_owner_dues(p_occupancy_id uuid, p_start date default current_date)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_occ record;
  v_cat uuid;
  v_candidates integer;
  v_existing uuid;
  v_first date;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select o.id, o.unit_id, o.dues_amount, o.dues_frequency, o.occupancy_type, o.status,
         b.association_id, a.portfolio_id
    into v_occ
    from public.occupancies o
    join public.units u on u.id = o.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where o.id = p_occupancy_id;
  if not found then
    raise exception 'Occupancy not found' using errcode = 'P0002';
  end if;

  if not (public.is_platform_operator()
          or (public.is_any_staff() and public.can_manage_association(v_occ.association_id))) then
    raise exception 'Not authorized for this association' using errcode = '42501';
  end if;

  if v_occ.occupancy_type <> 'owner' or v_occ.status = 'past' or coalesce(v_occ.dues_amount, 0) <= 0 then
    return null;
  end if;

  select cc.id into v_cat
    from public.charge_categories cc
   where cc.portfolio_id = v_occ.portfolio_id and cc.active and cc.charge_type = 'assessment'
     and (cc.association_id = v_occ.association_id or cc.association_id is null)
     and upper(coalesce(cc.code, '')) = 'DUES'
   order by (cc.association_id is not null) desc, cc.created_at, cc.id
   limit 1;
  if v_cat is null then
    select count(*), min(cc.id::text)::uuid into v_candidates, v_cat
      from public.charge_categories cc
     where cc.portfolio_id = v_occ.portfolio_id and cc.active and cc.charge_type = 'assessment'
       and (cc.association_id = v_occ.association_id or cc.association_id is null);
    if v_candidates = 0 then
      raise exception 'No active assessment charge category exists, so monthly dues were not scheduled' using errcode = '23514';
    elsif v_candidates > 1 then
      raise exception 'Several assessment charge categories exist and none has code DUES, so monthly dues were not scheduled' using errcode = '23514';
    end if;
  end if;

  -- Dues post on the 1st: first of the month on or after the start date.
  v_first := greatest(coalesce(p_start, current_date), current_date);
  if extract(day from v_first) <> 1 then
    v_first := (date_trunc('month', v_first) + interval '1 month')::date;
  end if;

  -- Already billed by a dues schedule on this unit that is still running on
  -- the start date (an active row whose end_date has passed posts nothing).
  select urc.id into v_existing
    from public.unit_recurring_charges urc
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = v_cat
     and (urc.end_date is null or urc.end_date >= v_first)
   limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.unit_recurring_charges
    (unit_id, charge_category_id, amount, frequency, start_date, next_post_date, created_by)
  values
    (v_occ.unit_id, v_cat, round(v_occ.dues_amount, 2),
     coalesce(v_occ.dues_frequency, 'monthly'::public.recurring_frequency),
     v_first, v_first, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.schedule_owner_dues(uuid, date) from public, anon;
grant execute on function public.schedule_owner_dues(uuid, date) to authenticated;
