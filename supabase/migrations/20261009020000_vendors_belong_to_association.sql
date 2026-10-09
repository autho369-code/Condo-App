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
--    derived from the association, and follows an association that moves
--    company. Moving a vendor to another association is refused while it has
--    rows (work orders, bills...) in its current one.
-- 3. A BEFORE trigger on every table that links a vendor and an association
--    (work_orders, payable_bills, payable_checks, purchase_orders,
--    recurring_* , vendor_credits, credit_card_charges, other_receipts,
--    maintenance_tasks, calendar_events, approval_requests, inspections)
--    refuses a vendor of another association. This covers every writer
--    centrally (RPCs, imports, direct writes). Company-level rows (no
--    association) keep the existing same-company checks.
-- 4. Managers limited to some associations (association_managers) see only
--    their associations' vendors (restrictive mgr_assoc_scope on vendors,
--    vendor_private, vendor_compliance, vendor_financial_details).
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

-- The associations a vendor has rows in (any linked table).
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

-- 3) vendors.portfolio_id follows the association; no move with rows ----------

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

-- An association that moves to another company takes its vendors with it.
create or replace function public.associations_move_vendor_portfolio()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  update public.vendors set portfolio_id = new.portfolio_id
   where association_id = new.id and portfolio_id is distinct from new.portfolio_id;
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
-- (company-level) is left to the existing same-company checks.

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
  v_management boolean;
begin
  if v_vendor_id is null or v_association_id is null then
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

  if v_management then
    if not exists (select 1 from public.associations a
                    where a.id = v_association_id and a.portfolio_id = v_vendor_portfolio) then
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
