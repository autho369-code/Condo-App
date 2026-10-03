-- The Dues increase page applies through this function only.
--  * The charge must be an active assessment category, company-wide or this
--    association's own (apply_dues_increase checked only the company).
--  * Applying requires the preview the manager confirmed: every schedule's id
--    and current amount must still match under the row locks. A schedule
--    edited since, or a second click (whose rows are already raised or
--    replaced), no longer matches, so nothing is applied twice.
-- apply_dues_increase is no longer callable directly.
create or replace function public.apply_dues_increase_checked(
  p_association_id uuid,
  p_charge_category_id uuid,
  p_mode text,
  p_value numeric,
  p_effective_date date,
  p_apply boolean default false,
  p_expected jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_preview jsonb;
  v_now text[];
  v_expected text[];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.charge_categories c
     where c.id = p_charge_category_id
       and c.active and c.archived_at is null
       and c.charge_type in ('assessment', 'special_assessment')
       and (c.association_id is null or c.association_id = p_association_id)
  ) then
    raise exception 'Choose an active assessment charge for this association' using errcode = '22023';
  end if;

  -- Computes and locks the current schedules (and checks finance permission).
  v_preview := public.apply_dues_increase(p_association_id, p_charge_category_id, p_mode, p_value, p_effective_date, false);
  if not p_apply then return v_preview; end if;

  if p_expected is null or jsonb_typeof(p_expected) <> 'array' then
    raise exception 'Preview the increase before applying it' using errcode = '22023';
  end if;
  select coalesce(array_agg(k order by k), '{}') into v_expected
    from (select (e->>'recurring_id') || ':' || round((e->>'old_amount')::numeric, 2)::text as k
            from jsonb_array_elements(p_expected) e) x;
  select coalesce(array_agg(k order by k), '{}') into v_now
    from (select (e->>'recurring_id') || ':' || round((e->>'old_amount')::numeric, 2)::text as k
            from jsonb_array_elements(v_preview) e) x;
  if v_expected is distinct from v_now then
    raise exception 'The dues changed since you previewed (or this increase was already applied). Preview again before applying.' using errcode = '40001';
  end if;

  return public.apply_dues_increase(p_association_id, p_charge_category_id, p_mode, p_value, p_effective_date, true);
end;
$$;

revoke all on function public.apply_dues_increase_checked(uuid, uuid, text, numeric, date, boolean, jsonb) from public, anon;
grant execute on function public.apply_dues_increase_checked(uuid, uuid, text, numeric, date, boolean, jsonb) to authenticated;

revoke execute on function public.apply_dues_increase(uuid, uuid, text, numeric, date, boolean) from authenticated;
