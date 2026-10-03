-- Data fix: one legacy journal entry (1a000000-…-0003, 2026-06-05, "Lakefront
-- Maintenance bills") accrued two bills together with no link to either:
-- LM-2041 ($850, approved) and LM-2050 ($1,200, still pending approval).
-- Paying LM-2041 would have accrued it a second time, and LM-2050 was on the
-- books before anyone approved it. The legacy entry is reversed on its own
-- date, and LM-2041 gets the standard per-bill accrual on its bill date.
-- LM-2050 accrues when it is approved. Safe to run more than once.
do $$
declare
  v_legacy uuid := '1a000000-0000-0000-0000-000000000003';
  v_rev uuid;
  r public.journal_entries;
begin
  select * into r from public.journal_entries where id = v_legacy and source_type = 'bill';
  if not found then return; end if;
  if exists (select 1 from public.journal_entries where source_type = 'legacy_bill_reversal' and source_id = v_legacy) then return; end if;

  insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, created_by, posted, posted_at)
  values (r.portfolio_id, r.entry_date, 'Reversal: ' || r.description,
          'Replaced by per-bill accruals (LM-2041 accrued on its bill date; LM-2050 accrues on approval)',
          r.reference_number, 'legacy_bill_reversal', v_legacy, r.created_by, true, now())
  returning id into v_rev;
  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  select v_rev, jl.association_id, jl.gl_account_id, jl.credit_amount, jl.debit_amount, 'Reversal of legacy bill accrual', jl.sort_order
    from public.journal_lines jl where jl.entry_id = v_legacy;

  if exists (select 1 from public.payable_bills where id = '1eb8cd20-d7dd-48fa-b77b-7a257b81cad1' and status = 'approved') then
    perform public.ensure_payable_bill_accrual('1eb8cd20-d7dd-48fa-b77b-7a257b81cad1');
  end if;
end $$;
