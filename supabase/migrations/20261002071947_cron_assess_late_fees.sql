-- The daily late-fee cron listed units, overdue charges and prior
-- assessments through PostgREST, which returns at most 1,000 rows per query
-- (and put every unit id in the URL): large associations were silently only
-- partly assessed. Do the whole run in the database. Each charge is assessed
-- in its own exception block so one bad row cannot stop the rest.
create or replace function public.cron_assess_late_fees()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  a record;
  c record;
  v_fee uuid;
  v_assoc_count integer := 0;
  v_candidates integer := 0;
  v_assessed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_details text[] := '{}';
begin
  for a in
    select id, name, coalesce(late_fee_grace_days, 10) as grace
      from public.associations
     where late_fee_enabled and coalesce(late_fee_amount, 0) > 0 and archived_at is null
     order by name
  loop
    v_assoc_count := v_assoc_count + 1;
    for c in
      select ch.id
        from public.charges ch
        join public.units u on u.id = ch.unit_id
        join public.buildings b on b.id = u.building_id
       where b.association_id = a.id
         and ch.charge_type = 'assessment'
         and ch.due_date + a.grace < current_date
         and not exists (select 1 from public.late_fee_assessments l where l.charge_id = ch.id)
         and ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0) > 0.005
       order by ch.due_date, ch.id
    loop
      v_candidates := v_candidates + 1;
      begin
        v_fee := public.assess_late_fee(c.id);
        if v_fee is not null then v_assessed := v_assessed + 1; else v_skipped := v_skipped + 1; end if;
      exception when others then
        v_failed := v_failed + 1;
        if cardinality(v_details) < 50 then
          v_details := v_details || (a.name || ' charge ' || c.id || ': ' || sqlerrm);
        end if;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'associations', v_assoc_count, 'candidates', v_candidates, 'assessed', v_assessed,
    'skipped', v_skipped, 'failed', v_failed, 'details', to_jsonb(v_details));
end;
$$;

revoke all on function public.cron_assess_late_fees() from public, anon, authenticated;
grant execute on function public.cron_assess_late_fees() to service_role;
