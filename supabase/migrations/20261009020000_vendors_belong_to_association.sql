-- A vendor record belongs to exactly ONE association.
--
-- Decision (Mirsad, final): each association has its own vendors; records
-- never mix between associations. The same company working for two
-- associations is two vendor records. The one exception is the management
-- company (management fees are billed to every association): a vendor marked
-- is_management_company belongs to the company, not to an association.
-- The chart of accounts stays company-wide.
--
-- 1. vendors.association_id (FK -> associations, ON DELETE RESTRICT) and
--    vendors.is_management_company. Exactly one holds: an association vendor
--    has association_id, the management company has none. Backfilled from
--    the vendor's work orders, bills, checks, POs, etc.; a vendor with none
--    goes to its company's only association. The migration refuses to finish
--    while a vendor is linked to rows of two associations or cannot be
--    placed.
-- 2. vendors.portfolio_id stays (every vendors RLS policy uses it) but is now
--    derived from the association; an association with vendors cannot move
--    to another company. Moving a vendor to another association is refused
--    while it has rows (work orders, bills...) in its current one.
-- 3. A BEFORE trigger on every table that links a vendor and an association
--    (work_orders, payable_bills, payable_checks, purchase_orders,
--    recurring_* , vendor_credits, credit_card_charges, other_receipts,
--    maintenance_tasks, calendar_events, approval_requests, inspections)
--    refuses a vendor of another association. This covers every writer
--    centrally (RPCs, imports, direct writes). Company-level rows (no
--    association) keep the existing same-company checks. Rows that reach
--    their association through a parent (work order estimates and ratings,
--    maintenance task history, lock box assignments) are checked against the
--    parent's, and the parent cannot move to another association while it
--    has such rows from a vendor of its current one.
-- 4. Managers limited to some associations (association_managers) see only
--    their associations' vendors (restrictive mgr_assoc_scope on vendors,
--    vendor_private, vendor_compliance, vendor_financial_details and the
--    vendors' document_requests; reviewing a vendor document checks it too).
-- 5. Management fees: set_management_fee_schedule only accepts a vendor
--    marked as the management company.
-- 6. Portal sign-in: vendors.auth_user_id stays unique. With one record per
--    association, several records can carry the same email, so the auto-link
--    now links one record (the oldest) instead of failing the sign-up. A
--    single login across a vendor's associations is the follow-up PR.
--
-- Additive: nothing is dropped.

-- 1) Columns + index ---------------------------------------------------------

alter table public.vendors
  add column if not exists association_id uuid references public.associations(id) on delete restrict,
  add column if not exists is_management_company boolean not null default false;

create index if not exists idx_vendors_association_id on public.vendors(association_id);

comment on column public.vendors.association_id is
  'The one association this vendor record belongs to (null only for the management company). The same company working for another association has a separate record. portfolio_id is derived from it.';
comment on column public.vendors.is_management_company is
  'The management company: the one vendor that belongs to the company instead of an association (management fees are billed to every association).';

-- Every table linking a vendor to an association: (table, vendor column).
create or replace function public.vendor_link_tables()
returns table(tbl regclass, col name)
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  values
    ('public.work_orders'::regclass, 'vendor_id'::name),
    ('public.payable_bills'::regclass, 'vendor_id'::name),
    ('public.payable_checks'::regclass, 'vendor_id'::name),
    ('public.purchase_orders'::regclass, 'vendor_id'::name),
    ('public.recurring_bills'::regclass, 'vendor_id'::name),
    ('public.recurring_work_orders'::regclass, 'vendor_id'::name),
    ('public.recurring_purchase_orders'::regclass, 'vendor_id'::name),
    ('public.vendor_credits'::regclass, 'vendor_id'::name),
    ('public.credit_card_charges'::regclass, 'vendor_id'::name),
    ('public.other_receipts'::regclass, 'vendor_id'::name),
    ('public.maintenance_tasks'::regclass, 'vendor_id'::name),
    ('public.calendar_events'::regclass, 'vendor_id'::name),
    ('public.approval_requests'::regclass, 'vendor_id'::name),
    ('public.inspections'::regclass, 'inspector_vendor_id'::name)
$function$;

revoke all on function public.vendor_link_tables() from public, anon, authenticated;

-- Tables that link a vendor without an association of their own: theirs is
-- the parent row's. (child table, vendor column, parent key column, parent).
create or replace function public.vendor_parent_link_tables()
returns table(tbl regclass, col name, parent_col name, parent regclass)
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  values
    ('public.work_order_estimates'::regclass, 'vendor_id'::name, 'work_order_id'::name, 'public.work_orders'::regclass),
    ('public.work_order_ratings'::regclass, 'vendor_id'::name, 'work_order_id'::name, 'public.work_orders'::regclass),
    ('public.maintenance_task_history'::regclass, 'vendor_id'::name, 'task_id'::name, 'public.maintenance_tasks'::regclass),
    ('public.lock_box_assignments'::regclass, 'vendor_id'::name, 'lock_box_id'::name, 'public.lock_boxes'::regclass)
$function$;

revoke all on function public.vendor_parent_link_tables() from public, anon, authenticated;

-- The associations a vendor has rows in (any linked table, and the tables
-- linked through a parent). Used by the backfill and the vendor move guard.
create or replace function public.vendor_linked_association_ids(p_vendor_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r record;
  v_ids uuid[] := '{}';
  v_part uuid[];
begin
  for r in select * from public.vendor_link_tables() loop
    execute format('select coalesce(array_agg(distinct association_id), ''{}'') from %s where %I = $1 and association_id is not null',
                   r.tbl, r.col)
      into v_part using p_vendor_id;
    v_ids := v_ids || v_part;
  end loop;
  -- Estimates, ratings, task history, lock box assignments: the parent's.
  for r in select * from public.vendor_parent_link_tables() loop
    execute format('select coalesce(array_agg(distinct p.association_id), ''{}'') from %s c join %s p on p.id = c.%I '
                   || 'where c.%I = $1 and p.association_id is not null',
                   r.tbl, r.parent, r.parent_col, r.col)
      into v_part using p_vendor_id;
    v_ids := v_ids || v_part;
  end loop;
  return coalesce((select array_agg(distinct x) from unnest(v_ids) x), '{}');
end $function$;

revoke all on function public.vendor_linked_association_ids(uuid) from public, anon, authenticated;

-- 2) Backfill, then require it -----------------------------------------------

do $$
declare
  v record;
  v_assocs uuid[];
  v_only uuid;
  v_problems text[] := '{}';
begin
  -- The company's management-fee vendor is the management company.
  update public.vendors ven
     set is_management_company = true
    from public.portfolios p
   where p.management_fee_vendor_id = ven.id
     and ven.portfolio_id = p.id;

  for v in select id, name, portfolio_id from public.vendors
            where association_id is null and not is_management_company loop
    v_assocs := public.vendor_linked_association_ids(v.id);
    if cardinality(v_assocs) = 1 then
      update public.vendors set association_id = v_assocs[1] where id = v.id;
    elsif cardinality(v_assocs) > 1 then
      v_problems := v_problems || format('%s (rows in %s associations)', v.name, cardinality(v_assocs));
    else
      select case when count(*) = 1 then min(a.id::text)::uuid end into v_only
        from public.associations a where a.portfolio_id = v.portfolio_id;
      if v_only is not null then
        update public.vendors set association_id = v_only where id = v.id;
      else
        v_problems := v_problems || format('%s (no rows and the company has several associations)', v.name);
      end if;
    end if;
  end loop;

  if cardinality(v_problems) > 0 then
    raise exception 'These vendors cannot be placed in one association: %. Split each into one vendor per association (or mark it as the management company), then run this migration again.',
      array_to_string(v_problems[1:20], '; ')
      using errcode = '23514';
  end if;

  if exists (select 1 from public.vendors ven join public.associations a on a.id = ven.association_id
              where a.portfolio_id is distinct from ven.portfolio_id) then
    raise exception 'A vendor''s association belongs to another company. Correct it, then run this migration again.' using errcode = '23514';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.vendors'::regclass
                  and conname = 'vendors_association_or_management_company') then
    alter table public.vendors add constraint vendors_association_or_management_company
      check ((is_management_company and association_id is null) or (not is_management_company and association_id is not null));
  end if;
end $$;

-- Existing rows: portfolio_id from their association (no-op on consistent data).
update public.vendors ven
   set portfolio_id = a.portfolio_id
  from public.associations a
 where a.id = ven.association_id
   and ven.portfolio_id is distinct from a.portfolio_id;

-- 3) vendors.portfolio_id comes from the association; no move with rows -------

create or replace function public.vendors_set_portfolio_from_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
  v_linked uuid[];
begin
  if new.is_management_company then
    if new.association_id is not null then
      raise exception 'The management company belongs to the company, not to one association.' using errcode = '23514';
    end if;
  else
    if new.association_id is null then
      raise exception 'A vendor must belong to an association.' using errcode = '23502';
    end if;
    -- Locked, so a concurrent move of the association to another company waits
    -- for this row (and then carries it along), or this waits for the move.
    select a.portfolio_id into v_portfolio_id
      from public.associations a
     where a.id = new.association_id
       for share;
    if not found then
      raise exception 'Association not found for this vendor.' using errcode = '23503';
    end if;
    if v_portfolio_id is null then
      raise exception 'This association has no company, so it cannot have vendors yet.' using errcode = '23502';
    end if;
    new.portfolio_id := v_portfolio_id;
  end if;

  -- Marking a vendor as the management company makes it company-wide (every
  -- association can use it and every manager sees it): only company-wide
  -- finance staff or a company admin may do it, as with the management-fee
  -- schedule. Sessions without a signed-in user (migrations, the SQL editor,
  -- trusted server jobs) are exempt.
  if auth.uid() is not null
     and ((tg_op = 'INSERT' and new.is_management_company)
          or (tg_op = 'UPDATE' and new.is_management_company is distinct from old.is_management_company))
     and not (public.can_manage_finance(new.portfolio_id)
              and (not public.manager_is_scoped() or public.is_company_admin())) then
    raise exception 'Only company-wide accounting staff or a company admin can mark the management company.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (new.association_id is distinct from old.association_id
                           or new.is_management_company is distinct from old.is_management_company) then
    v_linked := public.vendor_linked_association_ids(new.id);
    if not new.is_management_company and exists (select 1 from unnest(v_linked) x where x <> new.association_id) then
      raise exception 'This vendor has work orders, bills or other records in its current association. Add it as a new vendor of the other association instead.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.vendors_set_portfolio_from_association() from public, anon, authenticated;

create or replace trigger trg_vendors_set_portfolio_from_association
  before insert or update of association_id, portfolio_id, is_management_company on public.vendors
  for each row execute function public.vendors_set_portfolio_from_association();

-- One management company per company.
create unique index if not exists vendors_one_management_company
  on public.vendors(portfolio_id) where is_management_company and archived_at is null;

-- An association with vendors cannot move to another company. A vendor
-- carries company-specific links (tax and bank records, document requests,
-- default GL account, portal sign-in and invitations, company-level rows);
-- moving them is a separate, deliberate job, so the move is refused instead
-- of leaving any of them behind. The old company's management company cannot
-- follow either, so the move is also refused while the association's rows
-- use it.
create or replace function public.associations_move_vendor_portfolio()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r record;
  v_bad boolean;
begin
  if exists (select 1 from public.vendors ven where ven.association_id = new.id) then
    raise exception 'This association has vendors. It cannot move to another company.'
      using errcode = '23514';
  end if;

  for r in select * from public.vendor_link_tables() loop
    execute format(
      'select exists (select 1 from %s x join public.vendors ven on ven.id = x.%I '
      || 'where x.association_id = $1 and ven.is_management_company and ven.portfolio_id is distinct from $2)',
      r.tbl, r.col) into v_bad using new.id, new.portfolio_id;
    if v_bad then
      raise exception 'This association has records that use the management company of its current company. It cannot move to another company.'
        using errcode = '23514';
    end if;
  end loop;
  for r in select * from public.vendor_parent_link_tables() loop
    execute format(
      'select exists (select 1 from %s x join %s p on p.id = x.%I join public.vendors ven on ven.id = x.%I '
      || 'where p.association_id = $1 and ven.is_management_company and ven.portfolio_id is distinct from $2)',
      r.tbl, r.parent, r.parent_col, r.col) into v_bad using new.id, new.portfolio_id;
    if v_bad then
      raise exception 'This association has records that use the management company of its current company. It cannot move to another company.'
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$function$;

revoke all on function public.associations_move_vendor_portfolio() from public, anon, authenticated;

create or replace trigger trg_associations_move_vendor_portfolio
  after update of portfolio_id on public.associations
  for each row when (new.portfolio_id is distinct from old.portfolio_id)
  execute function public.associations_move_vendor_portfolio();

-- 4) Linked rows use a vendor of their own association ----------------------
-- TG_ARGV[0] names the vendor column. A row without an association
-- (company-level) needs a vendor of its own company.

create or replace function public.vendor_link_same_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_row jsonb := to_jsonb(new);
  v_vendor_id uuid := nullif(v_row->>tg_argv[0], '')::uuid;
  v_association_id uuid := nullif(v_row->>'association_id', '')::uuid;
  v_vendor_association uuid;
  v_vendor_portfolio uuid;
  v_association_portfolio uuid;
  v_management boolean;
begin
  if v_vendor_id is null then
    return new;
  end if;

  -- Locked, so a concurrent move of the vendor to another association waits
  -- for this row (and its guard then sees it), or this sees the move.
  select ven.association_id, ven.portfolio_id, ven.is_management_company
    into v_vendor_association, v_vendor_portfolio, v_management
    from public.vendors ven
   where ven.id = v_vendor_id
     for share;

  -- A missing vendor is left to the foreign key.
  if not found then
    return new;
  end if;

  -- A company-level row (no association): the vendor must be of its company.
  if v_association_id is null then
    if v_vendor_portfolio is distinct from coalesce(nullif(v_row->>'portfolio_id', '')::uuid, v_vendor_portfolio) then
      raise exception 'This vendor belongs to another company.' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_management then
    -- Locked, so a concurrent move of the association to another company
    -- waits for this row (and its management-company check then sees it).
    select a.portfolio_id into v_association_portfolio
      from public.associations a
     where a.id = v_association_id
       for share;
    if v_association_portfolio is distinct from v_vendor_portfolio then
      raise exception 'This vendor belongs to another company.' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_vendor_association is distinct from v_association_id then
    raise exception 'This vendor belongs to another association. Add it as a vendor of this association.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.vendor_link_same_association() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select * from public.vendor_link_tables() loop
    execute format(
      'create or replace trigger trg_vendor_same_association before insert or update of %I, association_id on %s '
      || 'for each row execute function public.vendor_link_same_association(%L)',
      r.col, r.tbl, r.col);
  end loop;
end $$;

-- Rows linked through a parent (estimates, ratings, task history, lock box
-- assignments): the vendor must be one of the parent's association (or the
-- management company of its company). TG_ARGV: vendor column, parent key
-- column, parent table. The parent is locked, so a concurrent move of it to
-- another association waits for this row (and its guard below then sees
-- it), or this sees the move.
create or replace function public.vendor_link_parent_same_association()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_row jsonb := to_jsonb(new);
  v_vendor_id uuid := nullif(v_row->>tg_argv[0], '')::uuid;
  v_parent_id uuid := nullif(v_row->>tg_argv[1], '')::uuid;
  v_parent jsonb;
  v_association_id uuid;
  v_vendor_association uuid;
  v_vendor_portfolio uuid;
  v_association_portfolio uuid;
  v_management boolean;
begin
  if v_vendor_id is null or v_parent_id is null then
    return new;
  end if;

  execute format('select to_jsonb(p) from %s p where p.id = $1 for share', tg_argv[2]::regclass)
    into v_parent using v_parent_id;
  -- A missing parent is left to the foreign key.
  if v_parent is null then
    return new;
  end if;
  v_association_id := nullif(v_parent->>'association_id', '')::uuid;

  select ven.association_id, ven.portfolio_id, ven.is_management_company
    into v_vendor_association, v_vendor_portfolio, v_management
    from public.vendors ven
   where ven.id = v_vendor_id
     for share;
  if not found then
    return new;
  end if;

  -- A company-level parent (no association): the vendor must be of its company.
  if v_association_id is null then
    if v_vendor_portfolio is distinct from coalesce(nullif(v_parent->>'portfolio_id', '')::uuid,
                                                    nullif(v_row->>'portfolio_id', '')::uuid, v_vendor_portfolio) then
      raise exception 'This vendor belongs to another company.' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_management then
    -- Locked, so a concurrent move of the association to another company
    -- waits for this row (and its management-company check then sees it).
    select a.portfolio_id into v_association_portfolio
      from public.associations a
     where a.id = v_association_id
       for share;
    if v_association_portfolio is distinct from v_vendor_portfolio then
      raise exception 'This vendor belongs to another company.' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_vendor_association is distinct from v_association_id then
    raise exception 'This vendor belongs to another association. Add it as a vendor of this association.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.vendor_link_parent_same_association() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select * from public.vendor_parent_link_tables() loop
    execute format(
      'create or replace trigger trg_vendor_parent_same_association before insert or update of %I, %I on %s '
      || 'for each row execute function public.vendor_link_parent_same_association(%L, %L, %L)',
      r.col, r.parent_col, r.tbl, r.col, r.parent_col,
      (select format('%I.%I', n.nspname, c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.oid = r.parent));
  end loop;
end $$;

-- A parent (work order, maintenance task, lock box) moved to another
-- association must not keep child rows of a vendor of its old one.
create or replace function public.vendor_parent_association_moved()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r record;
  v_bad boolean;
begin
  if new.association_id is null then
    return new;
  end if;
  -- Locked, so a concurrent move of the destination association to another
  -- company waits for this row (and its management-company check sees it).
  perform 1 from public.associations a where a.id = new.association_id for share;
  for r in select * from public.vendor_parent_link_tables() where parent = tg_relid loop
    execute format(
      'select exists (select 1 from %s c join public.vendors ven on ven.id = c.%I '
      || 'where c.%I = $1 and ((not ven.is_management_company and ven.association_id is distinct from $2) '
      || 'or (ven.is_management_company and not exists (select 1 from public.associations a '
      || 'where a.id = $2 and a.portfolio_id = ven.portfolio_id))))',
      r.tbl, r.col, r.parent_col)
      into v_bad using new.id, new.association_id;
    if v_bad then
      raise exception 'This record has estimates, ratings or other entries from a vendor of its current association. It cannot move to another association.'
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$function$;

revoke all on function public.vendor_parent_association_moved() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select distinct parent from public.vendor_parent_link_tables() loop
    execute format(
      'create or replace trigger trg_vendor_parent_association_moved before update of association_id on %s '
      || 'for each row when (new.association_id is distinct from old.association_id) '
      || 'execute function public.vendor_parent_association_moved()',
      r.parent);
  end loop;
end $$;

-- Existing rows already follow the rule (a vendor placed before this
-- migration ran, or on a re-run, is checked here too).
do $$
declare
  r record;
  v_bad boolean;
begin
  for r in select * from public.vendor_link_tables() loop
    execute format(
      'select exists (select 1 from %s x join public.vendors ven on ven.id = x.%I '
      || 'where x.association_id is not null and ((not ven.is_management_company and ven.association_id is distinct from x.association_id) '
      || 'or (ven.is_management_company and not exists (select 1 from public.associations a where a.id = x.association_id and a.portfolio_id = ven.portfolio_id))))',
      r.tbl, r.col) into v_bad;
    if v_bad then
      raise exception '% has rows whose vendor belongs to another association. Correct them, then run this migration again.', r.tbl using errcode = '23514';
    end if;
    -- Company-level rows: the vendor must be of the row's company.
    execute format(
      'select exists (select 1 from %s x join public.vendors ven on ven.id = x.%I '
      || 'where x.association_id is null and ven.portfolio_id is distinct from '
      || 'coalesce(nullif(to_jsonb(x)->>''portfolio_id'', '''')::uuid, ven.portfolio_id))',
      r.tbl, r.col) into v_bad;
    if v_bad then
      raise exception '% has rows whose vendor belongs to another company. Correct them, then run this migration again.', r.tbl using errcode = '23514';
    end if;
  end loop;
  for r in select * from public.vendor_parent_link_tables() loop
    execute format(
      'select exists (select 1 from %s x join %s p on p.id = x.%I join public.vendors ven on ven.id = x.%I '
      || 'where p.association_id is not null and ((not ven.is_management_company and ven.association_id is distinct from p.association_id) '
      || 'or (ven.is_management_company and not exists (select 1 from public.associations a where a.id = p.association_id and a.portfolio_id = ven.portfolio_id))))',
      r.tbl, r.parent, r.parent_col, r.col) into v_bad;
    if v_bad then
      raise exception '% has rows whose vendor belongs to another association. Correct them, then run this migration again.', r.tbl using errcode = '23514';
    end if;
    -- Company-level parents: the vendor must be of the parent's company.
    execute format(
      'select exists (select 1 from %s x join %s p on p.id = x.%I join public.vendors ven on ven.id = x.%I '
      || 'where p.association_id is null and ven.portfolio_id is distinct from '
      || 'coalesce(nullif(to_jsonb(p)->>''portfolio_id'', '''')::uuid, nullif(to_jsonb(x)->>''portfolio_id'', '''')::uuid, ven.portfolio_id))',
      r.tbl, r.parent, r.parent_col, r.col) into v_bad;
    if v_bad then
      raise exception '% has rows whose vendor belongs to another company. Correct them, then run this migration again.', r.tbl using errcode = '23514';
    end if;
  end loop;
end $$;

-- 5) Association-scoped managers see only their associations' vendors -------

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendors' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.vendors as restrictive for all to authenticated
      using (public.can_view_association_row(association_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendor_private' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.vendor_private as restrictive for all to authenticated
      using (exists (select 1 from public.vendors ven
                      where ven.id = vendor_private.vendor_id and public.can_view_association_row(ven.association_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendor_compliance' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.vendor_compliance as restrictive for all to authenticated
      using (exists (select 1 from public.vendors ven
                      where ven.id = vendor_compliance.vendor_id and public.can_view_association_row(ven.association_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendor_financial_details' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.vendor_financial_details as restrictive for all to authenticated
      using (exists (select 1 from public.vendors ven
                      where ven.id = vendor_financial_details.vendor_id and public.can_view_association_row(ven.association_id)));
  end if;
end $$;

-- Document requests sent to a vendor follow the vendor's association (owner
-- requests carry no vendor and are left as they are).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_requests' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.document_requests as restrictive for all to authenticated
      using (vendor_id is null or exists (select 1 from public.vendors ven
                      where ven.id = document_requests.vendor_id and public.can_view_association_row(ven.association_id)));
  end if;
end $$;

-- Files attached to a vendor follow the vendor's association too (the
-- documents policy from 20261002230112 only scopes association files).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documents' and policyname = 'mgr_vendor_assoc_scope') then
    create policy mgr_vendor_assoc_scope on public.documents as restrictive for all to authenticated
      using (entity_type is distinct from 'vendor' or exists (select 1 from public.vendors ven
                      where ven.id = documents.entity_id and public.can_view_association_row(ven.association_id)))
      with check (entity_type is distinct from 'vendor' or exists (select 1 from public.vendors ven
                      where ven.id = documents.entity_id and public.can_view_association_row(ven.association_id)));
  end if;
end $$;

-- Reviewing a vendor's document needs access to the vendor's association too.
create or replace function public.review_vendor_document_request(
  p_request_id uuid, p_approve boolean, p_note text, p_expires_on date)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare r record; v_col text; v_path text;
begin
  select * into r from public.document_requests where id = p_request_id and vendor_id is not null for update;
  if not found or not public.can_access_portfolio(r.portfolio_id)
     or not public.can_view_association_row((select ven.association_id from public.vendors ven where ven.id = r.vendor_id)) then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status::text <> 'submitted' then
    raise exception 'Only submitted documents can be reviewed' using errcode = '55000';
  end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Tell the vendor what is wrong so they can fix it' using errcode = '22023';
  end if;
  v_col := public.vendor_expiration_column(r.doc_type);
  if p_approve and v_col is not null and p_expires_on is null then
    raise exception 'Enter the expiration date from the document' using errcode = '22023';
  end if;

  update public.document_requests
     set status = case when p_approve then 'approved' else 'rejected' end::public.document_request_status,
         reviewed_at = now(), reviewed_by = auth.uid(), review_note = nullif(btrim(p_note), ''), updated_at = now()
   where id = r.id;

  if p_approve and v_col is not null then
    execute format('update public.vendors set %I = $1, updated_at = now() where id = $2', v_col) using p_expires_on, r.vendor_id;
    v_path := r.attachment_urls ->> (jsonb_array_length(r.attachment_urls) - 1);
    if v_path is not null then
      update public.documents set expires_at = p_expires_on::timestamptz
       where entity_type = 'vendor' and entity_id = r.vendor_id and file_url = v_path;
    end if;
  end if;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (r.portfolio_id, 'vendor', r.vendor_id, case when p_approve then 'vendor_document_approved' else 'vendor_document_rejected' end,
          auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('request_id', r.id, 'doc_type', r.doc_type, 'expires_on', p_expires_on, 'note', p_note));
end $$;

revoke all on function public.review_vendor_document_request(uuid, boolean, text, date) from public, anon;
grant execute on function public.review_vendor_document_request(uuid, boolean, text, date) to authenticated, service_role;

-- A manager limited to some associations may see the company-level
-- management company (it serves their associations) but not change or remove
-- it, or its private, compliance or financial records: that is for
-- company-wide staff, as with marking it. Vendor portal users are not
-- scoped managers, so the vendor's own self-service edits still pass.
create or replace function public.can_write_vendor_row(p_association_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  return p_association_id is not null or not public.manager_is_scoped() or public.is_company_admin();
end $function$;

revoke all on function public.can_write_vendor_row(uuid) from public, anon;
grant execute on function public.can_write_vendor_row(uuid) to authenticated;

do $$
declare
  t text;
  v_expr text;
begin
  foreach t in array array['vendors', 'vendor_private', 'vendor_compliance', 'vendor_financial_details'] loop
    v_expr := case when t = 'vendors' then 'public.can_write_vendor_row(association_id)'
                   else format('exists (select 1 from public.vendors ven where ven.id = %I.vendor_id and public.can_write_vendor_row(ven.association_id))', t) end;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'mgr_company_vendor_insert') then
      execute format('create policy mgr_company_vendor_insert on public.%I as restrictive for insert to authenticated with check (%s)', t, v_expr);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'mgr_company_vendor_update') then
      execute format('create policy mgr_company_vendor_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)', t, v_expr, v_expr);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'mgr_company_vendor_delete') then
      execute format('create policy mgr_company_vendor_delete on public.%I as restrictive for delete to authenticated using (%s)', t, v_expr);
    end if;
  end loop;
end $$;

-- 6) Management fees go to the management company ---------------------------

create or replace function public.set_management_fee_schedule(p_enabled boolean, p_day integer, p_vendor_id uuid, p_gl_account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pid uuid := public.current_portfolio_id();
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if public.manager_is_scoped() and not public.is_company_admin() then
    raise exception 'Only company-wide finance staff can schedule management fees' using errcode = '42501';
  end if;
  if p_day is null or p_day not between 1 and 28 then
    raise exception 'Choose a day between 1 and 28' using errcode = '22023';
  end if;
  if p_vendor_id is not null and not exists (
       select 1 from public.vendors v
        where v.id = p_vendor_id and v.portfolio_id = v_pid and v.archived_at is null and v.is_management_company) then
    raise exception 'Choose the management company vendor (a vendor marked as the management company)' using errcode = '22023';
  end if;
  if coalesce(p_enabled, false) then
    if not exists (select 1 from public.vendors v where v.id = coalesce(p_vendor_id, (select management_fee_vendor_id from public.portfolios where id = v_pid))
                     and v.portfolio_id = v_pid and v.archived_at is null and v.is_management_company) then
      raise exception 'Choose the management company vendor' using errcode = '22023';
    end if;
    if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and g.active
                     and g.association_id is null and g.account_type::text in ('expense', 'other_expense')) then
      raise exception 'Choose a company-wide expense account for management fees' using errcode = '22023';
    end if;
  end if;
  update public.portfolios
     set management_fee_auto_enabled = coalesce(p_enabled, false),
         management_fee_auto_day = p_day,
         management_fee_vendor_id = coalesce(p_vendor_id, management_fee_vendor_id),
         management_fee_gl_account_id = coalesce(p_gl_account_id, management_fee_gl_account_id)
   where id = v_pid;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'management_fees', null, 'management_fee_schedule_updated', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('enabled', coalesce(p_enabled, false), 'day', p_day, 'vendor_id', p_vendor_id, 'gl_account_id', p_gl_account_id));
end $function$;

-- Billing management fees also needs the management company (a direct call
-- with an association vendor would fail for every other association).
create or replace function public.app_bill_management_fees(p_portfolio_id uuid, p_month date, p_association_ids uuid[], p_vendor_id uuid, p_gl_account_id uuid, p_bill_date date, p_actor uuid, p_source text)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_bill_date date := coalesce(p_bill_date, (date_trunc('month', p_month) + interval '1 month - 1 day')::date);
  r record;
  v_bill uuid;
  n integer := 0;
begin
  if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.portfolio_id = p_portfolio_id and v.archived_at is null
                   and v.is_management_company) then
    raise exception 'Choose the management company vendor' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = p_portfolio_id and g.active
                   and g.association_id is null and g.account_type::text in ('expense', 'other_expense')) then
    raise exception 'Choose a company-wide expense account for management fees' using errcode = '22023';
  end if;

  for r in
    select * from public.app_management_fee_calc(p_portfolio_id, v_month) pv
     where pv.association_id = any (p_association_ids) and not pv.already_billed and pv.fee > 0
  loop
    insert into public.payable_bills (portfolio_id, vendor_id, association_id, gl_account_id, bill_number, bill_date, due_date,
                                      amount, memo, status, approval_required, approved_at, approved_by, created_by)
    values (p_portfolio_id, p_vendor_id, r.association_id, p_gl_account_id,
            'MGMT-' || to_char(v_month, 'YYYY-MM'), v_bill_date, v_bill_date, r.fee,
            'Management fee ' || chr(8212) || ' ' || to_char(v_month, 'FMMonth YYYY') || ' (' ||
              case r.fee_type when 'per_door' then r.door_count || ' units ' || chr(215) || ' ' || to_char(r.rate, 'FM$999,990.00')
                              when 'flat_monthly' then 'flat monthly'
                              else r.rate || '% of ' || to_char(r.basis, 'FM$999,999,990.00') || ' assessments' end || ')',
            'approved', false, now(), p_actor, p_actor)
    returning id into v_bill;
    perform public.ensure_payable_bill_accrual(v_bill);

    insert into public.management_fees (portfolio_id, association_id, month, fee_amount_cents, door_count,
                                        avg_per_door_cents, fee_type, rate, basis_cents, bill_id, created_by)
    values (p_portfolio_id, r.association_id, v_month, round(r.fee * 100)::int, r.door_count,
            case when r.door_count > 0 then round(r.fee * 100 / r.door_count)::int end,
            r.fee_type, r.rate, round(coalesce(r.basis, 0) * 100)::bigint, v_bill, p_actor)
    on conflict (association_id, month) do update
      set fee_amount_cents = excluded.fee_amount_cents, door_count = excluded.door_count,
          avg_per_door_cents = excluded.avg_per_door_cents, fee_type = excluded.fee_type, rate = excluded.rate,
          basis_cents = excluded.basis_cents, bill_id = excluded.bill_id, created_by = excluded.created_by
      where public.management_fees.bill_id is null
         or exists (select 1 from public.payable_bills vb where vb.id = public.management_fees.bill_id and vb.status = 'void'::public.payable_bill_status);
    if not found then
      raise exception 'Management fee for % was already billed', to_char(v_month, 'FMMonth YYYY') using errcode = '23505';
    end if;
    n := n + 1;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (p_portfolio_id, 'management_fees', null, 'management_fees_billed', p_actor,
          (select email from auth.users where id = p_actor),
          jsonb_build_object('month', v_month, 'bills', n, 'associations', to_jsonb(p_association_ids), 'source', p_source));
  return n;
end $function$;

-- Accepting a vendor invitation links the exact vendor record it was sent
-- for (metadata.vendor_id) or nothing; an older invitation without one links
-- a record of its association, else the newest record with that email.
create or replace function public.link_vendor_on_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and not exists (select 1 from public.vendors x where x.auth_user_id = new.used_by) then
    update public.vendors v
       set auth_user_id = new.used_by, portal_activated = true
     where v.id = (
       select c.id from public.vendors c
        where c.portfolio_id = new.portfolio_id
          and c.auth_user_id is null
          and c.archived_at is null
          -- An invitation for one exact vendor record links that record or
          -- nothing (never another association's record with the same email);
          -- older invitations without one fall back to association, then email.
          and (nullif(new.metadata ->> 'vendor_id', '') is null
               or c.id::text = new.metadata ->> 'vendor_id')
          and jsonb_typeof(c.emails) = 'array'
          and exists (
            select 1 from jsonb_array_elements(c.emails) as e(val)
             where lower(btrim(case jsonb_typeof(e.val)
                                 when 'string' then e.val #>> '{}'
                                 when 'object' then e.val ->> 'email'
                               end)) = lower(btrim(new.email)))
        order by (c.id::text = coalesce(new.metadata ->> 'vendor_id', '')) desc,
                 (c.association_id is not distinct from new.association_id and new.association_id is not null) desc,
                 c.created_at desc, c.id
        limit 1);
  end if;
  return new;
end $function$;

-- 7) Portal sign-in: link one vendor record per sign-in ---------------------
-- vendors.auth_user_id stays unique. With one record per association, the
-- same email can be on several records; link the oldest instead of failing
-- the sign-up (the multi-association vendor login is the follow-up).

create or replace function public.auto_link_portal_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
begin
  select p.portfolio_id into v_portfolio_id
  from public.profiles p
  where p.id = new.id and p.disabled_at is null;

  if v_portfolio_id is null then
    return new;
  end if;

  -- One homeowner record per sign-in (owners.auth_user_id is unique). With one
  -- record per association, the same email can now be on several records:
  -- link the oldest instead of failing the whole sign-up on the second.
  update public.owners o
     set auth_user_id = new.id, portal_activated = true
   where o.id = (
     select candidate.id
       from public.owners candidate
      where candidate.portfolio_id = v_portfolio_id
        and candidate.auth_user_id is null
        and candidate.archived_at is null
        and lower(candidate.email) = lower(new.email)
      order by candidate.created_at, candidate.id
      limit 1
   )
     and not exists (select 1 from public.owners linked where linked.auth_user_id = new.id)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role in ('owner', 'board') and p.disabled_at is null
     );

  -- One vendor record per sign-in (vendors.auth_user_id is unique). With one
  -- record per association, the same email can be on several records: link
  -- the oldest instead of failing the whole sign-up on the second.
  update public.vendors v
     set auth_user_id = new.id, portal_activated = true
   where v.id = (
     select candidate.id
       from public.vendors candidate
      where candidate.portfolio_id = v_portfolio_id
        and candidate.auth_user_id is null
        and candidate.archived_at is null
        and exists (
          select 1 from jsonb_array_elements_text(candidate.emails) as e(email)
          where lower(e.email) = lower(new.email)
        )
      order by candidate.created_at, candidate.id
      limit 1
   )
     and not exists (select 1 from public.vendors linked where linked.auth_user_id = new.id)
     -- An invited vendor is linked to the exact record of the invitation when it
     -- is accepted (link_vendor_on_invitation_accept), not to the oldest match.
     and not exists (
       select 1 from public.user_invitations i
       where i.portfolio_id = v_portfolio_id and i.hoa_role::text = 'vendor' and i.status::text = 'pending'
         and lower(btrim(i.email)) = lower(btrim(new.email))
     )
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'vendor' and p.disabled_at is null
     );

  update public.board_members bm
     set auth_user_id = new.id
   where bm.auth_user_id is null
     and bm.active
     and lower(bm.email) = lower(new.email)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'board' and p.disabled_at is null
     )
     and exists (
       select 1 from public.associations a
       where a.id = bm.association_id and a.portfolio_id = v_portfolio_id
     );

  update public.tenants t
     set auth_user_id = new.id,
         portal_activated = true,
         updated_at = now()
   where t.id = (
     select candidate.id
     from public.tenants candidate
     where candidate.portfolio_id = v_portfolio_id
       and candidate.auth_user_id is null
       and candidate.status = 'active'
       and candidate.archived_at is null
       and lower(candidate.email) = lower(new.email)
       and exists (
         select 1 from public.profiles p
         where p.id = new.id and p.hoa_role = 'tenant' and p.disabled_at is null
       )
     order by candidate.created_at desc, candidate.id
     limit 1
   );

  update public.profiles p
     set hoa_role = 'board'
   where p.id = new.id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = new.id and bm.active
     );

  return new;
end;
$function$;

create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
  n_tenants integer;
begin
  -- At most one homeowner record per sign-in: the oldest unlinked match, and
  -- only for sign-ins not linked to a homeowner record yet.
  with pick as (
    select distinct on (u.id) u.id as user_id, o.id as owner_id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role in ('owner', 'board')
      join public.owners o on o.portfolio_id = p.portfolio_id and lower(o.email) = lower(u.email)
     where o.auth_user_id is null
       and o.archived_at is null
       and not exists (select 1 from public.owners linked where linked.auth_user_id = u.id)
     order by u.id, o.created_at, o.id
  ), upd as (
    update public.owners o
       set auth_user_id = pick.user_id
      from pick
     where o.id = pick.owner_id
    returning 1
  ) select count(*) into n_owners from upd;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board'
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
       and exists (
         select 1 from public.associations a
         where a.id = bm.association_id and a.portfolio_id = p.portfolio_id
       )
    returning 1
  ) select count(*) into n_board from upd;

  -- At most one vendor record per sign-in: the oldest unlinked match, and
  -- only for sign-ins not linked to a vendor record yet.
  with pick as (
    select distinct on (u.id) u.id as user_id, v.id as vendor_id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'vendor'
      join public.vendors v on v.portfolio_id = p.portfolio_id
     where v.auth_user_id is null
       and v.archived_at is null
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
       and not exists (select 1 from public.vendors linked where linked.auth_user_id = u.id)
     order by u.id, v.created_at, v.id
  ), upd as (
    update public.vendors v
       set auth_user_id = pick.user_id
      from pick
     where v.id = pick.vendor_id
    returning 1
  ) select count(*) into n_vendors from upd;

  with candidates as (
    select distinct on (u.id) t.id as tenant_id, u.id as auth_user_id
    from auth.users u
    join public.profiles p
      on p.id = u.id
     and p.disabled_at is null
     and p.hoa_role = 'tenant'
    join public.tenants t
      on t.portfolio_id = p.portfolio_id
     and t.auth_user_id is null
     and t.status = 'active'
     and t.archived_at is null
     and lower(u.email) = lower(t.email)
    order by u.id, t.created_at desc, t.id
  ), upd as (
    update public.tenants t
       set auth_user_id = candidates.auth_user_id,
           portal_activated = true,
           updated_at = now()
      from candidates
     where t.id = candidates.tenant_id
    returning 1
  ) select count(*) into n_tenants from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors),
    ('tenants', n_tenants);
end;
$function$;
