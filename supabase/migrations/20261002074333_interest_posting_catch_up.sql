-- assess_association_interest fixes:
-- * A posting day of 29-31 never matched in shorter months, and a missed
--   cron day skipped the month entirely. Interest now posts on any day on or
--   after the month's posting day (clamped to the month's last day). The
--   balance is measured as of that posting date, and the existing
--   one-assessment-per-unit-per-month rule keeps later runs from adding more.
-- * One association's error rolled back the whole run; each association now
--   runs in its own exception block and failures are reported.
create or replace function public.assess_association_interest(p_as_of date default current_date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  a record; u record;
  v_period date := date_trunc('month', p_as_of)::date;
  v_last_day integer := extract(day from (date_trunc('month', p_as_of) + interval '1 month - 1 day'))::integer;
  v_post_date date;
  v_cat uuid; v_charge uuid; v_amount numeric;
  n_assoc integer := 0; n_charges integer := 0; n_failed integer := 0; n_here integer;
  v_errors text[] := '{}';
begin
  for a in
    select id, portfolio_id, name, annual_interest_rate, coalesce(interest_grace_days, 0) grace_days,
           coalesce(interest_grace_balance, 0) grace_balance, interest_income_gl_account_id,
           least(greatest(coalesce(interest_post_day_of_month, 1), 1), v_last_day) post_day
      from public.associations
     where archived_at is null and coalesce(annual_interest_rate, 0) > 0
       and least(greatest(coalesce(interest_post_day_of_month, 1), 1), v_last_day) <= extract(day from p_as_of)::integer
  loop
    n_assoc := n_assoc + 1;
    v_post_date := v_period + (a.post_day - 1);
    n_here := 0;
    begin
      select id into v_cat from public.charge_categories c
       where c.portfolio_id = a.portfolio_id and c.active and c.archived_at is null
         and (upper(coalesce(c.code, '')) = 'INTEREST' or c.name ilike '%interest%')
       order by c.sort_order limit 1;
      for u in
        select un.id unit_id,
               sum(greatest(ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0), 0)) principal
          from public.units un
          join public.buildings b on b.id = un.building_id
          join public.charges ch on ch.unit_id = un.id
         where b.association_id = a.id and un.archived_at is null
           and ch.due_date < v_post_date - a.grace_days
           and not exists (select 1 from public.interest_assessments ia where ia.charge_id = ch.id)
         group by un.id
      loop
        continue when u.principal <= a.grace_balance or u.principal <= 0;
        continue when exists (select 1 from public.interest_assessments ia where ia.unit_id = u.unit_id and ia.period_month = v_period);
        v_amount := round(u.principal * a.annual_interest_rate / 100.0 / 12.0, 2);
        continue when v_amount <= 0;
        insert into public.charges (unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id)
        values (u.unit_id, v_cat, 'other',
                'Interest on past-due balance (' || to_char(a.annual_interest_rate, 'FM990.###') || '% APR, ' || to_char(v_period, 'Mon YYYY') || ')',
                v_amount, v_post_date + 15, a.interest_income_gl_account_id)
        returning id into v_charge;
        insert into public.interest_assessments (association_id, unit_id, period_month, principal, annual_rate, amount, charge_id)
        values (a.id, u.unit_id, v_period, round(u.principal, 2), a.annual_interest_rate, v_amount, v_charge);
        n_here := n_here + 1;
      end loop;
      n_charges := n_charges + n_here;
    exception when others then
      n_failed := n_failed + 1;
      v_errors := v_errors || (a.name || ': ' || sqlerrm);
    end;
  end loop;
  return jsonb_build_object('as_of', p_as_of, 'associations', n_assoc, 'charges', n_charges,
                            'failed', n_failed, 'errors', to_jsonb(v_errors));
end;
$function$;
