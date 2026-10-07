-- portfolios_company_name_visible (20261007060000) refuses names made only of
-- whitespace or non-breaking spaces, but a name made only of invisible format
-- characters (zero-width space/joiners, word joiner, BOM, soft hyphen,
-- Mongolian vowel separator, bidi marks) still passes and would head every
-- client page and email as a blank. This adds the stricter rule; the
-- application checks the same thing (hasVisibleText in
-- lib/company-admin/settings.ts). Every invisible character is written with
-- chr(n) so the class survives copy/paste and the MCP.
--   173 soft hyphen · 6158 Mongolian vowel separator · 8203-8207 zero-width
--   space/non-joiner/joiner, LRM, RLM · 8234-8238 bidi embeddings ·
--   8288-8292 word joiner, invisible operators · 8294-8303 bidi isolates and
--   deprecated format chars · 65279 BOM · 160 no-break space
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
        || chr(65279) || ']'
    );
  end if;
end $$;
