-- Safe public branding lookup so anon does NOT need SELECT on the whole
-- portfolios table (which exposed ai_api_key etc.). Returns only branding cols.
create or replace function public.tenant_branding(p_host text default null, p_slug text default null)
returns table (id uuid, company_name text, logo_url text, brand_color text, support_email text, support_phone text, public_website text, slug text)
language sql stable security definer set search_path to 'pg_catalog','public' as $$
  select p.id, p.company_name, p.logo_url, p.brand_color, p.support_email, p.support_phone, p.public_website, p.slug
  from public.portfolios p
  where (p_host is not null and p.custom_domain = p_host)
     or (p_slug is not null and p.slug = p_slug)
  order by (p_host is not null and p.custom_domain = p_host) desc
  limit 1;
$$;
grant execute on function public.tenant_branding(text, text) to anon, authenticated;
