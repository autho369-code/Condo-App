-- Custom domains: a company's own web address (portal.stellarpropertygroup.com)
-- in place of <slug>.portier369.com. Requests on portfolios.custom_domain
-- already resolve through tenant_branding; this adds the safe way to set it.
--  * platform_set_portfolio_custom_domain validates and sets (or clears) the
--    domain. Platform admins only.
--  * portfolios_guard_platform_columns now also protects custom_domain, so a
--    company's own staff cannot point the company at an arbitrary domain (or
--    claim one another company is about to use) by updating the row directly.
-- Additive only: nothing is dropped or deleted.

create or replace function public.platform_set_portfolio_custom_domain(p_portfolio_id uuid, p_domain text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_domain text := rtrim(lower(btrim(coalesce(p_domain, ''))), '.');
  v_old text;
begin
  if not (public.is_platform_operator() and public.is_platform_admin()) then
    raise exception 'Platform administrator access is required.' using errcode = '42501';
  end if;

  select custom_domain into v_old from public.portfolios where id = p_portfolio_id for update;
  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;

  if v_domain = '' then
    update public.portfolios set custom_domain = null where id = p_portfolio_id;
    return null;
  end if;

  if char_length(v_domain) > 253
     or v_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$' then
    raise exception 'Enter a domain such as portal.yourcompany.com (no https:// and no path).'
      using errcode = '22023';
  end if;
  if v_domain = 'portier369.com' or v_domain like '%.portier369.com'
     or v_domain = 'vercel.app' or v_domain like '%.vercel.app'
     or v_domain like '%.localhost' then
    raise exception '"%" is a platform address. Use the company''s own domain.', v_domain using errcode = '22023';
  end if;

  if v_old is not distinct from v_domain then
    return v_domain;
  end if;
  if exists (select 1 from public.portfolios where lower(custom_domain) = v_domain and id <> p_portfolio_id) then
    raise exception '"%" is already another company''s domain.', v_domain using errcode = '23505';
  end if;

  update public.portfolios set custom_domain = v_domain where id = p_portfolio_id;
  return v_domain;
exception
  when unique_violation then
    raise exception '"%" is already another company''s domain.', v_domain using errcode = '23505';
end;
$function$;

revoke execute on function public.platform_set_portfolio_custom_domain(uuid, text) from public, anon;
grant execute on function public.platform_set_portfolio_custom_domain(uuid, text) to authenticated;

create or replace function public.portfolios_guard_platform_columns()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if auth.uid() is null or (public.is_platform_operator() and public.is_platform_admin()) then
    return new;
  end if;
  if new.tier is distinct from old.tier
     or new.entitlements is distinct from old.entitlements
     or new.archived_at is distinct from old.archived_at
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason
     or new.slug is distinct from old.slug
     or new.custom_domain is distinct from old.custom_domain
     or new.created_by is distinct from old.created_by then
    raise exception 'Plan, status and account identity can only be changed by Portier369 support';
  end if;
  return new;
end $function$;
