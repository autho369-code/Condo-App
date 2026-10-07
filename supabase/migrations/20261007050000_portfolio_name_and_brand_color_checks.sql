-- Two guards on public.portfolios:
--
-- 1. company_name must contain a visible character. It heads every
--    client-facing page, email and document; the old check (length 1-200)
--    let a whitespace-only name through (spaces, tabs, newlines or non-breaking
--    spaces), which then showed blank or as the neutral substitute.
-- 2. brand_color must be #RRGGBB (or null). Middleware sends it to every page
--    as a request header; anything else could break the company's whole
--    workspace. The Company Admin RPC already enforced this; the manager
--    Branding page did not.
--
-- The settings, branding and company-admin actions now validate both too.
-- Production had 1 portfolio, 0 blank names and 0 non-hex colors when this
-- was written, so both are validated immediately; guarded so a re-run doesn't
-- fail. Additive only: no DROP, no DELETE.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolios_company_name_not_blank'
      and conrelid = 'public.portfolios'::regclass
  ) then
    alter table public.portfolios
      add constraint portfolios_company_name_not_blank
      check (company_name ~ '[^[:space:] ]');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolios_brand_color_hex'
      and conrelid = 'public.portfolios'::regclass
  ) then
    alter table public.portfolios
      add constraint portfolios_brand_color_hex
      check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
