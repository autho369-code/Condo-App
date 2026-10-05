-- Board meeting financial snapshot: count delinquent units from the ledger.
--
-- The previous body counted occupancies.dues_paid_through, which is never
-- populated, so delinquency_count was always 0. Delinquency is now counted the
-- same way the delinquent_units view does it: a unit with a positive balance
-- AND at least one charge with an open balance that is past due (association
-- local date). Signature, return shape, SECURITY DEFINER, search_path and the
-- authorization checks are unchanged; grants are re-asserted below.

CREATE OR REPLACE FUNCTION public.get_meeting_financial_snapshot(p_association_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_total_receivables numeric := 0;
  v_total_payables numeric := 0;
  v_delinquency_count integer := 0;
  v_bank_balance numeric := 0;
  v_current_month_income numeric := 0;
  v_current_month_expenses numeric := 0;
begin
  if auth.uid() is null or p_association_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association' using errcode = '42501';
  end if;

  select coalesce(sum(greatest(coalesce(ub.balance, 0), 0)), 0)
  into v_total_receivables
  from public.unit_balances ub
  where ub.association_id = p_association_id;

  select coalesce(sum(pb.amount - pb.credit_applied), 0)
  into v_total_payables
  from public.payable_bills pb
  where pb.association_id = p_association_id
    and pb.archived_at is null
    and pb.status = 'approved';

  select count(distinct du.unit_id)::integer
  into v_delinquency_count
  from public.delinquent_units du
  where du.association_id = p_association_id;

  select coalesce(sum(jl.debit_amount - jl.credit_amount), 0)
  into v_bank_balance
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  where je.posted
    and jl.association_id = p_association_id
    and exists (
      select 1
      from public.bank_accounts ba
      join public.associations a
        on a.id = ba.association_id
       and a.portfolio_id = ba.portfolio_id
      where ba.association_id = p_association_id
        and ba.archived_at is null
        and ba.gl_account_id = jl.gl_account_id
        and je.portfolio_id = a.portfolio_id
    );

  select coalesce(sum(c.amount), 0)
  into v_current_month_income
  from public.charges c
  join public.units u on u.id = c.unit_id
  join public.buildings b on b.id = u.building_id
  where b.association_id = p_association_id
    and c.created_at >= date_trunc('month', pg_catalog.now());

  select coalesce(sum(pb.amount), 0)
  into v_current_month_expenses
  from public.payable_bills pb
  where pb.association_id = p_association_id
    and pb.archived_at is null
    and pb.occurred_on >= date_trunc('month', pg_catalog.now())::date
    and pb.status in ('paid', 'approved');

  return jsonb_build_object(
    'total_receivables', v_total_receivables,
    'total_payables', v_total_payables,
    'delinquency_count', v_delinquency_count,
    'bank_balance', v_bank_balance,
    'current_month_income', v_current_month_income,
    'current_month_expenses', v_current_month_expenses,
    'net_income', v_current_month_income - v_current_month_expenses,
    'generated_at', pg_catalog.now()
  );
end;
$function$;

revoke all on function public.get_meeting_financial_snapshot(uuid) from public, anon;
grant execute on function public.get_meeting_financial_snapshot(uuid) to authenticated, service_role;
