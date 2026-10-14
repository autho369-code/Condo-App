-- Setup records deep check (package 4): recurring and bulk charges.
-- Additive: create or replace functions and triggers, no DELETE/DROP.
-- Function bodies are the live ones (pg_get_functiondef, 2026-10-14) with
-- the fixes marked "fix:".

-- ---------------------------------------------------------------------------
-- 1. A charge category belongs to one company (and, when set, one of that
--    company's associations). A unit's recurring charge can't use another
--    association's or company's category (every writer picks it explicitly
--    or association-first); a charge can't use another company's category
--    (the late-fee and fine engines pick by company, so the association
--    level is left to them); and a category can't point at another
--    company's association or GL account.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_charge_category_unit_scope()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_assoc uuid;
  v_portfolio uuid;
  v_cat record;
begin
  if new.charge_category_id is null or new.unit_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.charge_category_id is not distinct from old.charge_category_id
     and new.unit_id is not distinct from old.unit_id then
    return new;
  end if;
  v_assoc := public.unit_association_id(new.unit_id);
  select a.portfolio_id into v_portfolio from public.associations a where a.id = v_assoc;
  select c.portfolio_id, c.association_id into v_cat
    from public.charge_categories c where c.id = new.charge_category_id
    for share;
  if not found then
    raise exception 'Charge category not found' using errcode = '23503';
  end if;
  if v_cat.portfolio_id is not null and v_cat.portfolio_id is distinct from v_portfolio then
    raise exception 'This charge category belongs to another company' using errcode = '42501';
  end if;
  if tg_argv[0] = 'association'
     and v_cat.association_id is not null and v_cat.association_id is distinct from v_assoc then
    raise exception 'This charge category belongs to another association' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.enforce_charge_category_unit_scope() from public, anon, authenticated;

create or replace trigger trg_unit_recurring_charges_category_scope
  before insert or update of unit_id, charge_category_id on public.unit_recurring_charges
  for each row execute function public.enforce_charge_category_unit_scope('association');

create or replace trigger trg_charges_category_scope
  before insert or update of unit_id, charge_category_id on public.charges
  for each row execute function public.enforce_charge_category_unit_scope('company');

create or replace function public.enforce_charge_category_company()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.association_id is not null and not exists (
    select 1 from public.associations a
     where a.id = new.association_id and a.portfolio_id = new.portfolio_id
  ) then
    raise exception 'The association must belong to the charge category''s company' using errcode = '42501';
  end if;
  if new.gl_account_id is not null and not exists (
    select 1 from public.gl_accounts g
     where g.id = new.gl_account_id and g.portfolio_id = new.portfolio_id
  ) then
    raise exception 'The GL account must belong to the charge category''s company' using errcode = '42501';
  end if;
  -- A category already used by other associations' units can't be narrowed
  -- to one association (or moved to another company): their recurring
  -- charges would stop posting.
  if tg_op = 'UPDATE'
     and (new.portfolio_id is distinct from old.portfolio_id
          or (new.association_id is not null and new.association_id is distinct from old.association_id))
     and (exists (
           select 1 from public.unit_recurring_charges r
             join public.units u on u.id = r.unit_id
             join public.buildings b on b.id = u.building_id
             join public.associations a on a.id = b.association_id
            where r.charge_category_id = new.id
              and (a.portfolio_id is distinct from new.portfolio_id
                   or (new.association_id is not null and b.association_id is distinct from new.association_id)))
       or exists (
           select 1 from public.charges c
             join public.units u on u.id = c.unit_id
             join public.buildings b on b.id = u.building_id
             join public.associations a on a.id = b.association_id
            where c.charge_category_id = new.id
              and (a.portfolio_id is distinct from new.portfolio_id
                   or (new.association_id is not null and b.association_id is distinct from new.association_id)))) then
    raise exception 'This charge category is already used by other associations'' units' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.enforce_charge_category_company() from public, anon, authenticated;

create or replace trigger trg_charge_categories_company
  before insert or update of portfolio_id, association_id, gl_account_id on public.charge_categories
  for each row execute function public.enforce_charge_category_company();

-- ---------------------------------------------------------------------------
-- 2. Bulk recurring charges: one active subscription per unit and category
--    after a re-run or double click, no charge posted twice, the
--    association's own categories, association-local "today".
-- ---------------------------------------------------------------------------
create or replace function public.bulk_create_recurring_charges(p_subscriptions jsonb, p_charge_category_id uuid DEFAULT NULL::uuid, p_frequency text DEFAULT 'monthly'::text, p_start_date date DEFAULT NULL::date, p_memo text DEFAULT NULL::text)
 RETURNS TABLE(inserted_count integer, subscription_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  sub record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_portfolio uuid;
  v_assoc uuid;
  v_cat_id uuid;
  v_freq public.recurring_frequency;
  v_row_freq public.recurring_frequency;
  v_start date;
  v_next date;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_subscriptions is null or jsonb_typeof(p_subscriptions) <> 'array' or jsonb_array_length(p_subscriptions) = 0 then
    raise exception 'No subscriptions supplied' using errcode = '22023';
  end if;
  if jsonb_array_length(p_subscriptions) > 5000 then
    raise exception 'At most 5000 subscriptions per batch' using errcode = '22023';
  end if;
  begin
    v_freq := coalesce(p_frequency, 'monthly')::public.recurring_frequency;
  exception when others then
    raise exception 'Invalid frequency: %', p_frequency using errcode = '22023';
  end;

  for sub in
    select * from jsonb_to_recordset(p_subscriptions)
      as x(unit_id uuid, amount numeric, charge_category_id uuid, frequency text, start_date date, memo text)
  loop
    v_portfolio := public.unit_portfolio_id(sub.unit_id);
    if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;
    v_assoc := public.unit_association_id(sub.unit_id);
    if not public.can_view_association_row(v_assoc) then
      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;
    if sub.amount is null or sub.amount <= 0 or sub.amount > 10000000 then
      raise exception 'Recurring amount must be positive' using errcode = '22023';
    end if;
    v_cat_id := coalesce(sub.charge_category_id, p_charge_category_id);
    -- fix: the category must also be the unit's association's (or company-wide).
    if v_cat_id is null or not exists (
      select 1 from public.charge_categories c
       where c.id = v_cat_id and c.portfolio_id = v_portfolio and c.active and c.archived_at is null
         and (c.association_id is null or c.association_id = v_assoc)
    ) then
      raise exception 'Charge category is outside this association or inactive' using errcode = '42501';
    end if;

    v_row_freq := v_freq;
    if sub.frequency is not null then
      begin
        v_row_freq := sub.frequency::public.recurring_frequency;
      exception when others then
        raise exception 'Invalid frequency: %', sub.frequency using errcode = '22023';
      end;
    end if;
    -- fix: "today" is the association's date, not the server's (UTC).
    v_start := coalesce(sub.start_date, p_start_date, public.association_local_date(v_assoc));

    -- fix: two runs at once (double click) for the same unit each ended the
    -- old subscription and inserted a new one. Serialize per unit; the next
    -- statement then sees the other run's subscription and ends it.
    perform 1 from public.units u where u.id = sub.unit_id for update;

    -- fix: a replaced subscription that already posted charges on or after
    -- the new start date: start the new one at its next unposted date, so
    -- those periods are not charged twice.
    select max(r.next_post_date) into v_next
      from public.unit_recurring_charges r
     where r.unit_id = sub.unit_id
       and r.charge_category_id = v_cat_id
       and r.active
       and (r.end_date is null or r.end_date >= v_start)
       and r.last_posted_at is not null
       and r.next_post_date > v_start;

    update public.unit_recurring_charges
       set end_date = greatest(start_date, v_start - 1),
           active = coalesce(start_date < v_start and next_post_date <= v_start - 1, false),
           updated_at = now()
     where unit_id = sub.unit_id
       and charge_category_id = v_cat_id
       and active
       and (end_date is null or end_date >= v_start);

    insert into public.unit_recurring_charges (
      unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, active, created_by
    ) values (
      sub.unit_id, v_cat_id, round(sub.amount, 2), v_row_freq, v_start, greatest(v_start, coalesce(v_next, v_start)),
      left(coalesce(nullif(btrim(sub.memo), ''), nullif(btrim(p_memo), '')), 500), true, auth.uid()
    ) returning id into new_id;

    new_ids := array_append(new_ids, new_id);
    cnt := cnt + 1;
  end loop;

  return query select cnt, new_ids;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Bulk one-time charges: the association's own categories, due date
--    defaults to 30 days after the association's today.
-- ---------------------------------------------------------------------------
create or replace function public.bulk_create_charges(p_charges jsonb, p_charge_category_id uuid DEFAULT NULL::uuid, p_due_date date DEFAULT NULL::date, p_description text DEFAULT NULL::text, p_gl_account_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(inserted_count integer, charge_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  charge record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_portfolio uuid;
  v_assoc uuid;
  v_cat public.charge_categories;
  v_cat_id uuid;
  v_due date;
  v_gl_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_charges is null or jsonb_typeof(p_charges) <> 'array' or jsonb_array_length(p_charges) = 0 then
    raise exception 'No charges supplied' using errcode = '22023';
  end if;
  if jsonb_array_length(p_charges) > 5000 then
    raise exception 'At most 5000 charges per batch' using errcode = '22023';
  end if;

  for charge in
    select * from jsonb_to_recordset(p_charges)
      as x(unit_id uuid, amount numeric, description text, charge_category_id uuid, due_date date, gl_account_id uuid)
  loop
    v_portfolio := public.unit_portfolio_id(charge.unit_id);
    if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;
    v_assoc := public.unit_association_id(charge.unit_id);
    if not public.can_view_association_row(v_assoc) then
      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;
    if charge.amount is null or charge.amount <= 0 or charge.amount > 10000000 then
      raise exception 'Charge amount must be positive' using errcode = '22023';
    end if;

    v_cat_id := coalesce(charge.charge_category_id, p_charge_category_id);
    v_cat := null;
    if v_cat_id is not null then
      -- fix: the category must also be the unit's association's (or company-wide).
      select * into v_cat from public.charge_categories c
       where c.id = v_cat_id and c.portfolio_id = v_portfolio and c.active and c.archived_at is null
         and (c.association_id is null or c.association_id = v_assoc);
      if not found then raise exception 'Charge category is outside this association or inactive' using errcode = '42501'; end if;
    end if;

    v_gl_id := coalesce(charge.gl_account_id, p_gl_account_id, v_cat.gl_account_id);
    if v_gl_id is not null and not exists (
      select 1 from public.gl_accounts g where g.id = v_gl_id and g.portfolio_id = v_portfolio and g.active
    ) then
      raise exception 'GL account is outside this company or inactive' using errcode = '42501';
    end if;

    -- fix: association-local today, not the server's (UTC).
    v_due := coalesce(charge.due_date, p_due_date, (public.association_local_date(v_assoc) + 30));

    insert into public.charges (
      unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by
    ) values (
      charge.unit_id, v_cat_id, coalesce(v_cat.charge_type, 'assessment'::public.charge_type),
      left(coalesce(nullif(btrim(charge.description), ''), nullif(btrim(p_description), ''), v_cat.name, 'Assessment charge'), 500),
      round(charge.amount, 2), v_due, v_gl_id, auth.uid()
    ) returning id into new_id;

    new_ids := array_append(new_ids, new_id);
    cnt := cnt + 1;
  end loop;

  return query select cnt, new_ids;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Daily posting: post what is due by each association's own date, and
--    never to an archived unit.
-- ---------------------------------------------------------------------------
create or replace function public.post_unit_recurring_charges()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare row record; n integer := 0; new_charge_id uuid; next_due date;
begin
  for row in
    select urc.*, cc.name as category_name, cc.gl_account_id as category_gl,
           cc.charge_type as category_charge_type, cc.code as category_code
      from public.unit_recurring_charges urc
      join public.charge_categories cc on cc.id = urc.charge_category_id
      join public.units un on un.id = urc.unit_id
      join public.buildings b on b.id = un.building_id
      join public.associations a on a.id = b.association_id
     where urc.active and cc.active
       and un.archived_at is null                                    -- fix
       -- fix: due by the association's own date (same rule as
       -- association_local_date, inlined: no per-row function call).
       and urc.next_post_date <= (now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date
       -- fix: a recurring charge whose category is not the association's
       -- (the category trigger refuses it) is skipped, so one bad row
       -- can't stop every association's posting.
       and (cc.portfolio_id is null or cc.portfolio_id = a.portfolio_id)
       and (cc.association_id is null or cc.association_id = b.association_id)
       and (urc.end_date is null or urc.next_post_date <= urc.end_date)
  loop
    perform 1 from public.units where id = row.unit_id for update;
    perform 1 from public.unit_recurring_charges u
     where u.id = row.id and u.active and u.next_post_date = row.next_post_date
       and (u.end_date is null or u.next_post_date <= u.end_date)
       for update;
    if not found then
      continue;
    end if;

    insert into public.charges (
      unit_id, charge_category_id, charge_type, description,
      amount, due_date, gl_account_id, created_by
    ) values (
      row.unit_id, row.charge_category_id, row.category_charge_type,
      coalesce(row.memo, row.category_name),
      row.amount, row.next_post_date, row.category_gl, row.created_by
    ) returning id into new_charge_id;

    next_due := public.recurring_next_date(row.next_post_date, row.frequency::text, 1,
      extract(day from coalesce(row.start_date, row.next_post_date))::integer);

    update public.unit_recurring_charges set next_post_date = next_due, last_posted_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. subscribe_unit_to_charge: a blank or omitted start date means the association's
--    today (callers pass null), and signed-out callers can't run it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscribe_unit_to_charge(p_unit_id uuid, p_charge_category_id uuid, p_amount numeric DEFAULT NULL::numeric, p_frequency recurring_frequency DEFAULT NULL::recurring_frequency, p_start_date date DEFAULT NULL::date, p_memo text DEFAULT NULL::text)
 RETURNS unit_recurring_charges
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare cat public.charge_categories; row public.unit_recurring_charges; v_start date;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  -- fix: a blank start date is the association's today, not UTC's (the unit
  -- read under the caller's own access).
  v_start := p_start_date;
  if v_start is null then
    select public.association_local_date(b.association_id) into v_start
      from public.units u join public.buildings b on b.id = u.building_id
     where u.id = p_unit_id;
    if v_start is null then raise exception 'unit not found'; end if;
  end if;
  insert into public.unit_recurring_charges (
    unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, created_by
  ) values (
    p_unit_id, p_charge_category_id,
    coalesce(p_amount, cat.default_amount),
    coalesce(p_frequency, cat.default_frequency),
    v_start, v_start, p_memo, auth.uid()
  ) returning * into row;
  return row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.subscribe_unit_to_charge(p_unit_id uuid, p_charge_category_id uuid, p_amount numeric DEFAULT NULL::numeric, p_frequency recurring_frequency DEFAULT NULL::recurring_frequency, p_start_date date DEFAULT NULL::date, p_memo text DEFAULT NULL::text, p_identifier text DEFAULT NULL::text)
 RETURNS unit_recurring_charges
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare cat public.charge_categories; row public.unit_recurring_charges; v_start date;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  -- fix: a blank start date is the association's today, not UTC's (the unit
  -- read under the caller's own access).
  v_start := p_start_date;
  if v_start is null then
    select public.association_local_date(b.association_id) into v_start
      from public.units u join public.buildings b on b.id = u.building_id
     where u.id = p_unit_id;
    if v_start is null then raise exception 'unit not found'; end if;
  end if;
  insert into public.unit_recurring_charges (
    unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, identifier, created_by
  ) values (
    p_unit_id, p_charge_category_id,
    coalesce(p_amount, cat.default_amount),
    coalesce(p_frequency, cat.default_frequency),
    v_start, v_start, p_memo, p_identifier, auth.uid()
  ) returning * into row;
  return row;
end;
$function$;

revoke execute on function public.subscribe_unit_to_charge(uuid, uuid, numeric, public.recurring_frequency, date, text) from public, anon;
revoke execute on function public.subscribe_unit_to_charge(uuid, uuid, numeric, public.recurring_frequency, date, text, text) from public, anon;
grant execute on function public.subscribe_unit_to_charge(uuid, uuid, numeric, public.recurring_frequency, date, text) to authenticated, service_role;
grant execute on function public.subscribe_unit_to_charge(uuid, uuid, numeric, public.recurring_frequency, date, text, text) to authenticated, service_role;
