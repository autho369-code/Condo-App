-- Forward fix for 20261009005000 (the last commit of #261 was pushed after
-- the merge). Replaces two of its functions; nothing else changes.
--
-- 1. purge_rows: a "set null" link from a row of another association or
--    company now stops the call (purge_assert_own runs before the link is
--    cleared) instead of quietly changing that row.
-- 2. purge_type_matches: a (type, id) reference matches only when its type
--    names the table the id was deleted from ('homeowner' maps to owners).
--    Event labels such as 'je_reversal' never match by id alone.
--
-- SQL-editor only, like 20261009005000 (execute revoked from app roles).

create or replace function public.purge_rows(p_table regclass, p_ids uuid[], p_depth integer default 0)
returns void
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  r record;
  v_child_ids uuid[];
  v_has_id boolean;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return; end if;
  if p_depth > 30 then
    raise exception 'Links under % go too deep to delete safely; nothing was deleted.', p_table;
  end if;
  -- Reaching an association through links means another association's (or a
  -- company's) data points at what is being deleted: stop, never delete it.
  if p_depth > 0 and p_table in ('public.associations'::regclass, 'public.portfolios'::regclass) then
    raise exception 'Deleting this would also delete % rows that belong elsewhere; nothing was deleted. Remove that link first.', p_table;
  end if;
  if to_regclass('pg_temp.purge_deleted') is null then
    create temp table purge_deleted (id uuid not null, tbl regclass not null, primary key (id, tbl)) on commit drop;
  end if;
  perform public.purge_assert_own(p_table, 'id', p_ids);

  for r in
    select c.conrelid::regclass as tbl, a.attname as col, c.confdeltype as on_delete,
           cardinality(c.conkey) as ncols,
           (select ra.attname from pg_attribute ra where ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]) as refcol
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = p_table
  loop
    if r.ncols <> 1 or r.refcol <> 'id' then
      raise exception 'Cannot follow %.% (its link to % is not a single id column); nothing was deleted.', r.tbl, r.col, p_table;
    end if;

    if r.tbl = p_table then
      -- Self-link: rows outside the set only lose the link.
      execute format('update %s set %I = null where %I = any($1) and not (id = any($1))', r.tbl, r.col, r.col) using p_ids;
      continue;
    end if;

    -- A "set null" link is cleared, except a row's own association_id when the
    -- association itself goes: messages, SMS threads, tenants... tagged with it
    -- are its records and go with it.
    if r.on_delete in ('n', 'd') and not (p_table = 'public.associations'::regclass and r.col = 'association_id') then
      -- Another association's row losing its link is still a change to its data: stop instead.
      perform public.purge_assert_own(r.tbl, r.col, p_ids);
      execute format('update %s set %I = null where %I = any($1)', r.tbl, r.col, r.col) using p_ids;
      continue;
    end if;

    select exists (select 1 from pg_attribute pa where pa.attrelid = r.tbl and pa.attname = 'id' and not pa.attisdropped
                    and pa.atttypid = 'uuid'::regtype) into v_has_id;
    if v_has_id then
      execute format('select coalesce(array_agg(id), ''{}'') from %s where %I = any($1)', r.tbl, r.col)
        into v_child_ids using p_ids;
      perform public.purge_rows(r.tbl, v_child_ids, p_depth + 1);
    else
      perform public.purge_assert_own(r.tbl, r.col, p_ids);
      execute format('delete from %s where %I = any($1)', r.tbl, r.col) using p_ids;
    end if;
  end loop;

  execute format('with d as (delete from %s where id = any($1) returning id) '
              || 'insert into purge_deleted select id, $2 from d on conflict do nothing', p_table) using p_ids, p_table;
end $function$;

-- Does the type text of a (type, id) reference name table p_tbl? 'unit' ->
-- units, 'work_order' -> work_orders, 'bill' -> payable_bills, 'property' ->
-- properties, 'homeowner' -> owners. A type that names no table (an event
-- label such as 'je_reversal') never matches: such a row is left alone rather
-- than matched by its id alone.
create or replace function public.purge_type_matches(p_type text, p_tbl regclass)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
  with t as (select case lower(coalesce(p_type, '')) when 'homeowner' then 'owner' else lower(coalesce(p_type, '')) end as v),
  cands as (
    select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace, t
     where n.nspname = 'public' and c.relkind = 'r' and t.v <> ''
       and (c.relname = t.v or c.relname = t.v || 's' or c.relname = regexp_replace(t.v, 'y$', 'ies')
            or c.relname like '%\_' || t.v || 's')
  )
  select exists (select 1 from cands where oid = p_tbl);
$function$;

revoke all on function public.purge_rows(regclass, uuid[], integer) from public, anon, authenticated, service_role;
revoke all on function public.purge_type_matches(text, regclass) from public, anon, authenticated, service_role;
