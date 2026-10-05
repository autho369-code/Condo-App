-- Follow-up to 20261005131500 (same simple rule): a new owner with no dues
-- still retires the old owner's schedule; only a schedule already running on
-- the first due date counts as "same terms"; the new schedule always starts on
-- the 1st; the app passes the raw start date and the function rounds it in the
-- association's time zone. When the matching schedule already exists, any
-- other dues schedule on the unit is still retired.
create or replace function public.schedule_owner_dues(p_occupancy_id uuid, p_start date default current_date)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_occ record;
  v_cat uuid;
  v_n integer;
  v_cats uuid[];
  v_first date;
  v_amount numeric;
  v_freq public.recurring_frequency;
  v_keep uuid;
  v_id uuid;
  v_today date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select o.unit_id, o.dues_amount, o.dues_frequency, o.occupancy_type, o.status,
         b.association_id, a.portfolio_id, a.timezone
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

  if v_occ.occupancy_type <> 'owner' or v_occ.status = 'past' then
    return null;
  end if;

  -- Dues categories for this association.
  select array_agg(cc.id order by (cc.association_id is not null) desc, cc.created_at, cc.id) into v_cats
    from public.charge_categories cc
   where cc.portfolio_id = v_occ.portfolio_id and cc.active and cc.charge_type = 'assessment'
     and (cc.association_id = v_occ.association_id or cc.association_id is null)
     and upper(coalesce(cc.code, '')) = 'DUES';
  if v_cats is not null then
    v_cat := v_cats[1];
  else
    select count(*), min(cc.id::text)::uuid into v_n, v_cat
      from public.charge_categories cc
     where cc.portfolio_id = v_occ.portfolio_id and cc.active and cc.charge_type = 'assessment'
       and (cc.association_id = v_occ.association_id or cc.association_id is null);
    if v_n <> 1 and coalesce(v_occ.dues_amount, 0) <= 0 then
      return null;  -- no dues to bill and no dues category to retire
    elsif v_n = 0 then
      raise exception 'No active assessment charge category exists, so monthly dues were not scheduled' using errcode = '23514';
    elsif v_n > 1 then
      raise exception 'Several assessment charge categories exist and none has code DUES, so monthly dues were not scheduled' using errcode = '23514';
    end if;
    v_cats := array[v_cat];
  end if;

  perform 1 from public.units where id = v_occ.unit_id for update;

  -- Re-read the occupancy under the lock: a transfer that held it may have
  -- just ended this ownership or changed its dues.
  select o.unit_id, o.dues_amount, o.dues_frequency, o.occupancy_type, o.status,
         b.association_id, a.portfolio_id, a.timezone
    into v_occ
    from public.occupancies o
    join public.units u on u.id = o.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where o.id = p_occupancy_id;
  if not found or v_occ.status = 'past' then
    return null;
  end if;

  v_amount := round(coalesce(v_occ.dues_amount, 0), 2);
  v_freq := coalesce(v_occ.dues_frequency, 'monthly'::public.recurring_frequency);
  v_today := (now() at time zone coalesce(nullif(v_occ.timezone, ''), 'America/Chicago'))::date;
  v_first := greatest(coalesce(p_start, v_today), v_today);
  if extract(day from v_first) <> 1 then
    v_first := (date_trunc('month', v_first) + interval '1 month')::date;
  end if;

  -- Same terms already billing this unit: nothing to do.
  -- Dues already charged on the first due date (by any schedule): start the
  -- month after, so an unposted row due that day is switched off below.
  if exists (select 1 from public.charges c
              where c.unit_id = v_occ.unit_id and c.charge_category_id = any(v_cats)
                and c.due_date = v_first and c.amount <> 0) then
    v_first := (v_first + interval '1 month')::date;
  end if;

  -- A dues schedule that never posted and is dated before the first due date
  -- (e.g. the fee builder backdated to an old move-in) would bill past months
  -- retroactively: switch it off.
  update public.unit_recurring_charges urc
     set active = false, updated_at = now()
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and urc.last_posted_at is null and urc.next_post_date < v_first;

  select urc.id into v_keep
    from public.unit_recurring_charges urc
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and urc.amount = v_amount and urc.frequency = v_freq
     and coalesce(urc.start_date, urc.next_post_date) <= v_first
     and extract(day from urc.next_post_date) = 1
     and urc.end_date is null
   order by (urc.last_posted_at is not null) desc, urc.created_at desc
   limit 1;
  if v_keep is not null then
    -- Still retire any other dues schedule on the unit (e.g. the seller's while
    -- the fee builder already added the new owner's), so only one bills.
    update public.unit_recurring_charges urc
       set active = false, updated_at = now()
     where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
       and urc.id <> v_keep
       and coalesce(urc.start_date, urc.next_post_date) >= v_first;
    update public.unit_recurring_charges urc
       set end_date = v_first - 1, updated_at = now()
     where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
       and urc.id <> v_keep
       and (urc.end_date is null or urc.end_date >= v_first);
    return v_keep;
  end if;

  -- Start fresh: a month the old schedule already posted is not billed again.
  select greatest(v_first, coalesce(date_trunc('month', max(urc.next_post_date) filter (where urc.last_posted_at is not null))::date, v_first))
    into v_first
    from public.unit_recurring_charges urc
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and urc.frequency = v_freq
     and (urc.end_date is null or urc.end_date >= v_first);
  if extract(day from v_first) <> 1 then
    v_first := (date_trunc('month', v_first) + interval '1 month')::date;
  end if;
  -- Dues already charged on that date (e.g. a different-frequency schedule
  -- posted it this morning): start the month after.
  if exists (select 1 from public.charges c
              where c.unit_id = v_occ.unit_id and c.charge_category_id = any(v_cats)
                and c.due_date = v_first and c.amount <> 0) then
    v_first := (v_first + interval '1 month')::date;
  end if;

  -- Retire the old dues: switch off schedules that never started, end the rest.
  update public.unit_recurring_charges urc
     set active = false, updated_at = now()
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and coalesce(urc.start_date, urc.next_post_date) >= v_first;
  update public.unit_recurring_charges urc
     set end_date = v_first - 1, updated_at = now()
   where urc.unit_id = v_occ.unit_id and urc.active and urc.charge_category_id = any(v_cats)
     and (urc.end_date is null or urc.end_date >= v_first);

  -- No dues for this owner: the old dues are retired and nothing new starts.
  if v_amount <= 0 then
    return null;
  end if;

  insert into public.unit_recurring_charges
    (unit_id, charge_category_id, amount, frequency, start_date, next_post_date, created_by)
  values (v_occ.unit_id, v_cat, v_amount, v_freq, v_first, v_first, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.schedule_owner_dues(uuid, date) from public, anon;
grant execute on function public.schedule_owner_dues(uuid, date) to authenticated;

-- The posting job takes the same unit lock and re-checks each schedule before
-- posting, so a schedule retired by schedule_owner_dues mid-run is skipped.
create or replace function public.post_unit_recurring_charges()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare row record; n integer := 0; new_charge_id uuid; next_due date;
begin
  for row in
    select urc.*, cc.name as category_name, cc.gl_account_id as category_gl,
           cc.charge_type as category_charge_type, cc.code as category_code
      from public.unit_recurring_charges urc
      join public.charge_categories cc on cc.id = urc.charge_category_id
     where urc.active and cc.active
       and urc.next_post_date <= current_date
       and (urc.end_date is null or urc.next_post_date <= urc.end_date)
  loop
    perform 1 from public.units where id = row.unit_id for update;
    perform 1 from public.unit_recurring_charges u
     where u.id = row.id and u.active and u.next_post_date = row.next_post_date
       and (u.end_date is null or u.next_post_date <= u.end_date)
       for update;
    if not found then
      continue;
    end if;

    insert into public.charges (
      unit_id, charge_category_id, charge_type, description,
      amount, due_date, gl_account_id, created_by
    ) values (
      row.unit_id, row.charge_category_id, row.category_charge_type,
      coalesce(row.memo, row.category_name),
      row.amount, row.next_post_date, row.category_gl, row.created_by
    ) returning id into new_charge_id;

    next_due := public.recurring_next_date(row.next_post_date, row.frequency::text, 1,
      extract(day from coalesce(row.start_date, row.next_post_date))::integer);

    update public.unit_recurring_charges set next_post_date = next_due, last_posted_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$;
