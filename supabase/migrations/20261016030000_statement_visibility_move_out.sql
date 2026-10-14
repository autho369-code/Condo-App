-- Codex on #388 (P1): a co-owner whose move-out date has arrived stays
-- status 'current' until the nightly end_occupancies_past_move_out job runs,
-- so resident_visible_statement_ids still shared their statements with the
-- remaining owner. A co-owner now counts only while their move-out date is
-- still ahead in the association's calendar, as resident_unit_tenure() does.
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
          and o.status = 'current'
          and (o.move_out_date is null
               or o.move_out_date > public.association_local_date(o.association_id)));
end
$function$;

revoke all on function rls_private.resident_visible_statement_ids() from public, anon;
grant execute on function rls_private.resident_visible_statement_ids() to authenticated;
