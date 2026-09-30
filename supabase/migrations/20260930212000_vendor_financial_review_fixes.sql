-- Review fixes for #81 (vendor_financial_details + invitation hardening 2).
-- 1. assemble_vendor_1099_data now reads private TINs: make sure no client
--    role can execute it (it is only for service jobs) and refuse callers
--    without finance access even if a grant is ever restored.
-- 2. The transition trigger (vendors legacy columns -> private table) runs as
--    definer. Non-finance callers may no longer change the legacy columns at
--    all, so nothing unauthorized can be copied across.
-- 3. vendor_financial_details.portfolio_id is always taken from the vendor,
--    so a row can't claim another company's vendor under the caller's own
--    portfolio (RLS WITH CHECK sees the corrected value).
-- 4. accept_invitation replaces the caller's association-manager rows with the
--    invitation's exact list (narrowing invites narrow; unscoped invites clear
--    old scopes).

revoke execute on function public.assemble_vendor_1099_data(uuid, integer) from public, anon, authenticated;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.assemble_vendor_1099_data(uuid, integer)'::regprocedure);
  if position('      where v.portfolio_id = p_portfolio_id' in def) = 0 then
    raise exception 'vendor_financial_review_fixes: assemble_vendor_1099_data drifted';
  end if;
  def := replace(def, '      where v.portfolio_id = p_portfolio_id',
    '      where v.portfolio_id = p_portfolio_id' || chr(10) ||
    '        and (auth.uid() is null or public.can_manage_finance(p_portfolio_id) or public.is_platform_operator())');
  execute def;
end $$;

create or replace function public.vendors_guard_legacy_financials()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or public.is_platform_operator() or public.can_manage_finance(old.portfolio_id) then
    return new;
  end if;
  if new.taxpayer_id is distinct from old.taxpayer_id
     or new.tax_account_number is distinct from old.tax_account_number
     or new.bank_routing_number is distinct from old.bank_routing_number
     or new.bank_account_number is distinct from old.bank_account_number then
    raise exception 'Only accounting staff can change a vendor''s tax or bank details' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_vendors_001_guard_legacy_financials on public.vendors;
create trigger trg_vendors_001_guard_legacy_financials before update on public.vendors
  for each row execute function public.vendors_guard_legacy_financials();

create or replace function public.vendors_guard_legacy_financials_insert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or public.is_platform_operator() or public.can_manage_finance(new.portfolio_id) then
    return new;
  end if;
  if new.taxpayer_id is not null or new.tax_account_number is not null
     or new.bank_routing_number is not null or new.bank_account_number is not null then
    raise exception 'Only accounting staff can add a vendor''s tax or bank details' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_vendors_001_guard_legacy_financials_insert on public.vendors;
create trigger trg_vendors_001_guard_legacy_financials_insert before insert on public.vendors
  for each row execute function public.vendors_guard_legacy_financials_insert();

create or replace function public.vendor_financial_details_bind_portfolio()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  select portfolio_id into v_portfolio from public.vendors where id = new.vendor_id;
  if v_portfolio is null then
    raise exception 'Vendor not found' using errcode = '23503';
  end if;
  new.portfolio_id := v_portfolio;
  return new;
end $$;
drop trigger if exists trg_vfd_000_bind_portfolio on public.vendor_financial_details;
create trigger trg_vfd_000_bind_portfolio before insert or update on public.vendor_financial_details
  for each row execute function public.vendor_financial_details_bind_portfolio();

do $$
declare def text;
begin
  def := pg_get_functiondef('public.accept_invitation(text)'::regprocedure);
  if position('  if (inv.hoa_role::text = ''manager''' in def) = 0 then
    raise exception 'vendor_financial_review_fixes: accept_invitation drifted';
  end if;
  def := replace(def, '  if (inv.hoa_role::text = ''manager''',
    '  -- The invitation defines the exact scope: drop earlier assignments first.' || chr(10) ||
    '  delete from public.association_managers where user_id = calling_user;' || chr(10) ||
    '  if (inv.hoa_role::text = ''manager''');
  execute def;
end $$;
