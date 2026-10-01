-- Financial Diagnostics parity (AppFolio: "Homeowners With Unused
-- Prepayments / Open Charges / Open Credits"): flag units that have money
-- received but not applied while charges are still open — the credit should
-- be applied to those charges. The existing check only flags a net credit
-- balance, which misses this case whenever open charges are larger.

create or replace function public.app_scan_unapplied_credits(p_portfolio_id uuid)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unapplied_credit_open_charges', 'unit', x.unit_id, 'warning',
         'Unit ' || x.unit_number || ' has ' || to_char(x.unapplied, 'FM$999,999,990.00') || ' unapplied while '
           || to_char(x.open_charges, 'FM$999,999,990.00') || ' in charges is open — apply the credit'
    from (
      select u.id as unit_id, u.unit_number,
             (select coalesce(sum(p.amount), 0) from public.payments p where p.unit_id = u.id)
               - (select coalesce(sum(pa.amount_applied), 0) from public.payment_applications pa
                    join public.payments p on p.id = pa.payment_id where p.unit_id = u.id) as unapplied,
             (select coalesce(sum(c.amount), 0) from public.charges c where c.unit_id = u.id)
               - (select coalesce(sum(pa.amount_applied), 0) from public.payment_applications pa
                    join public.charges c on c.id = pa.charge_id where c.unit_id = u.id) as open_charges
        from public.units u
        join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id
       where a.portfolio_id = p_portfolio_id and a.archived_at is null and u.archived_at is null
    ) x
   where x.unapplied > 0.01 and x.open_charges > 0.01
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.app_scan_unapplied_credits(uuid) from public, anon, authenticated;
grant execute on function public.app_scan_unapplied_credits(uuid) to service_role;

-- Run it as part of the nightly financial scan.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.scan_financial_diagnostics'::regproc);
  if def !~ 'select p_portfolio_id, ''vendor_insurance_expiring''' then
    raise exception 'diagnostic_unapplied_credits: scan_financial_diagnostics drifted';
  end if;
  def := regexp_replace(def,
    '(\n\s*insert into public\.data_diagnostics \(portfolio_id, category, entity_type, entity_id, severity, title\)\s*\n\s*select p_portfolio_id, ''vendor_insurance_expiring'')',
    chr(10) || '  perform public.app_scan_unapplied_credits(p_portfolio_id);' || chr(10) || '\1');
  if def !~ 'app_scan_unapplied_credits' then
    raise exception 'diagnostic_unapplied_credits: hook not inserted';
  end if;
  execute def;
end $$;
