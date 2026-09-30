-- #81 review follow-up (P2): a private tax/bank row could be re-pointed to a
-- different vendor by updating vendor_id; the flag trigger only updated the
-- new vendor, leaving the old one showing "TIN / bank on file". The vendor a
-- row belongs to is now fixed — delete and re-create instead.
create or replace function public.vendor_financial_details_bind_portfolio()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  if tg_op = 'UPDATE' and new.vendor_id is distinct from old.vendor_id then
    raise exception 'A vendor''s tax and bank record can''t be moved to another vendor' using errcode = '22023';
  end if;
  select portfolio_id into v_portfolio from public.vendors where id = new.vendor_id;
  if v_portfolio is null then
    raise exception 'Vendor not found' using errcode = '23503';
  end if;
  new.portfolio_id := v_portfolio;
  return new;
end $$;
