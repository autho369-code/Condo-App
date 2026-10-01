-- Monthly/quarterly/annual schedules drifted to the 28th: adding one month
-- to Jan 31 gives Feb 28, and every later step started from the 28th. Next
-- dates now keep an anchor day (the schedule's start day), clamped to each
-- month's length: Jan 31 -> Feb 28 -> Mar 31 -> Apr 30.
create or replace function public.recurring_next_date(p_date date, p_frequency text, p_interval integer, p_anchor_day integer)
 returns date
 language plpgsql
 immutable
 set search_path to 'pg_catalog'
as $function$
declare
  v_months integer;
  v_anchor integer;
  v_target date;
  v_last integer;
begin
  if p_date is null then return null; end if;
  if p_frequency = 'daily' then return p_date + make_interval(days => p_interval); end if;
  if p_frequency = 'weekly' then return p_date + make_interval(weeks => p_interval); end if;
  v_months := case p_frequency
    when 'monthly' then p_interval
    when 'quarterly' then 3 * p_interval
    when 'annually' then 12 * p_interval
  end;
  if v_months is null then return null; end if;
  -- Without an anchor, a month-end date stays at month end.
  v_anchor := coalesce(p_anchor_day,
    case when p_date = (date_trunc('month', p_date) + interval '1 month - 1 day')::date then 31
         else extract(day from p_date)::integer end);
  v_target := (date_trunc('month', p_date) + make_interval(months => v_months))::date;
  v_last := extract(day from (v_target + interval '1 month - 1 day'))::integer;
  return v_target + (least(greatest(v_anchor, 1), v_last) - 1);
end;
$function$;

create or replace function public.recurring_next_date(p_date date, p_frequency text, p_interval integer)
 returns date
 language sql
 immutable
 set search_path to 'pg_catalog'
as $function$
  select public.recurring_next_date(p_date, p_frequency, p_interval, null::integer);
$function$;

-- Same reach as the 3-argument form it backs (a pure date calculation).
grant execute on function public.recurring_next_date(date, text, integer, integer) to anon, authenticated, service_role;

-- Recurring bills and purchase orders anchor on their start date.
do $$
declare
  v_name text;
  v_def text;
  v_old constant text := 'public.recurring_next_date(v_date, t.frequency::text, t.interval_count)';
  v_new constant text := 'public.recurring_next_date(v_date, t.frequency::text, t.interval_count, extract(day from coalesce(t.start_date, t.next_post_date))::integer)';
begin
  foreach v_name in array array['generate_recurring_bills', 'generate_recurring_purchase_orders'] loop
    select pg_get_functiondef(('public.' || v_name || '()')::regprocedure) into v_def;
    if position(v_old in v_def) = 0 then
      raise exception '% does not contain the expected recurring_next_date call', v_name;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end $$;

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

-- Recurring work orders (nightly generator) anchor on their start date too.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.generate_recurring_work_orders()'::regprocedure) into v_def;
  v_new := regexp_replace(v_def, 'next_due := case row\.frequency.*?end::date;',
    'next_due := public.recurring_next_date(row.next_due_date, row.frequency::text, coalesce(row.interval_count, 1), extract(day from coalesce(row.start_date, row.next_due_date))::integer);');
  if v_new = v_def then
    raise exception 'generate_recurring_work_orders does not contain the expected next_due calculation';
  end if;
  execute v_new;
end $$;

-- apply_dues_increase walks a schedule's cycles the same way.
do $$
declare
  v_def text;
  v_old constant text := 'v_cycle := (v_cycle + v_step)::date;';
  v_new constant text := 'v_cycle := public.recurring_next_date(v_cycle, r.frequency::text, 1, extract(day from coalesce(r.start_date, r.next_post_date, v_cycle))::integer);';
begin
  select pg_get_functiondef('public.apply_dues_increase(uuid,uuid,text,numeric,date,boolean)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'apply_dues_increase does not contain the expected cycle step';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
