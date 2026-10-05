-- Follow-up to 20261005122000: a partial index (WHERE …) or an invalid index
-- does not cover a foreign key, because the referencing-row lookup on a parent
-- delete/update must see every row. E.g. api_keys.portfolio_id and
-- form_templates.portfolio_id were only covered by partial indexes. Create a
-- full index for every FK that has no valid, non-partial leading-column index.
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
            and i.indpred is null
            and i.indisvalid
            and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] = c.conkey)
  loop
    execute format('create index if not exists %I on %s (%s)',
                   left('idx_fk_' || r.relname || '_' || r.colnames, 63), r.tbl, r.cols);
  end loop;
end $$;
