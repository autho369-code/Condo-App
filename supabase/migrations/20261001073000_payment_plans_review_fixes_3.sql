-- #102 review 3 for payment plans.
--  1. While a unit has an active plan its collection case stays on hold, even
--     if the nightly delinquency sync resolves the case and later reopens it
--     (or opens a new one): a trigger on delinquency_cases re-applies the hold.
--  2. A payment correction that underfunds a completed plan reopens it — but
--     not while the unit's case is in legal review or approved for counsel
--     (creating a plan is refused in that state too), nor when a newer plan is
--     already active; in those cases the plan is cancelled with that reason.
--  3. A correction rechecks every active/completed plan of the unit, not just
--     the newest one.
--  4. A cancelled plan only counts payments recorded before it was cancelled.

-- 4. payment window: [created_at, cancelled_at]
do $$
declare
  f text;
  def text;
begin
  foreach f in array array['payment_plan_schedule(uuid)', 'report_data_payment_plans(uuid,jsonb)'] loop
    def := pg_get_functiondef(('public.' || f)::regprocedure);
    if def !~ 'pm\.created_at >= (plan|p)\.created_at' then
      raise exception 'payment_plans_review_fixes_3: % drifted', f;
    end if;
    def := regexp_replace(def, 'pm\.created_at >= (plan|p)\.created_at',
                          'pm.created_at >= \1.created_at and (\1.cancelled_at is null or pm.created_at <= \1.cancelled_at)', 'g');
    execute def;
  end loop;
end $$;

-- 1. keep the hold while a plan is active
create or replace function public.delinquency_cases_keep_plan_hold()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status = 'open'
     and exists (select 1 from public.payment_plans p where p.unit_id = new.unit_id and p.status = 'active') then
    new.status := 'on_hold';
    new.hold_reason := 'Payment plan agreed — collections paused while the plan is current';
  end if;
  return new;
end $$;
revoke all on function public.delinquency_cases_keep_plan_hold() from public, anon, authenticated;
drop trigger if exists trg_delinquency_cases_keep_plan_hold on public.delinquency_cases;
create trigger trg_delinquency_cases_keep_plan_hold before insert or update of status on public.delinquency_cases
  for each row execute function public.delinquency_cases_keep_plan_hold();

-- Releasing a hold for a finished/cancelled plan must not be undone by the
-- trigger: the release runs only after the plan has left 'active', so the
-- trigger's check finds no active plan. (Order is guaranteed by the callers.)

-- 2 + 3. recheck every affected plan; never reopen while counsel is involved
create or replace function public.app_recheck_payment_plan(p_unit_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  pl public.payment_plans;
  v_paid numeric;
  c record;
begin
  for pl in select * from public.payment_plans
             where unit_id = p_unit_id and status in ('active', 'completed')
             order by created_at for update loop
    select coalesce(sum(pm.amount), 0) into v_paid from public.payments pm
     where pm.unit_id = pl.unit_id and pm.created_at >= pl.created_at and coalesce(pm.method, '') <> 'credit';

    if pl.status = 'active' and v_paid >= pl.total_amount then
      perform public.app_complete_paid_payment_plan(pl.unit_id);
    elsif pl.status = 'completed' and v_paid < pl.total_amount then
      if exists (select 1 from public.delinquency_cases d where d.unit_id = pl.unit_id and d.status in ('legal_review', 'approved_for_counsel')) then
        update public.payment_plans
           set status = 'cancelled', cancelled_at = now(), updated_at = now(),
               cancel_reason = 'A payment correction left the plan unpaid while the collection case is in legal review'
         where id = pl.id;
      elsif not exists (select 1 from public.payment_plans o where o.unit_id = pl.unit_id and o.status = 'active') then
        update public.payment_plans set status = 'active', completed_at = null, updated_at = now() where id = pl.id;
        for c in select * from public.delinquency_cases where unit_id = pl.unit_id and status = 'open' for update loop
          -- The keep-hold trigger sets status/reason; the event records why.
          update public.delinquency_cases set status = 'open' where id = c.id;
          insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note)
          values (c.id, 'hold_placed', c.current_step_number, c.balance_snapshot, 'Payment plan reopened after a payment correction');
        end loop;
      else
        -- A newer plan is active, so this one can't reopen; don't leave it showing "Paid off".
        update public.payment_plans
           set status = 'cancelled', cancelled_at = now(), updated_at = now(),
               cancel_reason = 'A payment correction left the plan unpaid; a newer plan is active'
         where id = pl.id;
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.app_recheck_payment_plan(uuid) from public, anon, authenticated;

-- Existing open cases of units with an active plan.
update public.delinquency_cases d set status = 'open'
 where d.status = 'open' and exists (select 1 from public.payment_plans p where p.unit_id = d.unit_id and p.status = 'active');
