-- Follow-up to 20261005130000: an existing dues schedule on the unit is
-- reused only when its amount and frequency match the occupancy. Otherwise
-- (e.g. a new owner with different dues after a sale) the old schedule is
-- ended before its next unposted period and a new one starts there.
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
  v_cur record;
  v_first date;
  v_id uuid;
  v_end date;
  v_cats uuid[];
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

  -- Every category that bills this association's dues: all active DUES
  -- categories in scope (association-specific and company-wide), or the single
  -- fallback assessment category.
  select coalesce(array_agg(cc.id), array[v_cat]) into v_cats
    from public.charge_categories cc
   where cc.portfolio_id = v_occ.portfolio_id and cc.active and cc.charge_type = 'assessment'
     and (cc.association_id = v_occ.association_id or cc.association_id is null)
     and upper(coalesce(cc.code, '')) = 'DUES';
  if not (v_cat = any(v_cats)) then
    v_cats := v_cats || v_cat;
  end if;

  -- Serialize concurrent calls for the same unit (check-then-insert).
  perform 1 from public.units where id = v_occ.unit_id for update;

  -- Dues post on the 1st: first of the month on or after the start date.
  v_first := greatest(coalesce(p_start, current_date), current_date);
  if extract(day from v_first) <> 1 then
    v_first := (date_trunc('month', v_first) + interval '1 month')::date;
  end if;

  -- A dues schedule on this unit that started on or before the first due date
  -- and has not ended before it (its next_post_date may already be past the
  -- first due date if that month was posted).
  select urc.id, urc.amount, urc.frequency, urc.next_post_date, coalesce(urc.start_date, urc.next_post_date) as starts into v_cur
    from public.unit_recurring_charges urc
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and coalesce(urc.start_date, urc.next_post_date) <= v_first
     and (urc.end_date is null or urc.end_date >= v_first)
   order by coalesce(urc.start_date, urc.next_post_date) desc, urc.id
   limit 1;
  if found then
    -- Same terms: the unit is already billed correctly.
    if v_cur.amount = round(v_occ.dues_amount, 2)
       and v_cur.frequency = coalesce(v_occ.dues_frequency, 'monthly'::public.recurring_frequency) then
      return v_cur.id;
    end if;
    -- Different terms (e.g. a new owner's dues after a sale): end the old
    -- schedule before the next period it has not posted yet and start the new
    -- amount from there, so no period is billed twice or at the old amount.
    v_first := greatest(v_first, v_cur.next_post_date);
    if v_cur.starts >= v_first then
      -- Nothing posted on it yet: just correct its terms.
      update public.unit_recurring_charges
         set amount = round(v_occ.dues_amount, 2),
             frequency = coalesce(v_occ.dues_frequency, 'monthly'::public.recurring_frequency),
             updated_at = now()
       where id = v_cur.id;
      return v_cur.id;
    end if;
    update public.unit_recurring_charges
       set end_date = v_first - 1, updated_at = now()
     where id = v_cur.id;
  end if;

  -- A dues schedule that genuinely starts later (and can still post): bridge
  -- the gap up to the day before it starts.
  select min(coalesce(urc.start_date, urc.next_post_date)) - 1 into v_end
    from public.unit_recurring_charges urc
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and coalesce(urc.start_date, urc.next_post_date) > v_first
     and (urc.end_date is null or urc.next_post_date <= urc.end_date);

  insert into public.unit_recurring_charges
    (unit_id, charge_category_id, amount, frequency, start_date, next_post_date, end_date, created_by)
  values
    (v_occ.unit_id, v_cat, round(v_occ.dues_amount, 2),
     coalesce(v_occ.dues_frequency, 'monthly'::public.recurring_frequency),
     v_first, v_first, v_end, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.schedule_owner_dues(uuid, date) from public, anon;
grant execute on function public.schedule_owner_dues(uuid, date) to authenticated;
