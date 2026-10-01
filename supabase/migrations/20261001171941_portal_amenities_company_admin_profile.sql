-- 1. Owners/residents could not read association_amenities (staff-only
--    policies), so the portal Amenities page was always empty and booking
--    failed with "Amenity not found". Residents may read their own
--    associations' amenities.
drop policy if exists assoc_amenities_resident_read on public.association_amenities;
create policy assoc_amenities_resident_read on public.association_amenities
  for select to authenticated
  using ((public.is_portal_resident() and association_id in (select public.current_resident_association_ids()))
      or (public.is_tenant_user() and association_id in (select public.current_tenant_association_ids())));

-- 2. Company-admin Settings: the only portfolios write policy requires
--    full-access staff, so a company admin's profile save matched 0 rows and
--    silently did nothing. Rather than open the whole row (tier, suspension,
--    entitlements), allow exactly the profile fields through this function.
create or replace function public.update_company_profile(
  p_company_name text,
  p_phone_number text,
  p_address_street text,
  p_address_city text,
  p_address_state text,
  p_address_zip text,
  p_support_email text,
  p_brand_color text
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_portfolio uuid := public.current_portfolio_id();
begin
  if auth.uid() is null or v_portfolio is null
     or not (public.is_company_admin() or public.is_full_access_staff() or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_company_name, '')), '') is null then
    raise exception 'Company name is required' using errcode = '22023';
  end if;
  if p_brand_color is not null and p_brand_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Brand color must be a hex color like #10B981' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_support_email, '')), '') is not null
     and p_support_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid support email' using errcode = '22023';
  end if;

  update public.portfolios
     set company_name   = left(btrim(p_company_name), 200),
         phone_number   = nullif(btrim(coalesce(p_phone_number, '')), ''),
         address_street = nullif(btrim(coalesce(p_address_street, '')), ''),
         address_city   = nullif(btrim(coalesce(p_address_city, '')), ''),
         address_state  = nullif(btrim(coalesce(p_address_state, '')), ''),
         address_zip    = nullif(btrim(coalesce(p_address_zip, '')), ''),
         support_email  = nullif(lower(btrim(coalesce(p_support_email, ''))), ''),
         brand_color    = coalesce(p_brand_color, brand_color),
         updated_at     = now()
   where id = v_portfolio;
  if not found then raise exception 'Portfolio not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.update_company_profile(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_company_profile(text, text, text, text, text, text, text, text) to authenticated;

-- 3. Company-admin Audit Logs were always empty: the tenant read policy
--    required is_any_staff(). Company admins read their own portfolio's log.
drop policy if exists audit_logs_tenant_read on public.audit_logs;
create policy audit_logs_tenant_read on public.audit_logs
  for select to authenticated
  using (((select auth.uid()) is not null)
         and (public.is_any_staff() or public.is_company_admin())
         and portfolio_id = public.current_portfolio_id());
