-- Tenant workspace provisioning and public host resolution hardening.

create or replace function public.generate_portfolio_slug()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_base text;
  v_candidate text;
  v_suffix text;
  v_counter integer := 1;
begin
  if new.slug is not null and btrim(new.slug) <> '' then
    return new;
  end if;

  v_base := lower(regexp_replace(coalesce(new.company_name, ''), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  v_base := rtrim(left(v_base, 32), '-');
  if v_base = '' then v_base := 'company'; end if;

  -- These labels are platform infrastructure or common service hostnames and
  -- must never be assigned to a management company.
  if v_base = any (array['www', 'app', 'api', 'admin', 'assets', 'help', 'mail', 'status', 'support', 'staging', 'preview', 'portier369']) then
    v_base := rtrim(left('company-' || v_base, 32), '-');
  end if;

  -- Serialize only portfolios competing for the same base. The unique index
  -- remains the final backstop, while this lock lets concurrent provisioning
  -- choose deterministic -2, -3, ... suffixes instead of failing.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_base, 0));

  v_candidate := v_base;
  while exists (select 1 from public.portfolios p where p.slug = v_candidate) loop
    v_counter := v_counter + 1;
    v_suffix := '-' || v_counter::text;
    v_candidate := rtrim(left(v_base, 32 - char_length(v_suffix)), '-') || v_suffix;
  end loop;

  new.slug := v_candidate;
  return new;
end;
$function$;

revoke all on function public.generate_portfolio_slug() from anon, authenticated;

create or replace function public.tenant_branding(p_host text default null, p_slug text default null)
returns table (
  id uuid,
  company_name text,
  logo_url text,
  brand_color text,
  support_email text,
  support_phone text,
  public_website text,
  slug text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select p.id, p.company_name, p.logo_url, p.brand_color,
         p.support_email, p.support_phone, p.public_website, p.slug
    from public.portfolios p
   where p.archived_at is null
     and (
       (p_host is not null and lower(p.custom_domain) = lower(split_part(p_host, ':', 1)))
       or (p_slug is not null and p.slug = lower(p_slug))
     )
   order by (p_host is not null and lower(p.custom_domain) = lower(split_part(p_host, ':', 1))) desc
   limit 1;
$function$;

revoke all on function public.tenant_branding(text, text) from public;
grant execute on function public.tenant_branding(text, text) to anon, authenticated, service_role;
