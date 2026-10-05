-- Company Settings saved the logo URL to portfolio_settings.logo_url, which
-- nothing reads; every shell (sidebar, portals, tenant branding) reads
-- portfolios.logo_url. Company admins cannot update portfolios directly (RLS
-- only lets full-access managers / platform admins update the row, and a
-- direct update silently matches 0 rows), so the logo goes through a
-- SECURITY DEFINER RPC with the same gate as update_company_profile.

create or replace function public.update_company_logo(p_logo_url text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_portfolio uuid := public.current_portfolio_id();
  v_url text := nullif(btrim(coalesce(p_logo_url, '')), '');
begin
  if auth.uid() is null or v_portfolio is null
     or not (public.is_company_admin() or public.is_full_access_staff() or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if v_url is not null and v_url !~* '^https?://[^\s]+$' then
    raise exception 'Logo URL must be a full http(s) address' using errcode = '22023';
  end if;
  if v_url is not null and length(v_url) > 2000 then
    raise exception 'Logo URL is too long' using errcode = '22023';
  end if;

  update public.portfolios
     set logo_url   = v_url,
         updated_at = now()
   where id = v_portfolio;
  if not found then raise exception 'Portfolio not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.update_company_logo(text) from public, anon;
grant execute on function public.update_company_logo(text) to authenticated;
