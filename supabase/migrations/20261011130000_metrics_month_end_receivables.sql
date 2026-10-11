-- Metrics: every month end's receivables in one pass.
--
-- metrics_monthly_trend (20261011120000) asked receivable_summary_as_of once
-- per month: twelve passes over charges and their payment applications, each
-- through row-level security, about 1.3 of the call's 1.5 s.
-- receivable_summary_by_months answers all month ends in one pass: the
-- caller's charges and their applications are read once, then each charge's
-- balance is taken at every month end. Same rules as
-- receivable_summary_as_of (charges created before the month end; payments
-- applied before it; overdue = due before the month-end date). Security
-- invoker.
--
-- Checked in rolled-back transactions on production: identical to
-- receivable_summary_as_of for every month (manager, company admin, board,
-- owner; with and without an association filter; and with back-dated charges
-- and partial payments applied before and after month ends): 25-83 ms
-- instead of ~1.3 s.

create or replace function public.receivable_summary_by_months(p_association_ids uuid[], p_months jsonb)
returns table(ord bigint, ar_total numeric, overdue_total numeric, delinquent_units integer)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with m as (
    select x.ord, (x.v->>'to')::date as as_of, (x.v->>'end')::timestamptz as cutoff
      from jsonb_array_elements(p_months) with ordinality as x(v, ord)
  ),
  c as (
    select c.id, c.unit_id, c.due_date, c.amount, c.created_at
      from public.charges c
      join public.units u on u.id = c.unit_id
      join public.buildings b on b.id = u.building_id
     where (p_association_ids is null or b.association_id = any (p_association_ids))
       and c.created_at < (select max(cutoff) from m)
  ),
  pa as (
    select pa.charge_id, pa.amount_applied, coalesce(pa.applied_at, pa.created_at) as applied
      from public.payment_applications pa
     where pa.charge_id in (select id from c)
  ),
  -- A join, not a per-row subquery: each charge's applications are summed
  -- once per month end instead of rescanning every application.
  bal as (
    select m.ord, m.as_of, c.unit_id, c.due_date,
           c.amount - coalesce(sum(p.amount_applied), 0) as due
      from m
      join c on c.created_at < m.cutoff
      left join pa p on p.charge_id = c.id and p.applied < m.cutoff
     group by m.ord, m.as_of, c.id, c.unit_id, c.due_date, c.amount
  )
  select m.ord,
         coalesce(sum(b.due) filter (where b.due > 0), 0)::numeric,
         coalesce(sum(b.due) filter (where b.due > 0 and b.due_date < m.as_of), 0)::numeric,
         (count(distinct b.unit_id) filter (where b.due > 0 and b.due_date < m.as_of))::integer
    from m
    left join bal b on b.ord = m.ord
   group by m.ord
$function$;

revoke all on function public.receivable_summary_by_months(uuid[], jsonb) from public, anon;
grant execute on function public.receivable_summary_by_months(uuid[], jsonb) to authenticated;

create or replace function public.metrics_monthly_trend(
  p_months jsonb,
  p_association_id uuid default null,
  p_portfolio_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path to 'public'
set plan_cache_mode = force_generic_plan
as $function$
declare
  m jsonb;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_ids uuid[] := case when p_association_id is null then null else array[p_association_id] end;
  v_charges numeric;
  v_payments numeric;
  v_ar numeric;
  v_overdue numeric;
  v_delinquent numeric;
  v_income numeric;
  v_expense numeric;
  v_wo_opened bigint;
  v_wo_completed bigint;
  v_violations bigint;
  v_out jsonb := '[]'::jsonb;
  v_ord bigint := 0;
  v_receivables jsonb;
begin
  if jsonb_typeof(p_months) is distinct from 'array' or jsonb_array_length(p_months) > 36 then
    raise exception 'p_months must be a list of at most 36 months' using errcode = '22023';
  end if;

  -- Every month end's receivables in one pass (was one query per month).
  select coalesce(jsonb_object_agg(s.ord::text, jsonb_build_array(s.ar_total, s.overdue_total, s.delinquent_units)), '{}'::jsonb)
    into v_receivables
    from public.receivable_summary_by_months(v_ids, p_months) s;

  for m in select value from jsonb_array_elements(p_months) loop
    v_ord := v_ord + 1;
    v_from := (m->>'from')::date;
    v_to := (m->>'to')::date;
    v_start := (m->>'start')::timestamptz;
    v_end := (m->>'end')::timestamptz;
    if v_from is null or v_to is null or v_start is null or v_end is null or v_to < v_from or v_end <= v_start then
      raise exception 'Each month needs from <= to and start < end' using errcode = '22023';
    end if;

    select coalesce(sum(b.charges_total), 0), coalesce(sum(b.payments_total), 0)
      into v_charges, v_payments
      from public.billing_collection_totals(v_from, v_to, v_ids) b;

    -- Balances as they stood at the end of the month.
    v_ar := coalesce((v_receivables->v_ord::text->>0)::numeric, 0);
    v_overdue := coalesce((v_receivables->v_ord::text->>1)::numeric, 0);
    v_delinquent := coalesce((v_receivables->v_ord::text->>2)::numeric, 0);

    -- Income is credit-normal, the expense section debit-normal.
    select coalesce(sum(case when j.account_type in ('income', 'other_income') then j.credit_total - j.debit_total else 0 end), 0),
           coalesce(sum(case when j.account_type in ('income', 'other_income') then 0 else j.debit_total - j.credit_total end), 0)
      into v_income, v_expense
      from public.journal_line_totals(p_portfolio_id, null, v_ids,
             array['income', 'other_income', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating'],
             v_from, v_to) j;

    select count(*) into v_wo_opened
      from public.work_orders w
     where w.archived_at is null and w.created_at >= v_start and w.created_at < v_end
       and (p_association_id is null or w.association_id = p_association_id);

    select count(*) into v_wo_completed
      from public.work_orders w
     where w.archived_at is null and w.completed_date >= v_from and w.completed_date <= v_to
       and (p_association_id is null or w.association_id = p_association_id);

    select count(*) into v_violations
      from public.violations v
     where v.archived_at is null and v.created_at >= v_start and v.created_at < v_end
       and (p_association_id is null or v.association_id = p_association_id);

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'from', v_from,
      'charged', v_charges,
      'collected', v_payments,
      'ar_total', v_ar,
      'overdue_total', v_overdue,
      'delinquent_units', v_delinquent,
      'income', v_income,
      'expense', v_expense,
      'wo_opened', v_wo_opened,
      'wo_completed', v_wo_completed,
      'violations_opened', v_violations
    ));
  end loop;

  return v_out;
end
$function$;

revoke all on function public.metrics_monthly_trend(jsonb, uuid, uuid) from public, anon;
grant execute on function public.metrics_monthly_trend(jsonb, uuid, uuid) to authenticated;
