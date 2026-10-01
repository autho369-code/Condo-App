-- Dues increase: raise (or set) every active recurring assessment of one
-- charge category across an association, effective on a date. Postings
-- scheduled before the effective date keep the old amount: the old schedule
-- is end-dated the day before the first cycle on/after the effective date and
-- a new schedule continues on the same cycle at the new amount, so the dues
-- roll keeps a full history. p_apply = false returns the preview only.
create or replace function public.apply_dues_increase(
  p_association_id uuid,
  p_charge_category_id uuid,
  p_mode text,
  p_value numeric,
  p_effective_date date,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_portfolio uuid;
  r record;
  v_new numeric;
  v_cycle date;
  v_step interval;
  v_guard integer;
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id and archived_at is null;
  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied for this association' using errcode = '42501';
  end if;
  if not exists (select 1 from public.charge_categories c where c.id = p_charge_category_id and c.portfolio_id = v_portfolio) then
    raise exception 'Charge category is outside this portfolio' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('percent', 'amount', 'set') then raise exception 'Choose percent, amount, or set' using errcode = '22023'; end if;
  if p_value is null or (p_mode = 'set' and p_value <= 0) or (p_mode = 'percent' and (p_value <= -100 or p_value > 1000)) then
    raise exception 'Enter a valid increase' using errcode = '22023';
  end if;
  if p_effective_date is null then raise exception 'Enter the effective date' using errcode = '22023'; end if;

  for r in
    select urc.*, u.unit_number,
           (select o.full_name from public.occupancies occ join public.owners o on o.id = occ.owner_id
             where occ.unit_id = u.id and occ.status = 'current' and occ.occupancy_type = 'owner' order by occ.is_primary desc limit 1) as homeowner
      from public.unit_recurring_charges urc
      join public.units u on u.id = urc.unit_id and u.archived_at is null
      join public.buildings b on b.id = u.building_id and b.association_id = p_association_id
     where urc.active
       and urc.charge_category_id = p_charge_category_id
       and (urc.end_date is null or urc.end_date >= p_effective_date)
     order by u.unit_number
     for update of urc
  loop
    v_new := case p_mode
      when 'percent' then round(r.amount * (1 + p_value / 100), 2)
      when 'amount' then round(r.amount + p_value, 2)
      else round(p_value, 2)
    end;
    if v_new < 0 then raise exception 'Unit % would have a negative amount', r.unit_number using errcode = '22023'; end if;

    v_step := case r.frequency
      when 'daily' then interval '1 day' when 'weekly' then interval '1 week'
      when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
      else interval '1 year' end;
    v_cycle := coalesce(r.next_post_date, r.start_date, p_effective_date);
    v_guard := 0;
    while v_cycle < p_effective_date and v_guard < 5000 loop
      v_cycle := (v_cycle + v_step)::date;
      v_guard := v_guard + 1;
    end loop;
    continue when r.end_date is not null and r.end_date < v_cycle;

    v_rows := v_rows || jsonb_build_object(
      'recurring_id', r.id, 'unit_number', r.unit_number, 'homeowner', r.homeowner,
      'frequency', r.frequency::text, 'old_amount', r.amount, 'new_amount', v_new, 'first_new_post', v_cycle);

    if p_apply and v_new <> r.amount then
      if v_cycle <= coalesce(r.next_post_date, v_cycle) then
        update public.unit_recurring_charges set amount = v_new, updated_at = now() where id = r.id;
      else
        update public.unit_recurring_charges set end_date = v_cycle - 1, updated_at = now() where id = r.id;
        insert into public.unit_recurring_charges (
          unit_id, charge_category_id, amount, frequency, start_date, end_date, next_post_date, memo, identifier, active, created_by
        ) values (
          r.unit_id, r.charge_category_id, v_new, r.frequency, v_cycle, r.end_date, v_cycle, r.memo, r.identifier, true, auth.uid()
        );
      end if;
      -- Keep the homeowner's occupancy dues facts in step (shown on the
      -- homeowner record and the dues roll).
      update public.occupancies
         set last_dues_increase_date = p_effective_date,
             last_dues_increase_amount = v_new - r.amount,
             dues_amount = case when dues_amount = r.amount then v_new else dues_amount end,
             updated_at = now()
       where unit_id = r.unit_id and status = 'current' and occupancy_type = 'owner';
    end if;
  end loop;

  if p_apply then
    insert into public.audit_logs (portfolio_id, actor_id, action, entity_type, entity_id, changes)
    values (v_portfolio, auth.uid(), 'dues_increase', 'association', p_association_id,
            jsonb_build_object('charge_category_id', p_charge_category_id, 'mode', p_mode, 'value', p_value,
                               'effective_date', p_effective_date, 'schedules', jsonb_array_length(v_rows)));
  end if;
  return v_rows;
end;
$$;

revoke all on function public.apply_dues_increase(uuid, uuid, text, numeric, date, boolean) from public, anon;
grant execute on function public.apply_dues_increase(uuid, uuid, text, numeric, date, boolean) to authenticated;
