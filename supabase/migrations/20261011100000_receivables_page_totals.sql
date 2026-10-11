-- Receivables page (/charges): its totals in one call.
--
-- The page showed "Some receivables could not be loaded" (statement
-- timeouts) on most loads. It ran six queries at once over row-level-
-- security-heavy views; each takes 0.05-1 s alone (about 200 ms of that is
-- planning the views and their policies) but together several passed the
-- 8 s limit. Four of them only feed the page's totals:
--   receipts count and total (receivable_payments_ledger),
--   delinquent units (delinquent_units),
--   outstanding / delinquent totals (receivable_unit_totals),
--   charges by category (v_charges_by_category).
-- This function returns all four in one call. It is PL/pgSQL, so each
-- connection keeps the query plans between calls (first call up to ~3 s,
-- then ~80 ms), and the four run one after another instead of competing.
--
-- Security invoker, the same views and filters as the page used: every
-- caller sees exactly what their policies allow. Filters:
--   p_association_id  - the page's association filter (association_id =)
--   p_owner_unit_ids  - the page's homeowner filter (unit_id = any)
--   p_totals_unit_ids - passed to receivable_unit_totals as before
-- Charges by category are only for the unfiltered page, as before.

create or replace function public.receivables_page_totals(
  p_association_id uuid default null,
  p_owner_unit_ids uuid[] default null,
  p_totals_unit_ids uuid[] default null
)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_receipts jsonb;
  v_delinquent jsonb;
  v_unit_totals jsonb;
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
           'balance', d.balance, 'oldest_due', d.oldest_due) order by d.unit_id), '[]'::jsonb)
    into v_delinquent
    from public.delinquent_units d
   where (p_association_id is null or d.association_id = p_association_id)
     and (p_owner_unit_ids is null or d.unit_id = any (p_owner_unit_ids));

  select to_jsonb(t) into v_unit_totals from public.receivable_unit_totals(p_totals_unit_ids) t;

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
$function$;

revoke all on function public.receivables_page_totals(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.receivables_page_totals(uuid, uuid[], uuid[]) to authenticated;
