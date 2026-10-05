-- Performance advisor fixes. Additive only: no index or policy is dropped.
--
-- 1. Cover every foreign key in public with an index (324 were missing). Joins
--    on these columns and parent deletes otherwise scan the whole child table.
--    Computed from the catalog, so it is idempotent and also covers any
--    environment that is behind production.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl,
           cl.relname,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as colnames
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
     where c.contype = 'f'
       and cl.relnamespace = 'public'::regnamespace
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] = c.conkey)
  loop
    execute format('create index if not exists %I on %s (%s)',
                   left('idx_fk_' || r.relname || '_' || r.colnames, 63), r.tbl, r.cols);
  end loop;
end $$;

-- 2. Evaluate auth.uid() once per statement instead of once per row in the
--    policies the advisor flagged (wrap it in a scalar subquery).
do $$
declare
  r record;
  v_qual text;
  v_check text;
begin
  for r in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (tablename, policyname) in (
         ('profiles', 'operator_writes_own_rows_update'),
         ('saved_report_views', 'operator_writes_own_rows_delete'),
         ('saved_report_views', 'operator_writes_own_rows_insert'),
         ('saved_report_views', 'operator_writes_own_rows_update'),
         ('violations', 'violations_portal_resident_report'),
         ('form_submissions', 'form_submissions_own_delete'),
         ('form_submissions', 'form_submissions_own_insert'),
         ('form_submissions', 'form_submissions_own_select'),
         ('form_submissions', 'form_submissions_own_update'),
         ('form_submissions', 'form_submissions_owner_insert'),
         ('form_submissions', 'operator_writes_own_rows_delete'),
         ('form_submissions', 'operator_writes_own_rows_insert'),
         ('form_submissions', 'operator_writes_own_rows_update'),
         ('form_templates', 'form_templates_owner_read'),
         ('report_favorites', 'operator_writes_own_rows_delete'),
         ('report_favorites', 'operator_writes_own_rows_insert'),
         ('report_favorites', 'operator_writes_own_rows_update'))
  loop
    -- Protect calls that are already wrapped, wrap the bare ones, restore.
    v_qual := replace(replace(replace(r.qual, '( SELECT auth.uid() AS uid)', '@@UID@@'), 'auth.uid()', '( SELECT auth.uid() AS uid)'), '@@UID@@', '( SELECT auth.uid() AS uid)');
    v_check := replace(replace(replace(r.with_check, '( SELECT auth.uid() AS uid)', '@@UID@@'), 'auth.uid()', '( SELECT auth.uid() AS uid)'), '@@UID@@', '( SELECT auth.uid() AS uid)');
    if v_qual is not null and v_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, v_qual, v_check);
    elsif v_qual is not null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, v_qual);
    elsif v_check is not null then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, v_check);
    end if;
  end loop;
end $$;
