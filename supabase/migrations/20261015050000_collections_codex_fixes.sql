-- Codex on #375 (two P1s) and the same date rule where it was still missing:
--
-- 1. remove_late_fee debits the income account the fee's own posting
--    credited (read from its posted charge journal entry), not today's
--    late-fee mapping: if the mapping changed after the fee was charged, the
--    old account kept the income while the new one was debited. The current
--    mapping is only a fallback for a fee with no posting.
-- 2. A payment plan's window starts when the plan was recorded, for charges
--    as for receipts (Decisions: edges use recording times, not due dates):
--    a charge counts against the plan when it was recorded after the plan
--    was made. Charges already on the balance when the plan was made are in
--    its total; the old "due on or after the plan's UTC start date" edge
--    left out charges due that local day on a US evening (Codex) and counted
--    twice a charge already in the total that fell due on or after the
--    start (migration review). Cancelled and completed ends become local
--    dates in the association's time zone. Existing plans are rechecked.
-- 3. A new plan's start_date is the association's local date (the column
--    default is the server's UTC date), and the payment plans report says
--    "Behind" by the association's date.
--
-- Re-runnable: each patch checks its marker first.

create or replace function public.remove_late_fee(p_charge_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  c public.charges;
  v_assoc uuid;
  v_pid uuid;
  v_open numeric;
  v_income uuid;
  v_reason text := left(btrim(coalesce(p_reason, '')), 400);
  v_credit uuid;
begin
  select * into c from public.charges where id = p_charge_id;
  if not found then raise exception 'Late fee not found' using errcode = 'P0002'; end if;
  v_assoc := public.unit_association_id(c.unit_id);
  select a.portfolio_id into v_pid from public.associations a where a.id = v_assoc;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(v_assoc) then
    raise exception 'Late fee not found' using errcode = 'P0002';
  end if;
  if c.charge_type <> 'late_fee' then
    raise exception 'Only a late fee can be removed here; use a credit for other charges' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Say why the late fee is removed' using errcode = '22023';
  end if;
  -- Same lock as payment application on the unit, so two removals (or a
  -- removal and a payment) can't both take the same open amount.
  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || c.unit_id::text, 0));
  v_open := c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0);
  if v_open <= 0.005 then
    raise exception 'This late fee is already paid or removed. To give the money back, post a credit or a refund' using errcode = '22023';
  end if;
  -- The account the fee's own posting credited (net of any reposting). Only
  -- this company's entries and this association's accounts count, so an
  -- entry someone else pointed at the charge can't steer or block it.
  select jl.gl_account_id into v_income
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    join public.gl_accounts g on g.id = jl.gl_account_id
   where je.source_type = 'charge' and je.source_id = c.id and je.posted
     and je.portfolio_id = v_pid
     and g.portfolio_id = v_pid and (g.association_id is null or g.association_id = v_assoc)
   group by jl.gl_account_id
  having sum(jl.credit_amount - jl.debit_amount) > 0
   order by sum(jl.credit_amount - jl.debit_amount) desc
   limit 1;
  if v_income is null then
    select g.income into v_income from public.charge_gl_accounts(c) g;
  end if;
  if v_income is null then
    raise exception 'Set the income account on the late fee charge category first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gl_accounts g where g.id = v_income and g.active) then
    raise exception 'The income account this late fee was posted to is inactive. Reactivate it in the chart of accounts, then remove the fee' using errcode = '22023';
  end if;
  v_credit := public.post_homeowner_credit(c.unit_id, round(v_open, 2), public.association_local_date(v_assoc), v_income,
                                           'Late fee removed: ' || v_reason, c.id);
  -- The owner's ledger shows the reference (the reason stays staff-only in
  -- payment_private), so the credit reads as a removed fee, not a payment.
  update public.payments set reference = 'Late fee removed' where id = v_credit;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'unit', c.unit_id, 'late_fee_removed', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('charge_id', c.id, 'amount', round(v_open, 2), 'credit_payment_id', v_credit,
                             'income_gl_account_id', v_income, 'reason', v_reason));
  return v_credit;
end
$function$;

revoke all on function public.remove_late_fee(uuid, text) from public, anon;
grant execute on function public.remove_late_fee(uuid, text) to authenticated;

create or replace function pg_temp.patch_fn(p_sig text, p_marker text, p_pairs text[])
returns void
language plpgsql
as $function$
declare
  v_def text := replace(pg_get_functiondef(p_sig::regprocedure), E'\r\n', E'\n');
  i integer;
begin
  if position(p_marker in v_def) > 0 then return; end if;
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if array_length(string_to_array(v_def, p_pairs[2 * i - 1]), 1) <> 2 then
      raise exception '% : anchor not found exactly once: %', p_sig, p_pairs[2 * i - 1];
    end if;
    v_def := replace(v_def, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  if position(p_marker in v_def) = 0 then raise exception '% : marker missing after patch', p_sig; end if;
  execute v_def;
end
$function$;

-- 2. The plan window in the association's time zone (read once per plan).
select pg_temp.patch_fn('public.payment_plan_paid_amount(uuid)', 'as tz) w', array[
  'public.association_local_date(p.association_id) as today) w',
  'public.association_local_date(p.association_id) as today,
                              coalesce((select nullif(a.timezone, '''') from public.associations a where a.id = p.association_id), ''America/Chicago'') as tz) w',
  'and c.due_date >= p.created_at::date',
  'and c.created_at >= p.created_at',
  'and c.due_date <= least(w.today, p.cancelled_at::date, p.completed_at::date)',
  'and c.due_date <= least(w.today, (p.cancelled_at at time zone w.tz)::date, (p.completed_at at time zone w.tz)::date)',
  'and c.due_date >= o.created_at::date',
  'and c.created_at >= o.created_at',
  'and c.due_date <= least(w.today, o.cancelled_at::date, o.completed_at::date)',
  'and c.due_date <= least(w.today, (o.cancelled_at at time zone w.tz)::date, (o.completed_at at time zone w.tz)::date)'
]);

-- 3. A new plan starts on the association's date.
select pg_temp.patch_fn('public.create_payment_plan(uuid,numeric,integer,text,date,text)', 'notes, created_by, start_date)', array[
  'frequency, first_due_date, notes, created_by)',
  'frequency, first_due_date, notes, created_by, start_date)',
  'nullif(btrim(coalesce(p_notes, '''')), ''''), auth.uid())',
  'nullif(btrim(coalesce(p_notes, '''')), ''''), auth.uid(), public.association_local_date(v_assoc))'
]);

select pg_temp.patch_fn('public.report_data_payment_plans(uuid,jsonb)', 'as today', array[
  'public.payment_plan_paid_amount(p.id) as paid',
  'public.payment_plan_paid_amount(p.id) as paid, public.association_local_date(p.association_id) as today',
  'i.due_date < current_date',
  'i.due_date < pl.today'
]);

-- A changed measure rechecks stored statuses (Product Rules). Production had
-- no payment plans when this ran.
do $$
declare
  v_unit uuid;
begin
  for v_unit in
    select distinct unit_id from public.payment_plans where status in ('active', 'completed')
  loop
    perform public.app_recheck_payment_plan(v_unit);
  end loop;
end
$$;
