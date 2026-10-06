-- Workspace addresses (<slug>.<apex>, like a client's own AppFolio address).
-- Every company already gets a slug from its name at creation. This adds a
-- safe way for a platform admin to change it:
--  * portfolio_slug_aliases keeps every retired address, so links already
--    emailed under the old address keep working (middleware forwards them to
--    the current address) and no other company can ever take it.
--  * platform_set_portfolio_slug validates and swaps the address atomically.
--  * tenant_branding resolves a retired address to its company and returns the
--    current slug, so the middleware can redirect.
--  * New companies are never auto-assigned a retired address.
-- Additive only: nothing is dropped or deleted.

create table if not exists public.portfolio_slug_aliases (
  slug text primary key
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$'),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  retired_at timestamptz not null default now()
);

create index if not exists portfolio_slug_aliases_portfolio_idx
  on public.portfolio_slug_aliases (portfolio_id);

alter table public.portfolio_slug_aliases enable row level security;

create policy portfolio_slug_aliases_platform_read on public.portfolio_slug_aliases
  for select to authenticated using (public.is_platform_operator());

revoke all on public.portfolio_slug_aliases from anon, authenticated;
grant select on public.portfolio_slug_aliases to authenticated;

-- Labels that are platform infrastructure; never a company address.
create or replace function public.reserved_portfolio_slug(p_slug text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  select p_slug = any (array['www', 'app', 'api', 'admin', 'assets', 'help', 'mail', 'status',
                             'support', 'staging', 'preview', 'portier369']);
$function$;

create or replace function public.platform_set_portfolio_slug(p_portfolio_id uuid, p_slug text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_old text;
begin
  if not (public.is_platform_operator() and public.is_platform_admin()) then
    raise exception 'Platform administrator access is required.' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$' then
    raise exception 'Use 2 to 32 lowercase letters, numbers or hyphens, starting and ending with a letter or number.'
      using errcode = '22023';
  end if;
  if public.reserved_portfolio_slug(v_slug) then
    raise exception '"%" is reserved. Choose another address.', v_slug using errcode = '22023';
  end if;

  -- One lock for every address assignment (this function and the new-company
  -- trigger, which may pick a numbered variant such as acme-2), so two
  -- assignments can never race for the same address. Both are rare.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portfolio_slug_assignment', 0));

  select slug into v_old from public.portfolios where id = p_portfolio_id for update;
  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;
  if v_old = v_slug then
    return v_slug;
  end if;

  if exists (select 1 from public.portfolios where slug = v_slug and id <> p_portfolio_id) then
    raise exception '"%" is already another company''s address.', v_slug using errcode = '23505';
  end if;
  if exists (select 1 from public.portfolio_slug_aliases where slug = v_slug and portfolio_id <> p_portfolio_id) then
    raise exception '"%" was another company''s address and stays reserved for its old links.', v_slug
      using errcode = '23505';
  end if;

  -- Keep the old address for this company (its emailed links keep working).
  if v_old is not null then
    insert into public.portfolio_slug_aliases (slug, portfolio_id)
    values (v_old, p_portfolio_id)
    on conflict (slug) do update set retired_at = now()
      where public.portfolio_slug_aliases.portfolio_id = excluded.portfolio_id;
  end if;

  update public.portfolios set slug = v_slug where id = p_portfolio_id;
  return v_slug;
end;
$function$;

revoke execute on function public.platform_set_portfolio_slug(uuid, text) from public, anon;
grant execute on function public.platform_set_portfolio_slug(uuid, text) to authenticated;

-- Current addresses win; a retired address resolves to its company with the
-- company's current slug (the middleware redirects to it).
create or replace function public.tenant_branding(p_host text default null, p_slug text default null)
returns table(id uuid, company_name text, logo_url text, brand_color text, support_email text,
              support_phone text, public_website text, slug text)
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select p.id, p.company_name, p.logo_url, p.brand_color,
         p.support_email, p.support_phone, p.public_website, p.slug
    from public.portfolios p
   where p.archived_at is null
     and (
       (p_host is not null and lower(p.custom_domain) = lower(split_part(p_host, ':', 1)))
       or (p_slug is not null and p.slug = lower(p_slug))
       or (p_slug is not null and exists (
             select 1 from public.portfolio_slug_aliases a
              where a.portfolio_id = p.id and a.slug = lower(p_slug)))
     )
   order by (p_host is not null and lower(p.custom_domain) = lower(split_part(p_host, ':', 1))) desc,
            (p_slug is not null and p.slug = lower(p_slug)) desc
   limit 1;
$function$;

-- New companies: same slug rules as before, and never a retired address.
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

  if public.reserved_portfolio_slug(v_base) then
    v_base := rtrim(left('company-' || v_base, 32), '-');
  end if;

  -- Shared with platform_set_portfolio_slug: covers every candidate checked
  -- below, numbered variants included.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portfolio_slug_assignment', 0));

  v_candidate := v_base;
  while exists (select 1 from public.portfolios p where p.slug = v_candidate)
     or exists (select 1 from public.portfolio_slug_aliases a where a.slug = v_candidate) loop
    v_counter := v_counter + 1;
    v_suffix := '-' || v_counter::text;
    v_candidate := rtrim(left(v_base, 32 - char_length(v_suffix)), '-') || v_suffix;
  end loop;

  new.slug := v_candidate;
  return new;
end;
$function$;
