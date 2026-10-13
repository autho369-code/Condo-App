-- Speed at scale: the unfiltered Receivables page reads delinquent_units once.
--
-- receivables_page_totals listed delinquent units and then called
-- receivable_unit_totals(null), which read delinquent_units again for the
-- delinquent count and balance. On the unfiltered page (no association, no
-- owner: the app passes p_totals_unit_ids = null exactly then) both reads
-- cover the same units, so the count and balance now come from the list
-- already read. Filtered pages still call receivable_unit_totals as before.
-- Same signature, result keys and value expressions; invoker, stable,
-- search_path and plan_cache_mode as before (20261011100000/110000).

create or replace function public.receivables_page_totals(
  p_association_id uuid default null,
  p_owner_unit_ids uuid[] default null,
  p_totals_unit_ids uuid[] default null
)
returns jsonb
language plpgsql
stable
set search_path to 'public'
set plan_cache_mode to 'force_generic_plan'
as $$
declare
  v_receipts jsonb;
  v_delinquent jsonb;
  v_delinquent_count integer;
  v_delinquent_balance numeric;
  v_unit_totals jsonb;
  v_open numeric;
  v_credit numeric;
  v_categories jsonb := '[]'::jsonb;
begin
  -- Cash receipts: homeowner credits are not receipts; returned (NSF)
  -- payments were never collected.
  select jsonb_build_object('count', count(*), 'amount', coalesce(sum(l.amount), 0))
    into v_receipts
    from public.receivable_payments_ledger l
   where (l.method is null or l.method <> 'credit')
     and l.reversed_at is null
     and (p_association_id is null or l.association_id = p_association_id)
     and (p_owner_unit_ids is null or l.unit_id = any (p_owner_unit_ids));

  select coalesce(jsonb_agg(jsonb_build_object(
           'unit_id', d.unit_id, 'unit_number', d.unit_number, 'association_id', d.association_id,
           'balance', d.balance, 'oldest_due', d.oldest_due) order by d.unit_id), '[]'::jsonb),
         count(*)::integer,
         coalesce(sum(d.balance), 0)
    into v_delinquent, v_delinquent_count, v_delinquent_balance
    from public.delinquent_units d
   where (p_association_id is null or d.association_id = p_association_id)
     and (p_owner_unit_ids is null or d.unit_id = any (p_owner_unit_ids));

  if p_totals_unit_ids is null and p_association_id is null and p_owner_unit_ids is null then
    -- Same expressions as receivable_unit_totals(null); delinquent_units is
    -- not read a second time.
    select coalesce(sum(ar.balance_due), 0) into v_open from public.aged_receivables ar;
    select coalesce(sum(uc.unapplied_amount), 0) into v_credit from public.v_unapplied_credits uc;
    v_unit_totals := jsonb_build_object(
      'outstanding_total', (v_open - v_credit)::numeric,
      'delinquent_count', v_delinquent_count,
      'delinquent_balance', v_delinquent_balance::numeric);
  else
    select to_jsonb(t) into v_unit_totals from public.receivable_unit_totals(p_totals_unit_ids) t;
  end if;

  if p_association_id is null and p_owner_unit_ids is null then
    select coalesce(jsonb_agg(c), '[]'::jsonb)
      into v_categories
      from (select v.category_id,
                   min(v.category_name) as category_name,
                   sum(v.charge_count) as charge_count,
                   sum(v.outstanding_balance) as outstanding_balance
              from public.v_charges_by_category v
             group by v.category_id) c;
  end if;

  return jsonb_build_object(
    'receipts', v_receipts,
    'delinquent', v_delinquent,
    'unit_totals', v_unit_totals,
    'categories', v_categories
  );
end
$$;

revoke all on function public.receivables_page_totals(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.receivables_page_totals(uuid, uuid[], uuid[]) to authenticated;
