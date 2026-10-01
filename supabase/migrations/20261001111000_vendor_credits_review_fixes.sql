-- Vendor credits review fixes:
-- 1. enter_vendor_credit rejects the association's resolved A/P account (legacy
--    liability-typed "2000 Accounts Payable" slipped past the type guard).
-- 2. Vendor ledger report shows entered credits as debits (applications are not
--    re-counted: checks already pay amount - credit_applied).
-- 3. remaining_amount column so open credits can be queried without a row cap.

do $$
declare
  v_def text := pg_get_functiondef('public.enter_vendor_credit(uuid, uuid, date, uuid, numeric, text, text)'::regprocedure);
  v_old text := 'if v_ap is null then raise exception ''No Accounts Payable account is set up for this association'' using errcode = ''22023''; end if;';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'vendor_credits_review_fixes: enter_vendor_credit drifted';
  end if;
  execute replace(v_def, v_old, v_old || chr(10) ||
    '  if v_gl.id = v_ap then raise exception ''Choose the account the credit reduces (usually the original expense)'' using errcode = ''22023''; end if;');
end $$;

create or replace function public.report_data_vendor_ledger(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select v.name as vendor, x.txn_date, x.txn_type, x.reference, x.association, x.debit, x.credit
      from (select b.vendor_id, b.bill_date as txn_date, 'Bill' as txn_type, b.bill_number as reference, a.name as association,
                   0::numeric as debit, b.amount as credit, b.portfolio_id, b.association_id
            from public.payable_bills b left join public.associations a on a.id = b.association_id
            where b.archived_at is null and b.status::text <> 'void'
            union all
            select pc.vendor_id, pc.payment_date, 'Payment', pc.check_number::text, a.name, pc.amount, 0::numeric, pc.portfolio_id, pc.association_id
            from public.payable_checks pc left join public.associations a on a.id = pc.association_id
            where pc.voided_at is null
            union all
            select vc.vendor_id, vc.credit_date, 'Vendor credit', vc.reference, a.name, vc.amount, 0::numeric, vc.portfolio_id, vc.association_id
            from public.vendor_credits vc left join public.associations a on a.id = vc.association_id) x
      cross join prm join public.vendors v on v.id = x.vendor_id
      where x.portfolio_id = p_portfolio_id and (prm.aid is null or x.association_id = prm.aid) and x.txn_date between prm.df and prm.dt
      order by v.name, x.txn_date
  ) r;
$function$;

alter table public.vendor_credits
  add column if not exists remaining_amount numeric(12, 2) generated always as (amount - applied_amount) stored;
