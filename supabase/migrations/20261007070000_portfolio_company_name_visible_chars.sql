-- portfolios_company_name_visible (20261007060000) refuses names made only of
-- whitespace or non-breaking spaces, but a name made only of invisible
-- characters (zero-width spaces/joiners, BOM, soft hyphen, bidi marks,
-- variation selectors, Hangul fillers, tag characters...) still passes and
-- would head every client page and email as a blank. This adds the stricter
-- rule. The class is exactly the code points the application treats as
-- invisible in hasVisibleText (lib/company-admin/settings.ts), i.e. JS
--   /[\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u
-- generated from it as code-point ranges;
-- tests/platform/company-name-visible-sql.test.ts keeps the two in sync.
-- Every character is written with chr(n) so the class survives copy/paste and
-- the MCP, and it doesn't depend on the collation.
-- Guarded; additive only: no DROP, no DELETE. The older two constraints stay.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolios_company_name_visible_chars'
      and conrelid = 'public.portfolios'::regclass
  ) then
    execute format(
      'alter table public.portfolios add constraint portfolios_company_name_visible_chars check (company_name ~ %L)',
      '[^'
        || chr(9) || '-' || chr(13) || chr(32) || chr(160) || chr(173) || chr(847)
        || chr(1536) || '-' || chr(1541) || chr(1564) || chr(1757) || chr(1807)
        || chr(2192) || '-' || chr(2193) || chr(2274) || chr(4447) || '-' || chr(4448)
        || chr(5760) || chr(6068) || '-' || chr(6069) || chr(6155) || '-' || chr(6159)
        || chr(8192) || '-' || chr(8207) || chr(8232) || '-' || chr(8239)
        || chr(8287) || '-' || chr(8303) || chr(12288) || chr(12644)
        || chr(65024) || '-' || chr(65039) || chr(65279) || chr(65440)
        || chr(65520) || '-' || chr(65531) || chr(69821) || chr(69837)
        || chr(78896) || '-' || chr(78911) || chr(113824) || '-' || chr(113827)
        || chr(119155) || '-' || chr(119162) || chr(917504) || '-' || chr(921599)
        || ']'
    );
  end if;
end $$;
