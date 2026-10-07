-- portfolios_company_name_visible (20261007060000) refuses names made only of
-- whitespace or non-breaking spaces, but a name made only of invisible format
-- characters (zero-width space/joiners, word joiner, BOM, soft hyphen,
-- Mongolian vowel separator, bidi marks) still passes and would head every
-- client page and email as a blank. This adds the stricter rule; the
-- application checks the same thing (hasVisibleText in
-- lib/company-admin/settings.ts). Every invisible character is written with
-- chr(n) so the class survives copy/paste and the MCP.
--   173 soft hyphen - 6158 Mongolian vowel separator - 8203-8207 zero-width
--   space/non-joiner/joiner, LRM, RLM - 8234-8238 bidi embeddings -
--   8288-8292 word joiner, invisible operators - 8294-8303 bidi isolates and
--   deprecated format chars - 65279 BOM - 160 no-break space - 1564 Arabic
--   letter mark - Unicode spaces (5760, 8192-8202, 8232, 8233, 8239, 8287,
--   12288) - other default-ignorable code points (listed below)
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
      '[^[:space:]' || chr(160) || chr(173) || chr(6158)
        || chr(8203) || '-' || chr(8207)
        || chr(8234) || '-' || chr(8238)
        || chr(8288) || '-' || chr(8292)
        || chr(8294) || '-' || chr(8303)
        || chr(65279) || chr(1564)
        -- Unicode spaces listed explicitly: [:space:] depends on the collation.
        || chr(5760) || chr(8192) || '-' || chr(8202)
        || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288)
        -- Other default-ignorable code points: combining grapheme joiner,
        -- Hangul fillers, Khmer inherent vowels, Mongolian variation
        -- selectors, variation selectors, U+2065, shorthand format controls,
        -- musical format controls, and the whole U+E0000-E0FFF block (tags,
        -- variation selectors supplement).
        || chr(847) || chr(4447) || chr(4448) || chr(6068) || chr(6069)
        || chr(6155) || '-' || chr(6159) || chr(8293) || chr(12644)
        || chr(65024) || '-' || chr(65039) || chr(65440)
        || chr(113824) || '-' || chr(113827) || chr(119155) || '-' || chr(119162)
        || chr(917504) || '-' || chr(921599) || ']'
    );
  end if;
end $$;
