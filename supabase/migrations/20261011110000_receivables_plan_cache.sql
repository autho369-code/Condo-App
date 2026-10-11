-- Speed: the receivables totals reuse their query plans from the first call.
--
-- A PL/pgSQL function plans each query fresh on its first five calls on a
-- connection and only then may switch to a reusable plan. These queries
-- read views stacked with row-level-security policies, so each fresh plan
-- costs hundreds of milliseconds: receivables_page_totals took 0.3-5.5 s on
-- the first calls of each connection (and the API keeps about ten), then
-- ~75 ms. force_generic_plan builds the plan once per connection and reuses
-- it: measured 786 ms on the first call, then 72-78 ms, for a manager and a
-- company admin, with the same totals.
--
-- Keep it: a later CREATE OR REPLACE of either function drops this setting
-- unless the new definition repeats `set plan_cache_mode =
-- force_generic_plan` next to `set search_path`.
--
-- Safe with row-level security: policies are evaluated when the query runs
-- (auth.uid() and the helpers are read per execution), and Postgres does not
-- reuse a cached plan for a different role.

-- receivables_page_totals arrives in 20261011100000 (its own PR); skip it
-- if that has not been applied yet.
do $$
begin
  if to_regprocedure('public.receivables_page_totals(uuid, uuid[], uuid[])') is not null then
    alter function public.receivables_page_totals(uuid, uuid[], uuid[]) set plan_cache_mode = force_generic_plan;
  end if;
end
$$;
alter function public.receivable_unit_totals(uuid[]) set plan_cache_mode = force_generic_plan;
