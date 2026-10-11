-- Metrics page (/metrics): its month-by-month figures in one call.
--
-- The page asked the database six questions per month (billing and
-- collections, receivables at month end, income and expense, work orders
-- opened and completed, violations opened): 72 requests for 12 months. They
-- queued behind the API's few connections; the page took 5-9 s two months at
-- a time and timed out all at once. Run inside the database the same
-- questions take ~1.5 s for 12 months in total.
--
-- This function answers them for every month the page sends, using the same
-- functions and filters the page used (billing_collection_totals,
-- receivable_summary_as_of, journal_line_totals, and counts on work_orders
-- and violations). Security invoker: every caller sees exactly what their
-- policies allow. p_months is the page's month list (it works out each
-- month in the company's time zone): [{from, to, start, end}], dates for
-- from/to and timestamps for the start and end of the month.

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
begin
  if jsonb_typeof(p_months) is distinct from 'array' or jsonb_array_length(p_months) > 36 then
    raise exception 'p_months must be a list of at most 36 months' using errcode = '22023';
  end if;

  for m in select value from jsonb_array_elements(p_months) loop
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
    select coalesce(sum(r.ar_total), 0), coalesce(sum(r.overdue_total), 0), coalesce(sum(r.delinquent_units), 0)
      into v_ar, v_overdue, v_delinquent
      from public.receivable_summary_as_of(v_ids, v_to, v_end) r;

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
