-- Violation rule library + escalation engine.
--
-- * house_rules becomes the per-association rule library (article, text,
--   action to resolve, default type) with a starter library and cross-
--   association copy.
-- * violation_followup_steps becomes the escalation ladder: an association
--   default schedule, optionally overridden per rule. Steps are notices or
--   fines (fee > 0) and may offer a hearing.
-- * Fines post to the owner's unit ledger as `fine` charges, idempotently
--   (one fine per violation step), through the association's fine category.
-- * Due-process gate: when the association requires it (default ON — most
--   state statutes require notice and an opportunity to be heard before a
--   fine), a fine step is refused until a notice went out AND either the
--   hearing window lapsed without a request or a hearing upheld the
--   violation. Owner hearing requests (existing RPC) block fines until the
--   hearing decision is recorded.
-- * All writes go through SECURITY DEFINER RPCs scoped to staff who can
--   access the association (including manager association scoping).

-- ── Access helper ───────────────────────────────────────────────────────────
create or replace function public.can_manage_violations(p_association_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select p_association_id is not null
     and (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     and public.can_access_association(p_association_id)
     and public.can_view_association_row(p_association_id);
$$;

-- ── Rule library ────────────────────────────────────────────────────────────
alter table public.house_rules
  add column if not exists action_to_resolve text,
  add column if not exists default_violation_type public.violation_type not null default 'other',
  add column if not exists custom_schedule boolean not null default false,
  add column if not exists archived_at timestamptz;

create unique index if not exists house_rules_assoc_rule_number_unique
  on public.house_rules (association_id, lower(rule_number))
  where archived_at is null;

-- ── Association violation policy ────────────────────────────────────────────
create table if not exists public.association_violation_settings (
  association_id uuid primary key references public.associations(id) on delete cascade,
  hearing_required_before_fine boolean not null default true,
  hearing_request_days integer not null default 14 check (hearing_request_days between 0 and 90),
  default_cure_days integer not null default 14 check (default_cure_days between 0 and 365),
  fine_charge_category_id uuid references public.charge_categories(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.association_violation_settings enable row level security;

drop policy if exists association_violation_settings_staff_read on public.association_violation_settings;
create policy association_violation_settings_staff_read on public.association_violation_settings
  for select to authenticated using (public.can_manage_violations(association_id));
drop policy if exists association_violation_settings_board_read on public.association_violation_settings;
create policy association_violation_settings_board_read on public.association_violation_settings
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));

-- ── Escalation schedule ─────────────────────────────────────────────────────
alter table public.violation_followup_steps
  add column if not exists house_rule_id uuid references public.house_rules(id) on delete cascade,
  add column if not exists offers_hearing boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'violation_followup_steps_days_check'
                  and conrelid = 'public.violation_followup_steps'::regclass) then
    alter table public.violation_followup_steps
      add constraint violation_followup_steps_days_check check (days_after_previous between 0 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'violation_followup_steps_fee_check'
                  and conrelid = 'public.violation_followup_steps'::regclass) then
    alter table public.violation_followup_steps
      add constraint violation_followup_steps_fee_check check (fee is null or (fee >= 0 and fee <= 100000));
  end if;
end $$;

create index if not exists idx_violation_followup_rule
  on public.violation_followup_steps (house_rule_id, step_order) where archived_at is null;

drop policy if exists violation_followup_steps_staff_read on public.violation_followup_steps;
create policy violation_followup_steps_staff_read on public.violation_followup_steps
  for select to authenticated using (public.can_manage_violations(association_id));
drop policy if exists violation_followup_steps_board_read on public.violation_followup_steps;
create policy violation_followup_steps_board_read on public.violation_followup_steps
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));

-- ── Violation escalation state ──────────────────────────────────────────────
alter table public.violations
  add column if not exists house_rule_id uuid references public.house_rules(id) on delete set null,
  add column if not exists current_step integer not null default 0,
  add column if not exists next_followup_on date,
  add column if not exists last_step_at timestamptz,
  add column if not exists fines_total numeric(12,2) not null default 0;

create index if not exists idx_violations_next_followup
  on public.violations (association_id, next_followup_on)
  where archived_at is null and status not in ('cured', 'closed');

create table if not exists public.violation_fines (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.violations(id) on delete cascade,
  step_id uuid references public.violation_followup_steps(id) on delete set null,
  step_order integer not null,
  step_name text not null,
  charge_id uuid not null unique references public.charges(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  assessed_by uuid,
  assessed_at timestamptz not null default now(),
  unique (violation_id, step_order)
);
alter table public.violation_fines enable row level security;

drop policy if exists violation_fines_staff_read on public.violation_fines;
create policy violation_fines_staff_read on public.violation_fines
  for select to authenticated
  using (exists (select 1 from public.violations v where v.id = violation_id and public.can_manage_violations(v.association_id)));
drop policy if exists violation_fines_board_read on public.violation_fines;
create policy violation_fines_board_read on public.violation_fines
  for select to authenticated
  using (public.is_board_user() and exists (
    select 1 from public.violations v
     where v.id = violation_id and v.association_id in (select public.current_board_association_ids())));
drop policy if exists violation_fines_owner_read on public.violation_fines;
create policy violation_fines_owner_read on public.violation_fines
  for select to authenticated
  using (exists (select 1 from public.violations v where v.id = violation_id and v.owner_id = public.current_owner_id()));

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Effective schedule for a violation: the rule's custom steps, else the
-- association default. Ordered; ordinal = 1-based position.
create or replace function public.violation_schedule(p_association_id uuid, p_house_rule_id uuid)
returns table(ordinal integer, id uuid, follow_up_name text, days_after_previous integer,
              letter_template_id uuid, delivery_methods text[], fee numeric,
              gl_account_id uuid, offers_hearing boolean)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with use_custom as (
    select coalesce((select hr.custom_schedule from public.house_rules hr
                      where hr.id = p_house_rule_id and hr.association_id = p_association_id), false) as custom
  )
  select (row_number() over (order by s.step_order, s.created_at))::integer,
         s.id, s.follow_up_name, s.days_after_previous, s.letter_template_id,
         s.delivery_methods, coalesce(s.fee, 0), s.gl_account_id, s.offers_hearing
    from public.violation_followup_steps s, use_custom
   where s.association_id = p_association_id
     and s.archived_at is null
     and ((use_custom.custom and s.house_rule_id = p_house_rule_id)
          or (not use_custom.custom and s.house_rule_id is null));
$$;

create or replace function public.log_violation_event(
  p_violation_id uuid, p_note text, p_new_status public.violation_status, p_owner_visible boolean
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.violation_updates (violation_id, note, new_status, created_by)
  values (p_violation_id, left(p_note, 2000), p_new_status,
          case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end);
  if p_owner_visible then
    update public.violations
       set owner_visible_history = coalesce(owner_visible_history, '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object('at', now(), 'event', left(p_note, 500)))
     where id = p_violation_id;
  end if;
end;
$$;

-- ── Rule library RPCs ───────────────────────────────────────────────────────
create or replace function public.save_house_rule(
  p_id uuid,
  p_association_id uuid,
  p_rule_number text,
  p_title text,
  p_description text,
  p_action_to_resolve text,
  p_category text,
  p_default_violation_type public.violation_type,
  p_fine_amount numeric,
  p_active boolean
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_existing public.house_rules;
begin
  if not public.can_manage_violations(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_rule_number, '')), '') is null or nullif(btrim(coalesce(p_title, '')), '') is null
     or nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'Rule number, title, and rule text are required' using errcode = '22023';
  end if;
  if length(p_title) > 200 or length(p_description) > 8000 or length(coalesce(p_action_to_resolve, '')) > 2000 then
    raise exception 'Rule text is too long' using errcode = '22023';
  end if;
  if p_fine_amount is not null and (p_fine_amount < 0 or p_fine_amount > 100000) then
    raise exception 'Default fine must be between 0 and 100,000' using errcode = '22023';
  end if;

  if p_id is not null then
    select * into v_existing from public.house_rules where id = p_id for update;
    if not found or v_existing.association_id <> p_association_id or v_existing.archived_at is not null then
      raise exception 'Rule not found' using errcode = 'P0002';
    end if;
    update public.house_rules
       set rule_number = btrim(p_rule_number), title = btrim(p_title), description = btrim(p_description),
           action_to_resolve = nullif(btrim(coalesce(p_action_to_resolve, '')), ''),
           category = coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'general'),
           default_violation_type = coalesce(p_default_violation_type, 'other'),
           fine_amount = p_fine_amount, active = coalesce(p_active, true), updated_at = now()
     where id = p_id
     returning id into v_id;
  else
    insert into public.house_rules (
      association_id, rule_number, title, description, action_to_resolve, category,
      default_violation_type, fine_amount, active, sort_order
    ) values (
      p_association_id, btrim(p_rule_number), btrim(p_title), btrim(p_description),
      nullif(btrim(coalesce(p_action_to_resolve, '')), ''),
      coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'general'),
      coalesce(p_default_violation_type, 'other'), p_fine_amount, coalesce(p_active, true),
      coalesce((select max(sort_order) + 1 from public.house_rules where association_id = p_association_id), 0)
    ) returning id into v_id;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Rule number % is already used in this association', btrim(p_rule_number) using errcode = '23505';
end;
$$;

create or replace function public.archive_house_rule(p_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_assoc uuid;
begin
  select association_id into v_assoc from public.house_rules where id = p_id;
  if v_assoc is null or not public.can_manage_violations(v_assoc) then raise exception 'Permission denied' using errcode = '42501'; end if;
  update public.house_rules set archived_at = now(), active = false, updated_at = now() where id = p_id;
end;
$$;

-- Default association schedule used when a rule has no custom one.
create or replace function public.ensure_default_violation_schedule(p_association_id uuid)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare n integer;
begin
  if not public.can_manage_violations(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  select count(*) into n from public.violation_followup_steps
   where association_id = p_association_id and house_rule_id is null and archived_at is null;
  if n > 0 then return 0; end if;
  insert into public.violation_followup_steps (association_id, step_order, days_after_previous, follow_up_name, delivery_methods, fee, offers_hearing)
  values
    (p_association_id, 1, 0,  'Courtesy notice', '{email,portal}', 0, false),
    (p_association_id, 2, 14, 'Formal notice with hearing opportunity', '{email,portal,mail}', 0, true),
    (p_association_id, 3, 14, 'First fine', '{email,portal,mail}', 50, false),
    (p_association_id, 4, 30, 'Continuing violation fine', '{email,portal,mail}', 100, false);
  return 4;
end;
$$;

create or replace function public.install_starter_house_rules(p_association_id uuid)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  n integer := 0;
  r record;
begin
  if not public.can_manage_violations(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  for r in
    select * from (values
      ('R-1', 'Quiet hours', 'noise', 'noise', 'Residents must not create noise audible in other units between 10:00 p.m. and 8:00 a.m., or unreasonable noise at any time.', 'Keep noise below disturbance level during quiet hours.'),
      ('R-2', 'Parking', 'parking', 'parking', 'Vehicles may park only in assigned or designated spaces. Guest, fire-lane, and loading areas may not be used for storage or overnight parking.', 'Move the vehicle to an assigned or permitted space.'),
      ('R-3', 'Inoperable or unregistered vehicles', 'parking', 'parking', 'Inoperable, unregistered, or stored vehicles may not remain on association property.', 'Repair, register, or remove the vehicle.'),
      ('R-4', 'Pets in common areas', 'pets', 'pets', 'Pets must be leashed and under control in common areas. Owners must immediately clean up after their pets.', 'Leash the pet and clean up any waste.'),
      ('R-5', 'Trash and recycling', 'waste', 'trash_debris', 'Trash and recycling must be bagged and placed only in designated receptacles. Items may not be left in hallways or common areas.', 'Remove the items and dispose of them in the designated area.'),
      ('R-6', 'Personal items in common areas', 'common_area', 'common_area_misuse', 'Personal property may not be stored in hallways, stairwells, lobbies, or other common areas.', 'Remove the personal items from the common area.'),
      ('R-7', 'Balconies and patios', 'appearance', 'exterior_modification', 'Balconies and patios must be kept neat. Laundry, storage, and unapproved fixtures may not be visible from outside.', 'Remove the items or fixtures from the balcony or patio.'),
      ('R-8', 'Exterior alterations', 'architectural', 'exterior_modification', 'No alteration of the building exterior, windows, doors, or limited common elements without prior written board approval.', 'Submit an architectural request or restore the original condition.'),
      ('R-9', 'Move-ins and deliveries', 'common_area', 'common_area_misuse', 'Moves and large deliveries must be scheduled with management and use designated elevators and hours.', 'Schedule future moves and deliveries with management.'),
      ('R-10', 'Smoking in common areas', 'common_area', 'common_area_misuse', 'Smoking and vaping are prohibited in all enclosed common areas.', 'Do not smoke or vape in enclosed common areas.'),
      ('R-11', 'Short-term rentals', 'leasing', 'lease_violation', 'Units may not be rented for terms shorter than permitted by the declaration. Leases must be filed with management.', 'End the short-term rental and file any lease with management.'),
      ('R-12', 'Damage to common elements', 'common_area', 'common_area_misuse', 'Owners are responsible for damage to common elements caused by them, their household, guests, or contractors.', 'Contact management to arrange repair or reimbursement.')
    ) as t(rule_number, title, category, vtype, description, resolve)
  loop
    if not exists (select 1 from public.house_rules hr where hr.association_id = p_association_id
                    and lower(hr.rule_number) = lower(r.rule_number) and hr.archived_at is null) then
      insert into public.house_rules (association_id, rule_number, title, description, action_to_resolve, category,
                                      default_violation_type, active, sort_order)
      values (p_association_id, r.rule_number, r.title, r.description, r.resolve, r.category,
              r.vtype::public.violation_type, true, n);
      n := n + 1;
    end if;
  end loop;
  perform public.ensure_default_violation_schedule(p_association_id);
  return n;
end;
$$;

create or replace function public.copy_house_rules(
  p_source_association_id uuid,
  p_target_association_ids uuid[],
  p_include_schedules boolean
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_target uuid;
  v_rule public.house_rules;
  v_new_rule uuid;
  n integer := 0;
begin
  if not public.can_manage_violations(p_source_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if coalesce(cardinality(p_target_association_ids), 0) = 0 then raise exception 'Choose at least one association' using errcode = '22023'; end if;
  if cardinality(p_target_association_ids) > 200 then raise exception 'Copy to at most 200 associations at once' using errcode = '22023'; end if;

  foreach v_target in array p_target_association_ids loop
    if v_target = p_source_association_id then continue; end if;
    if not public.can_manage_violations(v_target) then raise exception 'Permission denied for a target association' using errcode = '42501'; end if;
    if (select portfolio_id from public.associations where id = v_target)
       is distinct from (select portfolio_id from public.associations where id = p_source_association_id) then
      raise exception 'Rules can only be copied within one portfolio' using errcode = '42501';
    end if;

    for v_rule in
      select * from public.house_rules where association_id = p_source_association_id and archived_at is null order by sort_order
    loop
      if exists (select 1 from public.house_rules hr where hr.association_id = v_target
                  and lower(hr.rule_number) = lower(v_rule.rule_number) and hr.archived_at is null) then
        continue;
      end if;
      insert into public.house_rules (association_id, rule_number, title, description, action_to_resolve, category,
                                      default_violation_type, penalty_type, fine_amount, active, sort_order,
                                      custom_schedule)
      values (v_target, v_rule.rule_number, v_rule.title, v_rule.description, v_rule.action_to_resolve, v_rule.category,
              v_rule.default_violation_type, v_rule.penalty_type, v_rule.fine_amount, v_rule.active, v_rule.sort_order,
              coalesce(p_include_schedules, false) and v_rule.custom_schedule)
      returning id into v_new_rule;
      n := n + 1;

      if coalesce(p_include_schedules, false) and v_rule.custom_schedule then
        insert into public.violation_followup_steps (association_id, house_rule_id, step_order, days_after_previous,
                                                     follow_up_name, delivery_methods, fee, offers_hearing)
        select v_target, v_new_rule, s.step_order, s.days_after_previous, s.follow_up_name, s.delivery_methods,
               s.fee, s.offers_hearing
          from public.violation_followup_steps s
         where s.house_rule_id = v_rule.id and s.archived_at is null;
      end if;
    end loop;

    if coalesce(p_include_schedules, false)
       and not exists (select 1 from public.violation_followup_steps
                        where association_id = v_target and house_rule_id is null and archived_at is null) then
      insert into public.violation_followup_steps (association_id, step_order, days_after_previous,
                                                   follow_up_name, delivery_methods, fee, offers_hearing)
      select v_target, s.step_order, s.days_after_previous, s.follow_up_name, s.delivery_methods, s.fee, s.offers_hearing
        from public.violation_followup_steps s
       where s.association_id = p_source_association_id and s.house_rule_id is null and s.archived_at is null;
    end if;
  end loop;
  return n;
end;
$$;

-- Replace a schedule. p_house_rule_id null = association default.
-- An empty step list on a rule reverts it to the association default.
create or replace function public.save_violation_schedule(
  p_association_id uuid,
  p_house_rule_id uuid,
  p_steps jsonb
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  step jsonb;
  n integer := 0;
  v_fee numeric;
  v_days integer;
  v_gl uuid;
  v_tpl uuid;
  v_portfolio uuid;
  v_methods text[];
begin
  if not public.can_manage_violations(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if p_house_rule_id is not null and not exists (
    select 1 from public.house_rules where id = p_house_rule_id and association_id = p_association_id and archived_at is null
  ) then
    raise exception 'Rule not found' using errcode = 'P0002';
  end if;
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then raise exception 'Steps must be a list' using errcode = '22023'; end if;
  if jsonb_array_length(p_steps) > 12 then raise exception 'A schedule can have at most 12 steps' using errcode = '22023'; end if;
  if p_house_rule_id is null and jsonb_array_length(p_steps) = 0 then
    raise exception 'The association default schedule needs at least one step' using errcode = '22023';
  end if;

  update public.violation_followup_steps
     set archived_at = now(), updated_at = now()
   where association_id = p_association_id
     and house_rule_id is not distinct from p_house_rule_id
     and archived_at is null;

  for step in select * from jsonb_array_elements(p_steps) loop
    n := n + 1;
    v_days := coalesce(nullif(step ->> 'days_after_previous', '')::integer, 0);
    v_fee := coalesce(nullif(step ->> 'fee', '')::numeric, 0);
    v_gl := nullif(step ->> 'gl_account_id', '')::uuid;
    v_tpl := nullif(step ->> 'letter_template_id', '')::uuid;
    if nullif(btrim(coalesce(step ->> 'follow_up_name', '')), '') is null then
      raise exception 'Every step needs a name' using errcode = '22023';
    end if;
    if v_days < 0 or v_days > 365 then raise exception 'Days must be between 0 and 365' using errcode = '22023'; end if;
    if v_fee < 0 or v_fee > 100000 then raise exception 'Fine must be between 0 and 100,000' using errcode = '22023'; end if;
    if v_gl is not null and not exists (
      select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = v_portfolio and g.active
        and (g.association_id is null or g.association_id = p_association_id)
    ) then raise exception 'GL account is outside this association' using errcode = '42501'; end if;
    if v_tpl is not null and not exists (
      select 1 from public.document_templates t where t.id = v_tpl and t.portfolio_id = v_portfolio and t.archived_at is null
    ) then raise exception 'Letter template is outside this portfolio' using errcode = '42501'; end if;
    select coalesce(array_agg(m), '{}'::text[]) into v_methods
      from jsonb_array_elements_text(coalesce(step -> 'delivery_methods', '[]'::jsonb)) as m
     where m in ('email', 'portal', 'mail', 'certified_mail');

    insert into public.violation_followup_steps (
      association_id, house_rule_id, step_order, days_after_previous, follow_up_name,
      letter_template_id, delivery_methods, fee, gl_account_id, offers_hearing
    ) values (
      p_association_id, p_house_rule_id, n, v_days, left(btrim(step ->> 'follow_up_name'), 120),
      v_tpl, v_methods, v_fee, v_gl, coalesce((step ->> 'offers_hearing')::boolean, false)
    );
  end loop;

  if p_house_rule_id is not null then
    update public.house_rules set custom_schedule = (n > 0), updated_at = now() where id = p_house_rule_id;
  end if;
  return n;
end;
$$;

create or replace function public.save_violation_settings(
  p_association_id uuid,
  p_hearing_required_before_fine boolean,
  p_hearing_request_days integer,
  p_default_cure_days integer,
  p_fine_charge_category_id uuid
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_portfolio uuid;
begin
  if not public.can_manage_violations(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if p_fine_charge_category_id is not null and not exists (
    select 1 from public.charge_categories c where c.id = p_fine_charge_category_id and c.portfolio_id = v_portfolio and c.active
  ) then raise exception 'Charge category is outside this portfolio' using errcode = '42501'; end if;
  if p_hearing_request_days not between 0 and 90 or p_default_cure_days not between 0 and 365 then
    raise exception 'Days are out of range' using errcode = '22023';
  end if;

  insert into public.association_violation_settings (
    association_id, hearing_required_before_fine, hearing_request_days, default_cure_days, fine_charge_category_id, updated_at, updated_by
  ) values (
    p_association_id, coalesce(p_hearing_required_before_fine, true), p_hearing_request_days, p_default_cure_days,
    p_fine_charge_category_id, now(), auth.uid()
  )
  on conflict (association_id) do update
     set hearing_required_before_fine = excluded.hearing_required_before_fine,
         hearing_request_days = excluded.hearing_request_days,
         default_cure_days = excluded.default_cure_days,
         fine_charge_category_id = excluded.fine_charge_category_id,
         updated_at = now(), updated_by = auth.uid();

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', p_association_id, 'violation_settings_updated', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('hearing_required_before_fine', p_hearing_required_before_fine,
                             'hearing_request_days', p_hearing_request_days, 'default_cure_days', p_default_cure_days));
end;
$$;

-- ── Violation lifecycle RPCs ────────────────────────────────────────────────
create or replace function public.open_violation(
  p_association_id uuid,
  p_unit_id uuid,
  p_house_rule_id uuid,
  p_title text,
  p_description text,
  p_date_observed date,
  p_violation_type public.violation_type
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_rule public.house_rules;
  v_owner uuid;
  v_cure_days integer;
  v_first_days integer;
  v_id uuid;
  v_observed date := coalesce(p_date_observed, current_date);
begin
  if not public.can_manage_violations(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_unit_id is not null and not exists (
    select 1 from public.units u join public.buildings b on b.id = u.building_id
     where u.id = p_unit_id and b.association_id = p_association_id and u.archived_at is null
  ) then raise exception 'Unit is not in this association' using errcode = '22023'; end if;
  if p_house_rule_id is not null then
    select * into v_rule from public.house_rules
     where id = p_house_rule_id and association_id = p_association_id and archived_at is null;
    if not found then raise exception 'Rule not found in this association' using errcode = 'P0002'; end if;
  end if;
  if coalesce(nullif(btrim(coalesce(p_title, '')), ''), v_rule.title) is null then
    raise exception 'Choose a rule or enter a title' using errcode = '22023';
  end if;
  if v_observed > current_date then raise exception 'Observed date cannot be in the future' using errcode = '22023'; end if;

  if p_unit_id is not null then
    select occ.owner_id into v_owner from public.occupancies occ
     where occ.unit_id = p_unit_id and occ.status = 'current' and occ.owner_id is not null
     order by occ.is_primary desc nulls last
     limit 1;
  end if;

  select coalesce(s.default_cure_days, 14) into v_cure_days
    from (select 1) one left join public.association_violation_settings s on s.association_id = p_association_id;
  select days_after_previous into v_first_days from public.violation_schedule(p_association_id, p_house_rule_id) where ordinal = 1;

  insert into public.violations (
    association_id, unit_id, owner_id, house_rule_id, violation_type, status, title, description,
    date_observed, reported_date, cure_deadline, due_date, governing_document_reference, next_followup_on, created_by
  ) values (
    p_association_id, p_unit_id, v_owner, p_house_rule_id,
    coalesce(p_violation_type, v_rule.default_violation_type, 'other'), 'open',
    left(coalesce(nullif(btrim(coalesce(p_title, '')), ''), v_rule.title), 200),
    left(coalesce(nullif(btrim(coalesce(p_description, '')), ''), v_rule.description), 4000),
    v_observed, current_date, v_observed + v_cure_days, v_observed + v_cure_days,
    case when v_rule.id is not null then v_rule.rule_number || ' — ' || v_rule.title end,
    case when v_first_days is not null then v_observed + v_first_days end,
    case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end
  ) returning id into v_id;

  perform public.log_violation_event(v_id, 'Violation opened', 'open', true);
  return v_id;
end;
$$;

create or replace function public.advance_violation(p_violation_id uuid, p_note text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v public.violations;
  s record;
  nxt record;
  settings public.association_violation_settings;
  v_portfolio uuid;
  v_cat public.charge_categories;
  v_charge_id uuid;
  v_new_status public.violation_status;
  v_hearing_days integer;
begin
  select * into v from public.violations where id = p_violation_id for update;
  if not found or not public.can_manage_violations(v.association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if v.archived_at is not null or v.status in ('cured', 'closed') then
    raise exception 'This violation is already resolved' using errcode = '22023';
  end if;

  select * into s from public.violation_schedule(v.association_id, v.house_rule_id) where ordinal = v.current_step + 1;
  if not found then
    raise exception 'The follow-up schedule is complete — resolve the violation or record a hearing decision' using errcode = '22023';
  end if;
  select * into nxt from public.violation_schedule(v.association_id, v.house_rule_id) where ordinal = v.current_step + 2;

  select * into settings from public.association_violation_settings where association_id = v.association_id;
  v_hearing_days := coalesce(settings.hearing_request_days, 14);
  v_new_status := case when v.status = 'open' then 'notice_sent'::public.violation_status else v.status end;

  if s.fee > 0 then
    if v.unit_id is null then raise exception 'Fines need a unit — add the unit to this violation first' using errcode = '22023'; end if;
    if v.board_decision = 'dismissed' then raise exception 'A hearing dismissed this violation' using errcode = '22023'; end if;
    if coalesce(settings.hearing_required_before_fine, true) and coalesce(v.board_decision, '') <> 'upheld' then
      if v.hearing_requested_at is not null then
        raise exception 'The owner requested a hearing — record the hearing decision before fining' using errcode = '22023';
      end if;
      if v.notice_sent_at is null then
        raise exception 'Due process: send a notice before fining' using errcode = '22023';
      end if;
      if v.notice_sent_at::date + v_hearing_days > current_date then
        raise exception 'Due process: the owner has until % to request a hearing', to_char(v.notice_sent_at::date + v_hearing_days, 'Mon DD, YYYY')
          using errcode = '22023';
      end if;
    end if;

    select a.portfolio_id into v_portfolio from public.associations a where a.id = v.association_id;
    select * into v_cat from public.charge_categories c
     where c.portfolio_id = v_portfolio and c.active and c.archived_at is null
       and (c.id = settings.fine_charge_category_id
            or (settings.fine_charge_category_id is null and c.charge_type = 'fine'))
     order by (c.id = settings.fine_charge_category_id) desc nulls last, c.sort_order
     limit 1;
    if not found then raise exception 'No active fine charge category is configured' using errcode = '22023'; end if;

    insert into public.charges (unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by)
    values (v.unit_id, v_cat.id, 'fine',
            left('Violation fine — ' || v.title || ' (' || s.follow_up_name || ')', 500),
            round(s.fee, 2), current_date + 30, coalesce(s.gl_account_id, v_cat.gl_account_id),
            case when exists (select 1 from public.profiles where id = auth.uid()) then auth.uid() end)
    returning id into v_charge_id;

    insert into public.violation_fines (violation_id, step_id, step_order, step_name, charge_id, amount, assessed_by)
    values (v.id, s.id, s.ordinal, s.follow_up_name, v_charge_id, round(s.fee, 2), auth.uid());
    v_new_status := 'fined';
  end if;

  update public.violations
     set current_step = s.ordinal,
         status = v_new_status,
         last_step_at = now(),
         notice_sent_at = coalesce(notice_sent_at, now()),
         hearing_required = hearing_required or s.offers_hearing,
         fines_total = fines_total + case when s.fee > 0 then round(s.fee, 2) else 0 end,
         fine_amount = case when s.fee > 0 then fines_total + round(s.fee, 2) else fine_amount end,
         fine_assessed_at = case when s.fee > 0 then now() else fine_assessed_at end,
         next_followup_on = case when nxt.ordinal is not null then current_date + nxt.days_after_previous end
   where id = v.id;

  perform public.log_violation_event(
    v.id,
    s.follow_up_name
      || case when s.fee > 0 then ' — fine of $' || to_char(s.fee, 'FM999,999,990.00') || ' posted to the unit ledger' else '' end
      || case when s.offers_hearing then ' — hearing offered (request within ' || v_hearing_days || ' days)' else '' end
      || case when nullif(btrim(coalesce(p_note, '')), '') is not null then '. ' || btrim(p_note) else '' end,
    v_new_status, true);

  return jsonb_build_object(
    'step', s.ordinal, 'step_name', s.follow_up_name, 'fee', s.fee, 'charge_id', v_charge_id,
    'letter_template_id', s.letter_template_id, 'delivery_methods', s.delivery_methods,
    'offers_hearing', s.offers_hearing, 'status', v_new_status,
    'next_followup_on', case when nxt.ordinal is not null then current_date + nxt.days_after_previous end
  );
end;
$$;

create or replace function public.record_violation_hearing(
  p_violation_id uuid,
  p_decision text,
  p_hearing_at timestamptz,
  p_notes text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v public.violations;
begin
  select * into v from public.violations where id = p_violation_id for update;
  if not found or not public.can_manage_violations(v.association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_decision not in ('upheld', 'dismissed') then raise exception 'Decision must be upheld or dismissed' using errcode = '22023'; end if;
  if v.status in ('cured', 'closed') then raise exception 'This violation is already resolved' using errcode = '22023'; end if;

  update public.violations
     set board_decision = p_decision,
         hearing_at = coalesce(p_hearing_at, now()),
         hearing_required = true,
         status = case when p_decision = 'dismissed' then 'closed'::public.violation_status
                       when status = 'hearing_pending' then 'notice_sent'::public.violation_status
                       else status end,
         closed_at = case when p_decision = 'dismissed' then now() else closed_at end,
         next_followup_on = case when p_decision = 'dismissed' then null
                                 when next_followup_on is null or next_followup_on < current_date then current_date
                                 else next_followup_on end
   where id = v.id;

  perform public.log_violation_event(
    v.id,
    'Hearing held — violation ' || p_decision
      || case when nullif(btrim(coalesce(p_notes, '')), '') is not null then '. ' || btrim(p_notes) else '' end,
    case when p_decision = 'dismissed' then 'closed'::public.violation_status else null end, true);
end;
$$;

create or replace function public.resolve_violation(p_violation_id uuid, p_resolution text, p_note text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v public.violations;
begin
  select * into v from public.violations where id = p_violation_id for update;
  if not found or not public.can_manage_violations(v.association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_resolution not in ('cured', 'closed') then raise exception 'Resolution must be cured or closed' using errcode = '22023'; end if;
  if v.status in ('cured', 'closed') then return; end if;

  update public.violations
     set status = p_resolution::public.violation_status,
         cured_at = case when p_resolution = 'cured' then now() else cured_at end,
         closed_at = now(),
         next_followup_on = null
   where id = v.id;

  perform public.log_violation_event(
    v.id,
    case when p_resolution = 'cured' then 'Marked corrected' else 'Closed' end
      || case when nullif(btrim(coalesce(p_note, '')), '') is not null then '. ' || btrim(p_note) else '' end,
    p_resolution::public.violation_status, true);
end;
$$;

-- ── Lock direct writes to the new/escalation tables ────────────────────────
revoke insert, update, delete on public.house_rules from authenticated;
revoke insert, update, delete on public.violation_followup_steps from authenticated;
revoke insert, update, delete on public.association_violation_settings from authenticated, anon;
revoke insert, update, delete on public.violation_fines from authenticated, anon;
grant select on public.association_violation_settings to authenticated;
grant select on public.violation_fines to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.can_manage_violations(uuid)',
    'public.violation_schedule(uuid, uuid)',
    'public.log_violation_event(uuid, text, public.violation_status, boolean)',
    'public.save_house_rule(uuid, uuid, text, text, text, text, text, public.violation_type, numeric, boolean)',
    'public.archive_house_rule(uuid)',
    'public.ensure_default_violation_schedule(uuid)',
    'public.install_starter_house_rules(uuid)',
    'public.copy_house_rules(uuid, uuid[], boolean)',
    'public.save_violation_schedule(uuid, uuid, jsonb)',
    'public.save_violation_settings(uuid, boolean, integer, integer, uuid)',
    'public.open_violation(uuid, uuid, uuid, text, text, date, public.violation_type)',
    'public.advance_violation(uuid, text)',
    'public.record_violation_hearing(uuid, text, timestamptz, text)',
    'public.resolve_violation(uuid, text, text)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
end $$;

-- Internal helpers: not part of the API surface.
revoke all on function public.log_violation_event(uuid, text, public.violation_status, boolean) from authenticated;
revoke all on function public.violation_schedule(uuid, uuid) from authenticated;

grant execute on function public.can_manage_violations(uuid) to authenticated, service_role;
grant execute on function public.save_house_rule(uuid, uuid, text, text, text, text, text, public.violation_type, numeric, boolean) to authenticated, service_role;
grant execute on function public.archive_house_rule(uuid) to authenticated, service_role;
grant execute on function public.ensure_default_violation_schedule(uuid) to authenticated, service_role;
grant execute on function public.install_starter_house_rules(uuid) to authenticated, service_role;
grant execute on function public.copy_house_rules(uuid, uuid[], boolean) to authenticated, service_role;
grant execute on function public.save_violation_schedule(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_violation_settings(uuid, boolean, integer, integer, uuid) to authenticated, service_role;
grant execute on function public.open_violation(uuid, uuid, uuid, text, text, date, public.violation_type) to authenticated, service_role;
grant execute on function public.advance_violation(uuid, text) to authenticated, service_role;
grant execute on function public.record_violation_hearing(uuid, text, timestamptz, text) to authenticated, service_role;
grant execute on function public.resolve_violation(uuid, text, text) to authenticated, service_role;
grant execute on function public.violation_schedule(uuid, uuid) to service_role;
