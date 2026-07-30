-- =============================================================================
-- Phase 19 — Editable chargeable-items catalog + per-unit recurring charges
-- =============================================================================

create table public.charge_categories (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  name text not null check (length(name) between 1 and 150),
  code text,
  description text,
  default_amount numeric(12,2) not null default 0 check (default_amount >= 0),
  default_frequency public.recurring_frequency not null default 'monthly',
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  charge_type public.charge_type not null default 'other',
  is_income boolean not null default true,
  is_assessment boolean not null default false,
  is_fee boolean not null default false,
  is_system boolean not null default false,
  icon text,
  color text,
  applies_by_default boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_charge_categories_portfolio on public.charge_categories(portfolio_id) where active and archived_at is null;
create index idx_charge_categories_association on public.charge_categories(association_id);
create unique index uq_charge_categories_code on public.charge_categories(portfolio_id, association_id, lower(code)) where code is not null;
create trigger trg_charge_categories_updated before update on public.charge_categories
  for each row execute function public.touch_updated_at();

alter table public.charge_categories enable row level security;
create policy charge_categories_finance_all on public.charge_categories
  for all to authenticated using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));
create policy charge_categories_staff_read on public.charge_categories
  for select to authenticated using (public.can_access_portfolio(portfolio_id));
create policy charge_categories_resident_read on public.charge_categories
  for select to authenticated using (public.is_portal_resident() and active);
create policy charge_categories_board_read on public.charge_categories
  for select to authenticated using (public.is_board_user() and active);

alter table public.charges
  add column charge_category_id uuid references public.charge_categories(id) on delete set null;
create index idx_charges_category on public.charges(charge_category_id);

create table public.unit_recurring_charges (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  charge_category_id uuid not null references public.charge_categories(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  frequency public.recurring_frequency not null default 'monthly',
  start_date date not null default current_date,
  end_date date,
  next_post_date date not null default current_date,
  last_posted_at timestamptz,
  memo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (end_date is null or end_date >= start_date)
);
create index idx_unit_recurring_charges_unit on public.unit_recurring_charges(unit_id) where active;
create index idx_unit_recurring_charges_category on public.unit_recurring_charges(charge_category_id);
create index idx_unit_recurring_charges_next on public.unit_recurring_charges(next_post_date) where active;
create trigger trg_unit_recurring_charges_updated before update on public.unit_recurring_charges
  for each row execute function public.touch_updated_at();

alter table public.unit_recurring_charges enable row level security;
create policy unit_recurring_charges_finance on public.unit_recurring_charges
  for all to authenticated
  using (exists (select 1 from public.units u
                 join public.buildings b on b.id = u.building_id
                 join public.associations a on a.id = b.association_id
                 where u.id = unit_id and public.can_manage_finance(a.portfolio_id)))
  with check (exists (select 1 from public.units u
                      join public.buildings b on b.id = u.building_id
                      join public.associations a on a.id = b.association_id
                      where u.id = unit_id and public.can_manage_finance(a.portfolio_id)));
create policy unit_recurring_charges_staff_read on public.unit_recurring_charges
  for select to authenticated
  using (exists (select 1 from public.units u
                 join public.buildings b on b.id = u.building_id
                 where u.id = unit_id and public.can_access_association(b.association_id)));
create policy unit_recurring_charges_resident_read on public.unit_recurring_charges
  for select to authenticated
  using (unit_id in (select public.current_resident_unit_ids()));

create or replace function public.post_unit_recurring_charges()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare row record; n integer := 0; new_charge_id uuid; next_due date;
begin
  for row in
    select urc.*, cc.name as category_name, cc.gl_account_id as category_gl,
           cc.charge_type as category_charge_type, cc.code as category_code
      from public.unit_recurring_charges urc
      join public.charge_categories cc on cc.id = urc.charge_category_id
     where urc.active and cc.active
       and urc.next_post_date <= current_date
       and (urc.end_date is null or urc.next_post_date <= urc.end_date)
  loop
    insert into public.charges (
      unit_id, charge_category_id, charge_type, description,
      amount, due_date, gl_account_id, created_by
    ) values (
      row.unit_id, row.charge_category_id, row.category_charge_type,
      coalesce(row.memo, row.category_name),
      row.amount, row.next_post_date, row.category_gl, row.created_by
    ) returning id into new_charge_id;

    next_due := case row.frequency
      when 'daily'     then row.next_post_date + interval '1 day'
      when 'weekly'    then row.next_post_date + interval '1 week'
      when 'monthly'   then row.next_post_date + interval '1 month'
      when 'quarterly' then row.next_post_date + interval '3 months'
      when 'annually'  then row.next_post_date + interval '1 year'
    end::date;

    update public.unit_recurring_charges set next_post_date = next_due, last_posted_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.post_unit_recurring_charges() to authenticated, service_role;

select cron.schedule('post-unit-recurring-charges-daily', '0 6 * * *', $$ select public.post_unit_recurring_charges(); $$);

create or replace function public.subscribe_unit_to_charge(
  p_unit_id uuid, p_charge_category_id uuid,
  p_amount numeric default null, p_frequency public.recurring_frequency default null,
  p_start_date date default current_date, p_memo text default null
)
returns public.unit_recurring_charges
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare cat public.charge_categories; row public.unit_recurring_charges;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  insert into public.unit_recurring_charges (
    unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, created_by
  ) values (
    p_unit_id, p_charge_category_id,
    coalesce(p_amount, cat.default_amount),
    coalesce(p_frequency, cat.default_frequency),
    p_start_date, p_start_date, p_memo, auth.uid()
  ) returning * into row;
  return row;
end;
$$;

grant execute on function public.subscribe_unit_to_charge(uuid, uuid, numeric, public.recurring_frequency, date, text) to authenticated;

create or replace function public.subscribe_association_to_charge(
  p_association_id uuid, p_charge_category_id uuid,
  p_amount numeric default null, p_frequency public.recurring_frequency default null
)
returns integer language plpgsql security invoker set search_path = pg_catalog, public as $$
declare cat public.charge_categories; unit_row record; n integer := 0;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  for unit_row in
    select u.id from public.units u
    join public.buildings b on b.id = u.building_id
    where b.association_id = p_association_id and u.archived_at is null
  loop
    insert into public.unit_recurring_charges (
      unit_id, charge_category_id, amount, frequency, created_by
    ) values (
      unit_row.id, p_charge_category_id,
      coalesce(p_amount, cat.default_amount),
      coalesce(p_frequency, cat.default_frequency),
      auth.uid()
    ) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.subscribe_association_to_charge(uuid, uuid, numeric, public.recurring_frequency) to authenticated;

create or replace function public.post_ad_hoc_charge(
  p_unit_id uuid, p_charge_category_id uuid, p_amount numeric,
  p_description text, p_due_date date default current_date + 30
)
returns public.charges
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare cat public.charge_categories; row public.charges;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  insert into public.charges (
    unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by
  ) values (
    p_unit_id, p_charge_category_id, cat.charge_type, p_description,
    p_amount, p_due_date, cat.gl_account_id, auth.uid()
  ) returning * into row;
  return row;
end;
$$;

grant execute on function public.post_ad_hoc_charge(uuid, uuid, numeric, text, date) to authenticated;

-- Seeding: regular function (callable) + trigger for new portfolios
create or replace function public.seed_standard_charge_categories(p_portfolio_id uuid)
returns integer language plpgsql security invoker set search_path = pg_catalog, public as $$
declare n integer := 0;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'permission denied';
  end if;
  insert into public.charge_categories (
    portfolio_id, name, code, description, default_amount, default_frequency,
    charge_type, is_income, is_assessment, is_fee, is_system, applies_by_default, sort_order
  ) values
    (p_portfolio_id, 'HOA Dues',           'DUES',      'Regular monthly HOA assessment',            0, 'monthly',  'assessment',         true, true,  false, true, true,  10),
    (p_portfolio_id, 'Special Assessment', 'SPECIAL',   'One-time or short-term assessment',          0, 'monthly',  'special_assessment', true, true,  false, true, false, 20),
    (p_portfolio_id, 'Parking Fee',        'PARKING',   'Monthly parking space rental',               0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 30),
    (p_portfolio_id, 'Storage Fee',        'STORAGE',   'Monthly storage locker rental',              0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 35),
    (p_portfolio_id, 'Cable TV',           'CABLE',     'Bulk cable service passed through',          0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 40),
    (p_portfolio_id, 'Internet',           'INTERNET',  'Bulk internet service passed through',       0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 45),
    (p_portfolio_id, 'Pool Key Fee',       'POOLKEY',   'Pool key / fob issuance',                    0, 'annually', 'amenity_fee',        true, false, true,  true, false, 50),
    (p_portfolio_id, 'Move-In Fee',        'MOVEIN',    'One-time move-in charge',                    0, 'annually', 'move_fee',           true, false, true,  true, false, 55),
    (p_portfolio_id, 'Move-Out Fee',       'MOVEOUT',   'One-time move-out charge',                   0, 'annually', 'move_fee',           true, false, true,  true, false, 60),
    (p_portfolio_id, 'Late Fee',           'LATEFEE',   'Auto-posted late payment fee',               0, 'monthly',  'late_fee',           true, false, true,  true, false, 70),
    (p_portfolio_id, 'NSF Fee',            'NSFFEE',    'Returned payment fee',                       0, 'monthly',  'nsf_fee',            true, false, true,  true, false, 75),
    (p_portfolio_id, 'Violation Fine',     'VIOLATION', 'HOA rules violation fine',                   0, 'monthly',  'fine',               true, false, true,  true, false, 80),
    (p_portfolio_id, 'Other',              'OTHER',     'Custom / miscellaneous charge',              0, 'monthly',  'other',              true, false, false, true, false, 100)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.seed_standard_charge_categories(uuid) to authenticated;

create or replace function public.trg_seed_standard_charge_categories()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.charge_categories (
    portfolio_id, name, code, description, default_amount, default_frequency,
    charge_type, is_income, is_assessment, is_fee, is_system, applies_by_default, sort_order
  ) values
    (new.id, 'HOA Dues',           'DUES',      'Regular monthly HOA assessment',            0, 'monthly',  'assessment',         true, true,  false, true, true,  10),
    (new.id, 'Special Assessment', 'SPECIAL',   'One-time or short-term assessment',          0, 'monthly',  'special_assessment', true, true,  false, true, false, 20),
    (new.id, 'Parking Fee',        'PARKING',   'Monthly parking space rental',               0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 30),
    (new.id, 'Storage Fee',        'STORAGE',   'Monthly storage locker rental',              0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 35),
    (new.id, 'Cable TV',           'CABLE',     'Bulk cable service passed through',          0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 40),
    (new.id, 'Internet',           'INTERNET',  'Bulk internet service passed through',       0, 'monthly',  'amenity_fee',        true, false, true,  true, false, 45),
    (new.id, 'Pool Key Fee',       'POOLKEY',   'Pool key / fob issuance',                    0, 'annually', 'amenity_fee',        true, false, true,  true, false, 50),
    (new.id, 'Move-In Fee',        'MOVEIN',    'One-time move-in charge',                    0, 'annually', 'move_fee',           true, false, true,  true, false, 55),
    (new.id, 'Move-Out Fee',       'MOVEOUT',   'One-time move-out charge',                   0, 'annually', 'move_fee',           true, false, true,  true, false, 60),
    (new.id, 'Late Fee',           'LATEFEE',   'Auto-posted late payment fee',               0, 'monthly',  'late_fee',           true, false, true,  true, false, 70),
    (new.id, 'NSF Fee',            'NSFFEE',    'Returned payment fee',                       0, 'monthly',  'nsf_fee',            true, false, true,  true, false, 75),
    (new.id, 'Violation Fine',     'VIOLATION', 'HOA rules violation fine',                   0, 'monthly',  'fine',               true, false, true,  true, false, 80),
    (new.id, 'Other',              'OTHER',     'Custom / miscellaneous charge',              0, 'monthly',  'other',              true, false, false, true, false, 100)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auto_seed_charge_categories on public.portfolios;
create trigger trg_auto_seed_charge_categories
  after insert on public.portfolios
  for each row execute function public.trg_seed_standard_charge_categories();

create or replace view public.v_unit_charge_schedule
  with (security_invoker = true) as
select
  urc.id as recurring_charge_id,
  urc.unit_id, u.unit_number,
  b.association_id, a.name as association_name, a.portfolio_id,
  cc.id as charge_category_id, cc.name as category_name, cc.code as category_code,
  cc.charge_type, cc.is_assessment, cc.is_fee,
  urc.amount, urc.frequency, urc.start_date, urc.end_date,
  urc.next_post_date, urc.last_posted_at, urc.active, urc.memo
from public.unit_recurring_charges urc
join public.charge_categories cc on cc.id = urc.charge_category_id
join public.units u on u.id = urc.unit_id
join public.buildings b on b.id = u.building_id
join public.associations a on a.id = b.association_id;

create or replace view public.v_charges_by_category
  with (security_invoker = true) as
select
  a.portfolio_id, a.id as association_id, a.name as association_name,
  cc.id as category_id, cc.name as category_name, cc.code as category_code,
  cc.is_assessment, cc.is_fee,
  date_trunc('month', c.due_date)::date as period_month,
  count(*) as charge_count,
  sum(c.amount) as total_charged,
  sum(coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as total_applied,
  sum(c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as outstanding_balance
from public.charges c
join public.units u on u.id = c.unit_id
join public.buildings b on b.id = u.building_id
join public.associations a on a.id = b.association_id
left join public.charge_categories cc on cc.id = c.charge_category_id
group by a.portfolio_id, a.id, a.name, cc.id, cc.name, cc.code, cc.is_assessment, cc.is_fee, date_trunc('month', c.due_date);
;
