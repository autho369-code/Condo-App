-- Inspections list: each inspection's score and open flags in the database.
--
-- The page loaded every inspection finding ever recorded (paged, up to
-- 50,000) to score each inspection, and hid all scores past that (a company
-- with ~1,000 inspections a year of ~20 findings reaches it in under three
-- years). This returns one row per inspection with findings:
--   score - the rounded average of the findings' severity points (info 100,
--           minor 80, moderate 60, major 40, critical 20), over findings
--           with one of those severities; null when none has one
--   flags - findings not resolved yet
-- exactly as computeScore and the flag count in
-- app/(app)/inspections/page.tsx did.
--
-- Runs as the caller (row-level security applies to inspection_items);
-- plans are reused per connection.

create or replace function public.inspection_item_scores()
returns table (
  inspection_id uuid,
  score integer,
  flags integer
)
language plpgsql
stable
set search_path to 'public'
set plan_cache_mode = force_generic_plan
as $function$
begin
  return query
  select i.inspection_id,
         round(avg(case i.severity::text
                     when 'info' then 100
                     when 'minor' then 80
                     when 'moderate' then 60
                     when 'major' then 40
                     when 'critical' then 20
                   end))::integer,
         (count(*) filter (where not coalesce(i.resolved, false)))::integer
    from public.inspection_items i
   group by i.inspection_id;
end
$function$;

revoke all on function public.inspection_item_scores() from public, anon;
grant execute on function public.inspection_item_scores() to authenticated;
