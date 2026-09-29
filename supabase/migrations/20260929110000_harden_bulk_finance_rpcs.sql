-- SECURITY: three SECURITY DEFINER finance RPCs were executable by every
-- authenticated user (owners and vendors included) with no authorization or
-- tenant check in their bodies:
--   bulk_create_charges            — post charges to ANY unit in ANY portfolio
--   bulk_create_recurring_charges  — subscribe ANY unit to recurring charges
--   generate_owner_statements      — build statement batches for ANY association
-- Each now requires finance permission for the target portfolio, validates
-- every unit / category / GL account against that portfolio, and pins
-- search_path. Bulk charges also take their charge_type from the category
-- (previously hard-coded 'assessment', so a fee category posted as dues).

create or replace function public.unit_portfolio_id(p_unit_id uuid)
returns uuid
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select a.portfolio_id
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = p_unit_id
     and u.archived_at is null
     and b.archived_at is null
     and a.archived_at is null;
$$;

create or replace function public.bulk_create_charges(
  p_charges jsonb,
  p_charge_category_id uuid default null,
  p_due_date date default null,
  p_description text default null,
  p_gl_account_id uuid default null
) returns table(inserted_count integer, charge_ids uuid[])
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  charge record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_portfolio uuid;
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
    if charge.amount is null or charge.amount <= 0 or charge.amount > 10000000 then
      raise exception 'Charge amount must be positive' using errcode = '22023';
    end if;

    v_cat_id := coalesce(charge.charge_category_id, p_charge_category_id);
    v_cat := null;
    if v_cat_id is not null then
      select * into v_cat from public.charge_categories c
       where c.id = v_cat_id and c.portfolio_id = v_portfolio and c.active and c.archived_at is null;
      if not found then raise exception 'Charge category is outside this portfolio or inactive' using errcode = '42501'; end if;
    end if;

    v_gl_id := coalesce(charge.gl_account_id, p_gl_account_id, v_cat.gl_account_id);
    if v_gl_id is not null and not exists (
      select 1 from public.gl_accounts g where g.id = v_gl_id and g.portfolio_id = v_portfolio and g.active
    ) then
      raise exception 'GL account is outside this portfolio or inactive' using errcode = '42501';
    end if;

    v_due := coalesce(charge.due_date, p_due_date, (current_date + 30));

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
$$;

create or replace function public.bulk_create_recurring_charges(
  p_subscriptions jsonb,
  p_charge_category_id uuid default null,
  p_frequency text default 'monthly',
  p_start_date date default null,
  p_memo text default null
) returns table(inserted_count integer, subscription_ids uuid[])
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  sub record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_portfolio uuid;
  v_cat_id uuid;
  v_freq public.recurring_frequency;
  v_row_freq public.recurring_frequency;
  v_start date;
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
    if sub.amount is null or sub.amount <= 0 or sub.amount > 10000000 then
      raise exception 'Recurring amount must be positive' using errcode = '22023';
    end if;
    v_cat_id := coalesce(sub.charge_category_id, p_charge_category_id);
    if v_cat_id is null or not exists (
      select 1 from public.charge_categories c
       where c.id = v_cat_id and c.portfolio_id = v_portfolio and c.active and c.archived_at is null
    ) then
      raise exception 'Charge category is outside this portfolio or inactive' using errcode = '42501';
    end if;

    v_row_freq := v_freq;
    if sub.frequency is not null then
      begin
        v_row_freq := sub.frequency::public.recurring_frequency;
      exception when others then
        raise exception 'Invalid frequency: %', sub.frequency using errcode = '22023';
      end;
    end if;
    v_start := coalesce(sub.start_date, p_start_date, current_date);

    insert into public.unit_recurring_charges (
      unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, active, created_by
    ) values (
      sub.unit_id, v_cat_id, round(sub.amount, 2), v_row_freq, v_start, v_start,
      left(coalesce(nullif(btrim(sub.memo), ''), nullif(btrim(p_memo), '')), 500), true, auth.uid()
    ) returning id into new_id;

    new_ids := array_append(new_ids, new_id);
    cnt := cnt + 1;
  end loop;

  return query select cnt, new_ids;
end;
$$;

create or replace function public.generate_owner_statements(
  p_association_id uuid,
  p_period_start date,
  p_period_end date,
  p_delivery_channel text default 'email',
  p_batch_name text default null
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_batch_id uuid;
  v_portfolio uuid;
  v_owner record;
  v_total_due numeric;
  v_amount_due numeric;
  v_amount_past_due numeric;
begin
  select a.portfolio_id into v_portfolio from public.associations a
   where a.id = p_association_id and a.archived_at is null;
  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Enter a valid statement period' using errcode = '22023';
  end if;

  insert into public.statement_batches (
    association_id, batch_name, period_start, period_end, delivery_channel, status, created_by
  ) values (
    p_association_id,
    left(coalesce(nullif(btrim(p_batch_name), ''), 'Statement batch ' || to_char(p_period_end, 'Mon YYYY')), 200),
    p_period_start, p_period_end, p_delivery_channel, 'generating', auth.uid()
  ) returning id into v_batch_id;

  for v_owner in
    select o.id as owner_id, occ.unit_id, occ.id as occupancy_id
      from public.occupancies occ
      join public.owners o on o.id = occ.owner_id
     where occ.association_id = p_association_id
       and occ.status = 'current'
       and o.archived_at is null
  loop
    select coalesce(sum(case when c.due_date <= p_period_end then c.amount else 0 end), 0),
           coalesce(sum(case when c.due_date < p_period_start then c.amount else 0 end), 0)
      into v_total_due, v_amount_past_due
      from public.charges c
     where c.unit_id = v_owner.unit_id;

    select v_total_due - coalesce(sum(p.amount), 0) into v_amount_due
      from public.payments p
     where p.unit_id = v_owner.unit_id
       and p.payment_date <= p_period_end;

    insert into public.owner_statements (
      batch_id, association_id, owner_id, unit_id, occupancy_id, period_start, period_end,
      delivery_channel, delivery_status, amount_due, amount_past_due, total_due, created_by
    ) values (
      v_batch_id, p_association_id, v_owner.owner_id, v_owner.unit_id, v_owner.occupancy_id,
      p_period_start, p_period_end, p_delivery_channel, 'pending',
      greatest(v_amount_due, 0), greatest(v_amount_past_due, 0), greatest(v_total_due, 0), auth.uid()
    );
  end loop;

  update public.statement_batches
     set total_owners = (select count(*) from public.owner_statements where batch_id = v_batch_id),
         generated_count = (select count(*) from public.owner_statements where batch_id = v_batch_id),
         status = 'generated',
         updated_at = now()
   where id = v_batch_id;

  return v_batch_id;
end;
$$;

alter function public.unit_portfolio_id(uuid) owner to postgres;
alter function public.bulk_create_charges(jsonb, uuid, date, text, uuid) owner to postgres;
alter function public.bulk_create_recurring_charges(jsonb, uuid, text, date, text) owner to postgres;
alter function public.generate_owner_statements(uuid, date, date, text, text) owner to postgres;

revoke all on function public.unit_portfolio_id(uuid) from public, anon, authenticated;
revoke all on function public.bulk_create_charges(jsonb, uuid, date, text, uuid) from public, anon;
revoke all on function public.bulk_create_recurring_charges(jsonb, uuid, text, date, text) from public, anon;
revoke all on function public.generate_owner_statements(uuid, date, date, text, text) from public, anon;
grant execute on function public.bulk_create_charges(jsonb, uuid, date, text, uuid) to authenticated, service_role;
grant execute on function public.bulk_create_recurring_charges(jsonb, uuid, text, date, text) to authenticated, service_role;
grant execute on function public.generate_owner_statements(uuid, date, date, text, text) to authenticated, service_role;
