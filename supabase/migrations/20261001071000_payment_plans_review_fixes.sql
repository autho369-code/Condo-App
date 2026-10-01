-- #102 review fixes for payment plans.
--  1. A plan whose installments are all covered becomes 'completed' (not
--     stuck 'active'): checked whenever a payment is recorded for the unit,
--     and once now for existing plans. Completing — like cancelling —
--     releases the collections hold the plan placed, and frees the unit for
--     a new plan.
--  2. A plan can't be created while the unit's collection case is in legal
--     review or approved for counsel — that is counsel's decision, resolve it
--     first.

alter table public.payment_plans drop constraint if exists payment_plans_status_check;
alter table public.payment_plans add constraint payment_plans_status_check check (status in ('active', 'completed', 'cancelled'));
alter table public.payment_plans add column if not exists completed_at timestamptz;

-- Release a hold a payment plan placed on the unit's case. Internal: called
-- from create/cancel/complete paths that have already authorized the change
-- (completion runs from a payment trigger, possibly an owner's online payment).
create or replace function public.app_release_payment_plan_holds(p_unit_id uuid, p_note text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare c record;
begin
  for c in select * from public.delinquency_cases
            where unit_id = p_unit_id and status = 'on_hold' and hold_reason like 'Payment plan agreed%' for update loop
    update public.delinquency_cases set status = 'open', hold_reason = null where id = c.id;
    insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note)
    values (c.id, 'hold_released', c.current_step_number, c.balance_snapshot, p_note);
  end loop;
end $$;
revoke all on function public.app_release_payment_plan_holds(uuid, text) from public, anon, authenticated;

create or replace function public.app_complete_paid_payment_plan(p_unit_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  pl public.payment_plans;
  v_paid numeric;
begin
  select * into pl from public.payment_plans where unit_id = p_unit_id and status = 'active' for update;
  if pl.id is null then
    return;
  end if;
  select coalesce(sum(pm.amount), 0) into v_paid from public.payments pm
   where pm.unit_id = pl.unit_id and pm.payment_date >= pl.start_date and coalesce(pm.method, '') <> 'credit';
  if v_paid >= pl.total_amount then
    update public.payment_plans set status = 'completed', completed_at = now(), updated_at = now() where id = pl.id;
    perform public.app_release_payment_plan_holds(pl.unit_id, 'Payment plan paid off');
  end if;
end $$;
revoke all on function public.app_complete_paid_payment_plan(uuid) from public, anon, authenticated;

create or replace function public.payments_complete_payment_plan()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.unit_id is not null and coalesce(new.method, '') <> 'credit' then
    perform public.app_complete_paid_payment_plan(new.unit_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_payments_complete_payment_plan on public.payments;
create trigger trg_payments_complete_payment_plan after insert on public.payments
  for each row execute function public.payments_complete_payment_plan();

-- Cancelling uses the same release.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.cancel_payment_plan(uuid, text)'::regprocedure);
  if def !~ 'perform public\.set_delinquency_case_hold\(v_case\.id, false, null\);' then
    raise exception 'payment_plans_review_fixes: cancel_payment_plan drifted';
  end if;
  def := regexp_replace(def,
    'for v_case in select id from public\.delinquency_cases where unit_id = pl\.unit_id and status = ''on_hold''\s+and hold_reason like ''Payment plan agreed%'' loop\s+perform public\.set_delinquency_case_hold\(v_case\.id, false, null\);\s+end loop;',
    'perform public.app_release_payment_plan_holds(pl.unit_id, ''Payment plan cancelled'');');
  if def ~ 'set_delinquency_case_hold' then
    raise exception 'payment_plans_review_fixes: cancel_payment_plan hold release not replaced';
  end if;
  execute def;
end $$;

-- No plan while counsel is involved.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.create_payment_plan(uuid, numeric, integer, text, date, text)'::regprocedure);
  if def !~ 'if exists \(select 1 from public\.payment_plans where unit_id = p_unit_id and status = ''active''\) then' then
    raise exception 'payment_plans_review_fixes: create_payment_plan drifted';
  end if;
  def := replace(def,
    'if exists (select 1 from public.payment_plans where unit_id = p_unit_id and status = ''active'') then',
    'if exists (select 1 from public.delinquency_cases where unit_id = p_unit_id and status in (''legal_review'', ''approved_for_counsel'')) then' || chr(10) ||
    '    raise exception ''This unit''''s collection case is in legal review — resolve it before agreeing a payment plan'' using errcode = ''22023'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if exists (select 1 from public.payment_plans where unit_id = p_unit_id and status = ''active'') then');
  execute def;
end $$;

-- Report: completed plans read "Paid off".
do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_payment_plans(uuid, jsonb)'::regprocedure);
  if def !~ 'when pl\.paid >= pl\.total_amount then ''Paid off''' then
    raise exception 'payment_plans_review_fixes: report_data_payment_plans drifted';
  end if;
  execute replace(def, 'when pl.paid >= pl.total_amount then ''Paid off''',
                       'when pl.status = ''completed'' or pl.paid >= pl.total_amount then ''Paid off''');
end $$;

-- Existing plans that are already paid off.
do $$
declare p record;
begin
  for p in select unit_id from public.payment_plans where status = 'active' loop
    perform public.app_complete_paid_payment_plan(p.unit_id);
  end loop;
end $$;
