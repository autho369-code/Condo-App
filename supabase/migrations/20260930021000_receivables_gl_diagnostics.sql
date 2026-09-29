-- Nightly integrity checks for the receivables → GL posting added in
-- post_receivables_to_gl: flag charges/payments that never reached the
-- ledger, and associations whose GL accounts receivable no longer equals the
-- owner sub-ledger (charges − payments). Existing checks are unchanged.

create or replace function public.scan_financial_diagnostics(p_portfolio_id uuid)
returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer := 0; m integer := 0;
begin
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'reconciliation_lapsed', 'bank_account', ba.id, 'error',
         'Bank account ' || ba.name || ' not reconciled in ' || (current_date - coalesce(ba.last_reconciliation_date, ba.created_at::date))::text || ' days'
    from public.bank_accounts ba
   where ba.portfolio_id = p_portfolio_id
     and ba.archived_at is null
     and (ba.last_reconciliation_date is null or ba.last_reconciliation_date < current_date - interval '60 days')
  on conflict do nothing;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unused_prepayment', 'unit', u.id, 'info',
         'Unit ' || u.unit_number || ' has credit balance of ' || to_char(-ub.balance, 'FM$999,999.00')
    from public.unit_balances ub
    join public.units u on u.id = ub.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id and ub.balance < -0.01
  on conflict do nothing;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'vendor_insurance_expiring', 'vendor', v.id, 'warning',
         'Vendor ' || v.name || ' has insurance expiring within 30 days'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id and v.archived_at is null
     and ((vc.workers_comp_expiration between current_date and current_date + interval '30 days')
          or (vc.general_liability_expiration between current_date and current_date + interval '30 days')
          or (vc.auto_insurance_expiration between current_date and current_date + interval '30 days'))
  on conflict do nothing;
  get diagnostics n = row_count;

  -- Owner charges / payments missing from the general ledger.
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title, details)
  select p_portfolio_id, 'receivable_not_posted', 'association', a.id, 'error',
         a.name || ': owner charges or payments are missing from the general ledger',
         x.n || ' charge(s)/payment(s) have no journal entry. Run backfill_receivables_to_gl for this association after review.'
    from public.associations a
    join lateral (
      select (select count(*) from public.charges c
                where public.unit_association_id(c.unit_id) = a.id
                  and not exists (select 1 from public.journal_entries je where je.source_type = 'charge' and je.source_id = c.id))
           + (select count(*) from public.payments p
                where public.unit_association_id(p.unit_id) = a.id
                  and not exists (select 1 from public.journal_entries je where je.source_type = 'payment' and je.source_id = p.id)) as n
    ) x on true
   where a.portfolio_id = p_portfolio_id and a.archived_at is null and x.n > 0
  on conflict do nothing;
  get diagnostics m = row_count; n := n + m;

  -- GL accounts receivable vs the owner sub-ledger.
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title, details)
  select p_portfolio_id, 'receivables_gl_mismatch', 'association', a.id, 'warning',
         a.name || ': GL accounts receivable does not match owner balances',
         'GL accounts receivable ' || to_char(x.gl, 'FM$999,999,990.00') || ' vs owner balances ' || to_char(x.sub, 'FM$999,999,990.00')
           || ' (difference ' || to_char(x.gl - x.sub, 'FM$999,999,990.00') || '). Look for manual journal entries to A/R.'
    from public.associations a
    join lateral (
      select coalesce((select sum(jl.debit_amount - jl.credit_amount)
                         from public.journal_lines jl
                         join public.journal_entries je on je.id = jl.entry_id and je.posted
                         join public.gl_accounts g on g.id = jl.gl_account_id and g.account_type::text = 'accounts_receivable' and g.name not ilike '%allowance%'
                        where jl.association_id = a.id), 0) as gl,
             coalesce((select sum(c.amount) from public.charges c where public.unit_association_id(c.unit_id) = a.id), 0)
           - coalesce((select sum(p.amount) from public.payments p where public.unit_association_id(p.unit_id) = a.id), 0) as sub
    ) x on true
   where a.portfolio_id = p_portfolio_id and a.archived_at is null and abs(x.gl - x.sub) > 0.01
  on conflict do nothing;
  get diagnostics m = row_count; n := n + m;

  return n;
end $$;
