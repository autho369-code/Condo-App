-- #102 review 2 for payment plans.
--  1. Only payments RECORDED after the plan was created count toward it
--     (payments.created_at >= plan.created_at). Day precision let a receipt
--     entered earlier the same day — e.g. the one that paid off a previous
--     plan — count again.
--  2. Completion is rechecked when a payment is edited or deleted, both ways:
--     a completed plan whose coverage is gone goes back to active and its
--     collections hold is restored; an active plan newly covered completes.
--  3. Each installment must be at least one cent.

-- 1. payment predicate in the schedule, completion check and report
do $$
declare
  f text;
  def text;
begin
  foreach f in array array['payment_plan_schedule(uuid)', 'app_complete_paid_payment_plan(uuid)', 'report_data_payment_plans(uuid,jsonb)'] loop
    def := pg_get_functiondef(('public.' || f)::regprocedure);
    if def !~ 'pm\.payment_date >= (plan|pl|p)\.start_date' then
      raise exception 'payment_plans_review_fixes_2: % drifted', f;
    end if;
    def := regexp_replace(def, 'pm\.payment_date >= (plan|pl|p)\.start_date', 'pm.created_at >= \1.created_at', 'g');
    execute def;
  end loop;
end $$;

-- 2. recheck after edits/deletes (inserts keep using the completion trigger)
create or replace function public.app_recheck_payment_plan(p_unit_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  pl public.payment_plans;
  v_paid numeric;
  c record;
begin
  select * into pl from public.payment_plans
   where unit_id = p_unit_id and status in ('active', 'completed')
   order by created_at desc limit 1 for update;
  if pl.id is null then
    return;
  end if;
  select coalesce(sum(pm.amount), 0) into v_paid from public.payments pm
   where pm.unit_id = pl.unit_id and pm.created_at >= pl.created_at and coalesce(pm.method, '') <> 'credit';

  if pl.status = 'active' and v_paid >= pl.total_amount then
    perform public.app_complete_paid_payment_plan(pl.unit_id);
  elsif pl.status = 'completed' and v_paid < pl.total_amount
        and not exists (select 1 from public.payment_plans o where o.unit_id = pl.unit_id and o.status = 'active') then
    update public.payment_plans set status = 'active', completed_at = null, updated_at = now() where id = pl.id;
    for c in select * from public.delinquency_cases where unit_id = pl.unit_id and status = 'open' for update loop
      update public.delinquency_cases
         set status = 'on_hold', hold_reason = 'Payment plan agreed — collections paused while the plan is current'
       where id = c.id;
      insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note)
      values (c.id, 'hold_placed', c.current_step_number, c.balance_snapshot, 'Payment plan reopened after a payment correction');
    end loop;
  end if;
end $$;
revoke all on function public.app_recheck_payment_plan(uuid) from public, anon, authenticated;

create or replace function public.payments_recheck_payment_plan()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.unit_id is not null then
    perform public.app_recheck_payment_plan(old.unit_id);
  end if;
  if tg_op = 'UPDATE' and new.unit_id is not null and new.unit_id is distinct from old.unit_id then
    perform public.app_recheck_payment_plan(new.unit_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_payments_recheck_payment_plan on public.payments;
create trigger trg_payments_recheck_payment_plan after update of amount, unit_id, method, payment_date or delete on public.payments
  for each row execute function public.payments_recheck_payment_plan();

-- 3. at least one cent per installment
do $$
declare def text;
begin
  def := pg_get_functiondef('public.create_payment_plan(uuid, numeric, integer, text, date, text)'::regprocedure);
  if def !~ 'raise exception ''Choose between 1 and 60 installments'' using errcode = ''22023'';\s+end if;' then
    raise exception 'payment_plans_review_fixes_2: create_payment_plan drifted';
  end if;
  def := regexp_replace(def,
    '(raise exception ''Choose between 1 and 60 installments'' using errcode = ''22023'';\s+end if;)',
    '\1' || chr(10) ||
    '  if round(p_total, 2) < p_installments * 0.01 then' || chr(10) ||
    '    raise exception ''Each installment must be at least one cent — use fewer installments'' using errcode = ''22023'';' || chr(10) ||
    '  end if;');
  execute def;
end $$;
