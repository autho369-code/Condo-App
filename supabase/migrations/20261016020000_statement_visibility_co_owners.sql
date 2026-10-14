-- Codex on #388 (P1): the unit-sharing branch of resident_visible_statement_ids
-- compared statement months with the start of the buyer's move-in month, so a
-- statement filed under the seller for the sale month (e.g. Oct 1, buyer in
-- Oct 15) was readable by the buyer. That branch now admits only statements
-- addressed to someone who currently owns the unit (a co-owner), from the
-- caller's move-in month on; a predecessor's statement never qualifies.
create or replace function rls_private.resident_visible_statement_ids()
 returns setof uuid
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select s.id
    from public.statements s
   where s.owner_id in (select public.current_owner_ids())
  union
  select s.id
    from public.statements s
    join rls_private.resident_unit_tenure() t on t.unit_id = s.unit_id
   where (t.since is null
          or make_date(s.period_year, s.period_month, 1) >= date_trunc('month', t.since)::date)
     and exists (
       select 1 from public.occupancies o
        where o.unit_id = s.unit_id
          and o.owner_id = s.owner_id
          and o.occupancy_type = 'owner'
          and o.status = 'current');
end
$function$;

revoke all on function rls_private.resident_visible_statement_ids() from public, anon;
grant execute on function rls_private.resident_visible_statement_ids() to authenticated;
