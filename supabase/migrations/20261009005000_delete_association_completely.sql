-- Delete an association and everything in it, from the Supabase SQL editor.
--
--   select public.delete_association_completely(id)
--     from public.associations where name = 'Exact Association Name';
--
-- Removes the association, its buildings and units, its homeowners (records
-- linked only to this association), tenants, bills, ledger entries, bank
-- accounts and every row that points at any of them, including notes,
-- documents, tags and audit rows attached by (type, id). Returns a summary.
-- If anything of another association or company points at what goes, it stops
-- and deletes nothing.
--
-- It refuses (and deletes nothing) when a ledger entry also has lines in
-- another association, e.g. a bank transfer between two associations: those
-- books belong to the other association too and must be handled by hand.
--
-- The app's own triggers (posted-ledger guards, bill integrity, scope checks)
-- are paused for the call: they exist to stop edits to live books, and a full
-- purge removes those books with the association. Only triggers that were
-- enabled are paused, and exactly those are re-enabled (a trigger switched off
-- on purpose, e.g. trg_vendor_compliance_sync, stays off). Foreign keys stay
-- enforced. Everything runs in the caller's transaction: any error undoes all
-- of it, the trigger pause included. Pausing locks every public table until
-- the call ends, so run it outside busy hours.
--
-- Not callable from the app: execute is revoked from public, anon,
-- authenticated and service_role; only the database owner (the SQL editor)
-- can run it. Mirsad runs these; Claude never does (they delete).

-- Pause every enabled user trigger in public; returns what was paused and
-- the mode each had, as [{"t": table, "g": trigger, "m": tgenabled}].
create or replace function public.purge_pause_triggers()
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_paused jsonb := '[]'::jsonb;
  t record;
begin
  for t in
    select c.relname, tg.tgname, tg.tgenabled
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not tg.tgisinternal and tg.tgenabled <> 'D'
  loop
    execute format('alter table public.%I disable trigger %I', t.relname, t.tgname);
    v_paused := v_paused || jsonb_build_array(jsonb_build_object('t', t.relname, 'g', t.tgname, 'm', t.tgenabled::text));
  end loop;
  return v_paused;
end $function$;

-- Put back exactly the triggers purge_pause_triggers() paused, in the mode
-- each had (O = normal, A = always, R = replica).
create or replace function public.purge_resume_triggers(p_paused jsonb)
returns void
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v jsonb;
begin
  for v in select * from jsonb_array_elements(coalesce(p_paused, '[]'::jsonb)) loop
    execute format('alter table public.%I enable %s trigger %I', v->>'t',
      case v->>'m' when 'A' then 'always' when 'R' then 'replica' else '' end, v->>'g');
  end loop;
end $function$;

-- Delete rows p_ids of p_table together with everything that depends on
-- them, children first, following every foreign key down: cascading and
-- blocking ("no action" / "restrict") links are deleted, "set null" links are
-- cleared. So a row many links deep (a reconciliation item on an adjustment on
-- a bank account) never blocks the delete. A self-link is cleared on rows
-- outside the set. Callers pause triggers first (purge_pause_triggers).
--
-- When the caller names the association being deleted (setting
-- purge.association_id, and purge.portfolio_id for its company), every row
-- reached must belong to it: a row whose association_id or portfolio_id names
-- another one (e.g. another association's budget line on this association's GL
-- account) stops the call and nothing is deleted.
create or replace function public.purge_assert_own(p_table regclass, p_col name, p_ids uuid[])
returns void
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_assoc uuid := nullif(current_setting('purge.association_id', true), '')::uuid;
  v_portfolio uuid := nullif(current_setting('purge.portfolio_id', true), '')::uuid;
  v_other boolean;
begin
  if v_assoc is not null and exists (select 1 from pg_attribute pa where pa.attrelid = p_table
                                       and pa.attname = 'association_id' and not pa.attisdropped) then
    execute format('select exists (select 1 from %s where %I = any($1) and association_id is not null and association_id <> $2)',
                   p_table, p_col) into v_other using p_ids, v_assoc;
    if v_other then
      raise exception 'Rows in % that belong to another association depend on what would be deleted; nothing was deleted. Move or remove them first.', p_table;
    end if;
  end if;
  if v_portfolio is not null and exists (select 1 from pg_attribute pa where pa.attrelid = p_table
                                           and pa.attname = 'portfolio_id' and not pa.attisdropped) then
    execute format('select exists (select 1 from %s where %I = any($1) and portfolio_id is not null and portfolio_id <> $2)',
                   p_table, p_col) into v_other using p_ids, v_portfolio;
    if v_other then
      raise exception 'Rows in % that belong to another company depend on what would be deleted; nothing was deleted.', p_table;
    end if;
  end if;
end $function$;

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

-- Does the type text of a (type, id) reference fit table p_tbl? A type that
-- names a table ('unit' -> units, 'work_order' -> work_orders, 'bill' ->
-- payable_bills, 'property' -> properties) must name p_tbl. A type that names
-- no table at all (e.g. 'homeowner') is matched by the id alone.
create or replace function public.purge_type_matches(p_type text, p_tbl regclass)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
  with t as (select lower(coalesce(p_type, '')) as v),
  cands as (
    select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace, t
     where n.nspname = 'public' and c.relkind = 'r' and t.v <> ''
       and (c.relname = t.v or c.relname = t.v || 's' or c.relname = regexp_replace(t.v, 'y$', 'ies')
            or c.relname like '%\_' || t.v || 's')
  )
  select not exists (select 1 from cands) or exists (select 1 from cands where oid = p_tbl);
$function$;

-- Notes, documents, tags, audit rows and the like point at a record by
-- (<x>_type, <x>_id) with no foreign key, so purge_rows cannot find them.
-- Delete every such row whose <x>_id is a row purge_rows deleted and whose
-- <x>_type fits the table it was deleted from, with whatever depends on it, and
-- repeat for rows attached to those. A matched row that belongs to another
-- association (its association_id, or for a ledger entry any of its lines) stops
-- the call: nothing is deleted. p_association_id null = belongs to none.
create or replace function public.purge_polymorphic(p_association_id uuid)
returns void
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  r record;
  v_ids uuid[];
  v_found boolean;
  v_round integer := 0;
  v_other boolean;
begin
  if to_regclass('pg_temp.purge_deleted') is null then
    create temp table purge_deleted (id uuid not null, tbl regclass not null, primary key (id, tbl)) on commit drop;
  end if;
  analyze purge_deleted;
  loop
    v_found := false;
    v_round := v_round + 1;
    if v_round > 10 then
      raise exception 'Attached records go too deep to delete safely; nothing was deleted.';
    end if;
    for r in
      select c.oid::regclass as tbl, idc.attname as col, tyc.attname as tcol,
             exists (select 1 from pg_attribute pa where pa.attrelid = c.oid and pa.attname = 'id'
                      and not pa.attisdropped and pa.atttypid = 'uuid'::regtype) as has_id
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute idc on idc.attrelid = c.oid and not idc.attisdropped and idc.atttypid = 'uuid'::regtype
                             and idc.attname like '%\_id'
        join pg_attribute tyc on tyc.attrelid = c.oid and not tyc.attisdropped
                             and tyc.attname = left(idc.attname, length(idc.attname) - 3) || '_type'
       where n.nspname = 'public' and c.relkind = 'r'
    loop
      if r.has_id then
        execute format('select coalesce(array_agg(distinct t.id), ''{}'') from %s t join purge_deleted d on d.id = t.%I '
                    || 'where public.purge_type_matches(t.%I::text, d.tbl) '
                    || 'and not exists (select 1 from purge_deleted x where x.id = t.id and x.tbl = $1)',
                       r.tbl, r.col, r.tcol)
          into v_ids using r.tbl;
        if cardinality(v_ids) > 0 then
          if exists (select 1 from pg_attribute pa where pa.attrelid = r.tbl and pa.attname = 'association_id'
                      and not pa.attisdropped) then
            execute format('select exists (select 1 from %s where id = any($1) and association_id is not null '
                        || 'and association_id is distinct from $2)', r.tbl)
              into v_other using v_ids, p_association_id;
            if v_other then
              raise exception 'Records in % attached here belong to another association; nothing was deleted.', r.tbl;
            end if;
          end if;
          if r.tbl = 'public.journal_entries'::regclass and exists (
               select 1 from public.journal_lines l
                where l.entry_id = any(v_ids) and l.association_id is distinct from p_association_id) then
            raise exception 'Ledger entries made from these records have lines outside this association; nothing was deleted. Reverse or move them first.';
          end if;
          v_found := true;
          perform public.purge_rows(r.tbl, v_ids, 1);
        end if;
      else
        execute format('delete from %s t using purge_deleted d where d.id = t.%I and public.purge_type_matches(t.%I::text, d.tbl)',
                       r.tbl, r.col, r.tcol);
      end if;
    end loop;
    exit when not v_found;
  end loop;
end $function$;

create or replace function public.delete_association_completely(p_association_id uuid)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_name text;
  v_paused jsonb;
  v_buildings uuid[];
  v_units uuid[];
  v_owners uuid[];
  v_bills uuid[];
  v_entries uuid[];
  v_banks uuid[];
  v_shared text;
  v_has_owner_assoc boolean;
  v_count bigint;
  v_summary jsonb;
  v_col name;
begin
  select name into v_name from public.associations where id = p_association_id for update;
  if not found then
    raise exception 'No association with id %', p_association_id using errcode = 'P0002';
  end if;

  -- Pause first: the locks it takes stop new rows arriving while the ids are collected.
  v_paused := public.purge_pause_triggers();
  -- Everything purged from here on must belong to this association / company.
  perform set_config('purge.association_id', p_association_id::text, true);
  perform set_config('purge.portfolio_id', coalesce((select portfolio_id::text from public.associations where id = p_association_id), ''), true);

  select coalesce(array_agg(id), '{}') into v_buildings from public.buildings where association_id = p_association_id;
  select coalesce(array_agg(id), '{}') into v_units from public.units where building_id = any(v_buildings);
  select coalesce(array_agg(id), '{}') into v_bills from public.payable_bills where association_id = p_association_id;
  select coalesce(array_agg(id), '{}') into v_banks from public.bank_accounts where association_id = p_association_id;

  -- Ledger entries with lines here. An entry that also has lines in another
  -- association is shared books: refuse rather than delete the other side.
  select coalesce(array_agg(distinct entry_id), '{}') into v_entries
    from public.journal_lines where association_id = p_association_id;
  select string_agg(distinct l.entry_id::text, ', ') into v_shared
    from public.journal_lines l
   where l.entry_id = any(v_entries) and (l.association_id is null or l.association_id <> p_association_id);
  if v_shared is not null then
    raise exception 'These ledger entries also have lines outside this association (another association or none), so nothing was deleted: %. Reverse or move them first.', v_shared;
  end if;

  -- Homeowners linked only here (and, once owners carry their association, those records).
  select coalesce(array_agg(distinct o.owner_id), '{}') into v_owners
    from public.occupancies o
   where o.association_id = p_association_id and o.owner_id is not null
     and not exists (select 1 from public.occupancies x
                      where x.owner_id = o.owner_id and x.association_id <> p_association_id)
     and not exists (select 1 from public.unit_owners uo
                       join public.units u on u.id = uo.unit_id
                       join public.buildings b on b.id = u.building_id
                      where uo.owner_id = o.owner_id and b.association_id <> p_association_id);
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'owners' and column_name = 'association_id')
    into v_has_owner_assoc;
  if v_has_owner_assoc then
    execute 'select coalesce(array_agg(id), ''{}'') from public.owners where association_id = $1 or id = any($2)'
      into v_owners using p_association_id, v_owners;
  end if;

  -- Refuse (nothing deleted) when something of another association depends on what goes.
  if exists (select 1 from public.associations a
              where a.id <> p_association_id
                and (a.operating_bank_account_id = any(v_banks) or a.reserve_bank_account_id = any(v_banks)
                     or a.stripe_settlement_bank_account_id = any(v_banks))) then
    raise exception 'Another association uses one of this association''s bank accounts, so nothing was deleted. Change its bank accounts first.';
  end if;
  if exists (select 1 from public.journal_lines l join public.gl_accounts g on g.id = l.gl_account_id
              where g.association_id = p_association_id and l.association_id is distinct from p_association_id
                and not (l.entry_id = any(v_entries))) then
    raise exception 'Another association''s books use one of this association''s own GL accounts, so nothing was deleted.';
  end if;
  if exists (select 1 from public.charges ch
               join public.charge_categories cc on cc.id = ch.charge_category_id
               join public.units u on u.id = ch.unit_id
              where cc.association_id = p_association_id and not (u.id = any(v_units))) then
    raise exception 'Another association''s charges use one of this association''s charge categories, so nothing was deleted.';
  end if;
  if exists (select 1 from public.payable_bill_line_items li
               join public.payable_bills pb on pb.id = li.bill_id
              where (li.association_id = p_association_id) <> (pb.association_id is not distinct from p_association_id)) then
    raise exception 'A bill is split between this association and another (or none), so nothing was deleted. Move or void it first.';
  end if;
  if exists (select 1 from public.bank_transfers bt
              where (bt.from_bank_account_id = any(v_banks)) <> (bt.to_bank_account_id = any(v_banks))) then
    raise exception 'A bank transfer links this association with another, so nothing was deleted. Void or move it first.';
  end if;
  if exists (select 1 from public.occupancies x where x.owner_id = any(v_owners) and x.association_id <> p_association_id)
     or exists (select 1 from public.unit_owners uo
                  join public.units u on u.id = uo.unit_id
                  join public.buildings b on b.id = u.building_id
                 where uo.owner_id = any(v_owners) and b.association_id <> p_association_id) then
    raise exception 'A homeowner of this association also has units in another association, so nothing was deleted. Split that homeowner into one record per association first.';
  end if;

  -- The association's own optional links (bank accounts, interest-income GL
  -- account, templates...) are cleared first: they point at its own rows, and
  -- left in place they lead the purge back to the association itself.
  for v_col in
    select a.attname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.conrelid = 'public.associations'::regclass
       and cardinality(c.conkey) = 1 and not a.attnotnull
  loop
    execute format('update public.associations set %I = null where id = $1', v_col) using p_association_id;
  end loop;

  v_summary := jsonb_build_object('deleted', v_name, 'buildings', cardinality(v_buildings),
    'units', cardinality(v_units), 'homeowners', cardinality(v_owners), 'bills', cardinality(v_bills),
    'ledger_entries', cardinality(v_entries), 'bank_accounts', cardinality(v_banks));
  select count(*) into v_count from public.tenants where association_id = p_association_id or unit_id = any(v_units);
  v_summary := v_summary || jsonb_build_object('tenants', v_count);

  -- Everything that depends on them, deepest first. Ledger entries and bills
  -- first (their lines and checks), then homeowners (owners.association_id is
  -- ON DELETE RESTRICT), then the association with all it contains.
  perform public.purge_rows('public.journal_entries'::regclass, v_entries);
  perform public.purge_rows('public.payable_bills'::regclass, v_bills);
  perform public.purge_rows('public.owners'::regclass, v_owners);
  perform public.purge_rows('public.associations'::regclass, array[p_association_id]);
  perform public.purge_polymorphic(p_association_id);

  if exists (select 1 from public.associations where id = p_association_id) then
    raise exception 'The association was not deleted; nothing was changed.';
  end if;

  perform public.purge_resume_triggers(v_paused);
  return v_summary;
end $function$;

-- Homeowner records of one company never linked to any unit (e.g. left over
-- after their association was removed). Dry run by default: it lists them.
--
--   select public.delete_unlinked_owners('<company id>');         -- list
--   select public.delete_unlinked_owners('<company id>', false);  -- delete
create or replace function public.delete_unlinked_owners(p_portfolio_id uuid, p_dry_run boolean default true)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_owners uuid[];
  v_names jsonb;
  v_paused jsonb;
  v_has_owner_assoc boolean;
begin
  if p_portfolio_id is null then raise exception 'Give the company (portfolio) id'; end if;
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'owners' and column_name = 'association_id')
    into v_has_owner_assoc;
  -- Once every homeowner belongs to an association (20261009010000), deleting the
  -- association removes its homeowners; a homeowner without units is just a new one.
  if v_has_owner_assoc then
    return jsonb_build_object('would_delete', 0, 'note',
      'Homeowners now belong to an association; delete the association with delete_association_completely().');
  end if;
  -- Once owners carry their association, a new owner waiting for its unit link is not "unlinked".
  execute format(
    'select coalesce(array_agg(o.id), ''{}''), coalesce(jsonb_agg(o.full_name order by o.full_name), ''[]'')
       from public.owners o
      where o.portfolio_id = $1
        and not exists (select 1 from public.occupancies x where x.owner_id = o.id) %s',
    case when v_has_owner_assoc then 'and o.association_id is null' else '' end)
    into v_owners, v_names using p_portfolio_id;

  if p_dry_run or cardinality(v_owners) = 0 then
    return jsonb_build_object('would_delete', cardinality(v_owners), 'names', v_names, 'dry_run', p_dry_run);
  end if;

  v_paused := public.purge_pause_triggers();
  perform set_config('purge.association_id', '', true);
  perform set_config('purge.portfolio_id', p_portfolio_id::text, true);
  perform public.purge_rows('public.owners'::regclass, v_owners);
  perform public.purge_polymorphic(null);
  perform public.purge_resume_triggers(v_paused);
  return jsonb_build_object('deleted', cardinality(v_owners), 'names', v_names);
end $function$;

revoke all on function public.purge_pause_triggers() from public, anon, authenticated, service_role;
revoke all on function public.purge_resume_triggers(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.purge_rows(regclass, uuid[], integer) from public, anon, authenticated, service_role;
revoke all on function public.purge_assert_own(regclass, name, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.purge_type_matches(text, regclass) from public, anon, authenticated, service_role;
revoke all on function public.purge_polymorphic(uuid) from public, anon, authenticated, service_role;
revoke all on function public.delete_association_completely(uuid) from public, anon, authenticated, service_role;
revoke all on function public.delete_unlinked_owners(uuid, boolean) from public, anon, authenticated, service_role;
