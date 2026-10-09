-- Delete an association and everything in it, from the Supabase SQL editor.
--
--   select public.delete_association_completely(id)
--     from public.associations where name = 'Exact Association Name';
--
-- Removes the association, its buildings and units, its homeowners (records
-- linked only to this association), tenants, bills, ledger entries, bank
-- accounts and every row that points at any of them. Returns a summary.
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

-- Delete the rows of every table that points at p_table's rows p_ids without
-- cascading (no action / restrict), except the tables in p_skip.
create or replace function public.purge_blocking_children(p_table regclass, p_ids uuid[], p_skip regclass[] default '{}')
returns void
language plpgsql
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  r record;
  v_blocked boolean;
begin
  if cardinality(p_ids) = 0 then return; end if;
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, cardinality(c.conkey) as ncols,
           (select ra.attname from pg_attribute ra where ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]) as refcol
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confdeltype in ('a', 'r') and c.confrelid = p_table
       and not (c.conrelid = any(p_skip))
  loop
    -- Never delete core records this way (another association's, or ones the
    -- caller must remove itself in the right order): refuse instead.
    if r.tbl in ('public.associations'::regclass, 'public.owners'::regclass, 'public.units'::regclass,
                 'public.buildings'::regclass, 'public.bank_accounts'::regclass, 'public.journal_entries'::regclass,
                 'public.journal_lines'::regclass, 'public.payable_bills'::regclass) then
      execute format('select exists (select 1 from %s where %I = any($1))', r.tbl, r.col) into v_blocked using p_ids;
      if v_blocked then
        raise exception 'Nothing was deleted: % rows outside this association still point at it (%.%). Handle them first.', r.tbl, r.tbl, r.col;
      end if;
      continue;
    end if;
    if r.ncols <> 1 or r.refcol <> 'id' then
      raise exception 'Cannot clear %.%: its link to % is not a single id column; remove those rows by hand', r.tbl, r.col, p_table;
    end if;
    execute format('delete from %s where %I = any($1)', r.tbl, r.col) using p_ids;
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
  v_lines uuid[];
  v_banks uuid[];
  v_shared text;
  v_has_owner_assoc boolean;
  v_count bigint;
  v_summary jsonb;
begin
  select name into v_name from public.associations where id = p_association_id for update;
  if not found then
    raise exception 'No association with id %', p_association_id using errcode = 'P0002';
  end if;

  -- Pause first: the locks it takes stop new rows arriving while the ids are collected.
  v_paused := public.purge_pause_triggers();

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
  select coalesce(array_agg(id), '{}') into v_lines from public.journal_lines where entry_id = any(v_entries);

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
                and (a.operating_bank_account_id = any(v_banks) or a.reserve_bank_account_id = any(v_banks))) then
    raise exception 'Another association uses one of this association''s bank accounts, so nothing was deleted. Change its bank accounts first.';
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

  -- The association's own links to its bank accounts go first (they would otherwise block).
  update public.associations set operating_bank_account_id = null, reserve_bank_account_id = null
   where id = p_association_id;

  -- An entry outside this set that was reversed by one of ours keeps its row; only the link goes.
  update public.journal_entries set reversed_by_entry_id = null
   where reversed_by_entry_id = any(v_entries) and not (id = any(v_entries));

  -- Rows elsewhere that point at what is being deleted without cascading.
  perform public.purge_blocking_children('public.journal_lines'::regclass, v_lines);
  perform public.purge_blocking_children('public.journal_entries'::regclass, v_entries, array['public.journal_entries'::regclass]);
  perform public.purge_blocking_children('public.payable_bills'::regclass, v_bills);
  perform public.purge_blocking_children('public.bank_accounts'::regclass, v_banks);
  perform public.purge_blocking_children('public.owners'::regclass, v_owners);
  -- Homeowners go before the association (owners.association_id is ON DELETE RESTRICT).
  delete from public.owners where id = any(v_owners);
  perform public.purge_blocking_children('public.units'::regclass, v_units);
  perform public.purge_blocking_children('public.buildings'::regclass, v_buildings);
  perform public.purge_blocking_children('public.associations'::regclass, array[p_association_id]);

  v_summary := jsonb_build_object('deleted', v_name, 'buildings', cardinality(v_buildings),
    'units', cardinality(v_units), 'homeowners', cardinality(v_owners), 'bills', cardinality(v_bills),
    'ledger_entries', cardinality(v_entries), 'bank_accounts', cardinality(v_banks));

  delete from public.journal_entries where id = any(v_entries);
  delete from public.payable_bills where id = any(v_bills);
  delete from public.tenants where association_id = p_association_id or unit_id = any(v_units);
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('tenants', v_count);
  delete from public.associations where id = p_association_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
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
  perform public.purge_blocking_children('public.owners'::regclass, v_owners);
  delete from public.owners where id = any(v_owners);
  perform public.purge_resume_triggers(v_paused);
  return jsonb_build_object('deleted', cardinality(v_owners), 'names', v_names);
end $function$;

revoke all on function public.purge_pause_triggers() from public, anon, authenticated, service_role;
revoke all on function public.purge_resume_triggers(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.purge_blocking_children(regclass, uuid[], regclass[]) from public, anon, authenticated, service_role;
revoke all on function public.delete_association_completely(uuid) from public, anon, authenticated, service_role;
revoke all on function public.delete_unlinked_owners(uuid, boolean) from public, anon, authenticated, service_role;
