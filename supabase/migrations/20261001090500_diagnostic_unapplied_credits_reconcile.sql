-- #106 review: each scan reconciles this check's warnings — rows that no
-- longer apply (credit applied, or the amounts changed) are resolved before
-- current ones are added, so the page never shows stale amounts or
-- duplicates. One-cent balances count (> 0.005, like v_unapplied_credits).
create or replace function public.app_scan_unapplied_credits(p_portfolio_id uuid)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare n integer;
begin
  create temporary table if not exists _unapplied_now (unit_id uuid, title text) on commit drop;
  delete from _unapplied_now;
  insert into _unapplied_now (unit_id, title)
  select x.unit_id,
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
   where x.unapplied > 0.005 and x.open_charges > 0.005;

  update public.data_diagnostics d
     set resolved_at = now()
   where d.portfolio_id = p_portfolio_id and d.category = 'unapplied_credit_open_charges' and d.resolved_at is null
     and not exists (select 1 from _unapplied_now c where c.unit_id = d.entity_id and c.title = d.title);

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unapplied_credit_open_charges', 'unit', c.unit_id, 'warning', c.title from _unapplied_now c
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.app_scan_unapplied_credits(uuid) from public, anon, authenticated;
grant execute on function public.app_scan_unapplied_credits(uuid) to service_role;
