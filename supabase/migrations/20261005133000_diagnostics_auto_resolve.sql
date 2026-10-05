-- The nightly data and financial diagnostic scans only ever added findings:
-- a fixed problem (a corrected phone, a reconciled bank account, an applied
-- credit) stayed "unresolved" forever and kept inflating the month-end
-- "Unresolved diagnostics" count. Each scan now refreshes the findings it
-- still sees (last_seen_at, occurrence_count) and resolves the ones in its
-- own categories that it no longer sees. DISTINCT keeps one row per finding
-- so the upsert never touches the same row twice.

create or replace function public.scan_data_diagnostics(p_portfolio_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- Invalid phone numbers (not matching typical US format)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'invalid_phone', 'owner', o.id, 'warning'::public.diagnostic_severity,
         'Owner ' || coalesce(o.full_name,'<unknown>') || ' has unparseable phone: ' || o.phone
    from public.owners o
   where o.portfolio_id = p_portfolio_id
     and o.phone is not null
     and o.phone !~ '^\+?[0-9 ().-]{10,20}$'
     and o.archived_at is null
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;

  -- Missing owner email (preferred_comm is email but email null/empty)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'missing_email', 'owner', o.id, 'warning'::public.diagnostic_severity,
         'Owner ' || coalesce(o.full_name,'<unknown>') || ' prefers email but email is missing'
    from public.owners o
   where o.portfolio_id = p_portfolio_id
     and o.preferred_comm = 'email'
     and (o.email is null or o.email = '')
     and o.archived_at is null
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;

  -- Vendors missing taxpayer_id but send_1099 = true
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'missing_taxpayer_id', 'vendor', v.id, 'error'::public.diagnostic_severity,
         'Vendor ' || v.name || ' has send_1099=true but no taxpayer_id'
    from public.vendors v
   where v.portfolio_id = p_portfolio_id
     and v.send_1099 = true
     and not v.has_taxpayer_id
     and v.archived_at is null
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;

  -- Vendor compliance expired
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'vendor_compliance_expired', 'vendor', v.id, 'error'::public.diagnostic_severity,
         'Vendor ' || v.name || ' has expired compliance documents'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id
     and v.archived_at is null
     and (vc.workers_comp_expiration < current_date
          or vc.general_liability_expiration < current_date
          or vc.auto_insurance_expiration < current_date)
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;

  -- Units without an active occupancy (potentially vacant / data-missing)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'unit_no_current_occupancy', 'unit', u.id, 'info'::public.diagnostic_severity,
         'Unit ' || u.unit_number || ' has no current occupancy record'
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id
     and u.archived_at is null
     and not exists (select 1 from public.occupancies occ
                      where occ.unit_id = u.id and occ.status = 'current')
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;

  -- Anything this scan reported before but did not see this run is fixed.
  update public.data_diagnostics d
     set resolved_at = now()
   where d.portfolio_id = p_portfolio_id
     and d.resolved_at is null
     and d.category in ('invalid_phone', 'missing_email', 'missing_taxpayer_id',
                        'vendor_compliance_expired', 'unit_no_current_occupancy')
     and d.last_seen_at < now();

  return (select count(*) from public.data_diagnostics
          where portfolio_id = p_portfolio_id and resolved_at is null);
end;
$function$;

create or replace function public.scan_financial_diagnostics(p_portfolio_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare n integer := 0; m integer := 0;
begin
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title, details)
  select distinct p_portfolio_id, 'reconciliation_lapsed', 'bank_account', ba.id, 'error'::public.diagnostic_severity,
         'Bank account ' || ba.name || ' has not been reconciled in over 60 days',
         'Last reconciled: ' || coalesce(ba.last_reconciliation_date::text, 'never') || ' ('
           || (current_date - coalesce(ba.last_reconciliation_date, ba.created_at::date))::text || ' days ago).'
    from public.bank_accounts ba
   where ba.portfolio_id = p_portfolio_id
     and ba.archived_at is null
     and (ba.last_reconciliation_date is null or ba.last_reconciliation_date < current_date - interval '60 days')
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set details = excluded.details,
                last_seen_at = now(),
                occurrence_count = public.data_diagnostics.occurrence_count + 1;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'unused_prepayment', 'unit', u.id, 'info'::public.diagnostic_severity,
         'Unit ' || u.unit_number || ' has credit balance of ' || to_char(-ub.balance, 'FM$999,999.00')
    from public.unit_balances ub
    join public.units u on u.id = ub.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id and ub.balance < -0.01
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;
  perform public.app_scan_unapplied_credits(p_portfolio_id);

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select distinct p_portfolio_id, 'vendor_insurance_expiring', 'vendor', v.id, 'warning'::public.diagnostic_severity,
         'Vendor ' || v.name || ' has insurance expiring within 30 days'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id and v.archived_at is null
     and ((vc.workers_comp_expiration between current_date and current_date + interval '30 days')
          or (vc.general_liability_expiration between current_date and current_date + interval '30 days')
          or (vc.auto_insurance_expiration between current_date and current_date + interval '30 days'))
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;
  get diagnostics n = row_count;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title, details)
  select distinct p_portfolio_id, 'receivable_not_posted', 'association', a.id, 'error'::public.diagnostic_severity,
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
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set details = excluded.details, last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;
  get diagnostics m = row_count; n := n + m;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title, details)
  select distinct p_portfolio_id, 'receivables_gl_mismatch', 'association', a.id, 'warning'::public.diagnostic_severity,
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
  on conflict (portfolio_id, category, (coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)), title) where resolved_at is null
  do update set details = excluded.details, last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;
  get diagnostics m = row_count; n := n + m;

  -- Anything this scan reported before but did not see this run is fixed.
  -- (unapplied_credit_open_charges is resolved by app_scan_unapplied_credits.)
  update public.data_diagnostics d
     set resolved_at = now()
   where d.portfolio_id = p_portfolio_id
     and d.resolved_at is null
     and d.category in ('reconciliation_lapsed', 'unused_prepayment', 'vendor_insurance_expiring',
                        'receivable_not_posted', 'receivables_gl_mismatch')
     and d.last_seen_at < now();

  return n;
end $function$;
