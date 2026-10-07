-- Follow-up to 20261007050000. When that migration was applied to production
-- through the Supabase MCP, the non-breaking space inside its character class
-- was replaced by a plain space, so production's
-- portfolios_company_name_not_blank rejects spaces, tabs and newlines but not
-- a name made only of non-breaking spaces. This adds the intended rule with
-- the character written as chr(160), so it survives any copy/paste.
-- The older constraint stays (harmless; dropping it is Mirsad's call).
-- Production had 0 violating rows. Guarded; additive only: no DROP, no DELETE.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolios_company_name_visible'
      and conrelid = 'public.portfolios'::regclass
  ) then
    alter table public.portfolios
      add constraint portfolios_company_name_visible
      check (company_name ~ ('[^[:space:]' || chr(160) || ']'));
  end if;
end $$;
