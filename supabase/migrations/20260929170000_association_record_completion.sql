-- Complete association record: every AppFolio association setting becomes
-- editable through one audited, whitelisted RPC; keys / notes / additional
-- fees become usable (they had only a restrictive policy, so no one could read
-- or write them); association insurance policies and unit groups are added.

-- ── Data repair: /associations/new wrote 'net_income' as a payment frequency ──
update public.associations set payment_frequency = 'monthly' where payment_frequency = 'net_income';

alter table public.portfolios add column if not exists tax_id text;
alter table public.association_additional_fees add column if not exists suppress boolean not null default false;

-- ── Access helper ──────────────────────────────────────────────────────────
create or replace function public.can_manage_association(p_association_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select p_association_id is not null
     and (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     and public.can_access_association(p_association_id)
     and public.can_view_association_row(p_association_id);
$$;
alter function public.can_manage_association(uuid) owner to postgres;
revoke all on function public.can_manage_association(uuid) from public, anon;
grant execute on function public.can_manage_association(uuid) to authenticated, service_role;

-- ── Keys / notes / additional fees: grant staff access ─────────────────────
do $$
declare t text;
begin
  foreach t in array array['association_keys', 'association_notes', 'association_additional_fees'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.can_manage_association(association_id)) with check (public.can_manage_association(association_id))', t || '_staff_all', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ── Association insurance (master, D&O, fidelity, umbrella, …) ─────────────
create table if not exists public.association_insurance_policies (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  coverage_type text not null check (coverage_type in
    ('master_property', 'general_liability', 'directors_officers', 'fidelity_crime', 'umbrella', 'flood', 'earthquake', 'workers_comp', 'boiler_machinery', 'cyber', 'other')),
  carrier text not null check (char_length(carrier) between 1 and 200),
  policy_number text,
  agent_name text,
  agent_email text,
  agent_phone text,
  coverage_amount numeric(14,2) check (coverage_amount is null or coverage_amount >= 0),
  deductible numeric(14,2) check (deductible is null or deductible >= 0),
  annual_premium numeric(14,2) check (annual_premium is null or annual_premium >= 0),
  effective_date date,
  expiration_date date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expiration_date is null or effective_date is null or expiration_date >= effective_date)
);
create index if not exists idx_association_insurance on public.association_insurance_policies (association_id, expiration_date) where archived_at is null;
alter table public.association_insurance_policies enable row level security;
drop policy if exists association_insurance_staff_all on public.association_insurance_policies;
create policy association_insurance_staff_all on public.association_insurance_policies for all to authenticated
  using (public.can_manage_association(association_id)) with check (public.can_manage_association(association_id));
drop policy if exists association_insurance_board_read on public.association_insurance_policies;
create policy association_insurance_board_read on public.association_insurance_policies for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
grant select, insert, update, delete on public.association_insurance_policies to authenticated;

-- ── Unit groups ─────────────────────────────────────────────────────────────
create table if not exists public.unit_groups (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists unit_groups_assoc_name_unique on public.unit_groups (association_id, lower(name));
create table if not exists public.unit_group_members (
  group_id uuid not null references public.unit_groups(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  primary key (group_id, unit_id)
);
alter table public.unit_groups enable row level security;
alter table public.unit_group_members enable row level security;
drop policy if exists unit_groups_staff_all on public.unit_groups;
create policy unit_groups_staff_all on public.unit_groups for all to authenticated
  using (public.can_manage_association(association_id)) with check (public.can_manage_association(association_id));
drop policy if exists unit_group_members_staff_all on public.unit_group_members;
create policy unit_group_members_staff_all on public.unit_group_members for all to authenticated
  using (exists (select 1 from public.unit_groups g where g.id = group_id and public.can_manage_association(g.association_id)))
  with check (exists (
    select 1 from public.unit_groups g
      join public.units u on u.id = unit_id
      join public.buildings b on b.id = u.building_id
     where g.id = group_id and b.association_id = g.association_id and public.can_manage_association(g.association_id)));
grant select, insert, update, delete on public.unit_groups, public.unit_group_members to authenticated;

-- ── Whitelisted, audited association settings update ───────────────────────
create or replace function public.update_association_settings(p_association_id uuid, p_values jsonb)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  allowed text[] := array[
    -- general
    'name', 'legal_name', 'property_type', 'address', 'address_line_2', 'city', 'state', 'zip', 'county',
    'description', 'year_built', 'tax_id', 'timezone', 'status',
    -- management
    'management_start_date', 'management_end_date', 'management_end_reason',
    -- financial
    'fiscal_year_start', 'vendor_1099_payer', 'reserve_funds', 'basis_for_owner_packets', 'nsf_fee_amount_override',
    'late_fee_eligible_charges',
    -- owner portal & payments
    'payment_frequency', 'owner_can_override_frequency', 'hide_calendar_in_portal', 'disable_contacts_editing_in_portal',
    'disable_renter_editing_in_portal', 'residents_check_fee_coverage_enabled',
    -- interest
    'annual_interest_rate', 'interest_grace_days', 'interest_post_day_of_month', 'interest_grace_balance', 'interest_income_gl_account_id',
    -- budget
    'budget_variance_threshold_amount', 'budget_variance_threshold_pct', 'budget_variance_threshold_op',
    -- maintenance
    'maintenance_limit', 'insurance_expiration', 'home_warranty_covered', 'unit_entry_pre_authorized',
    'disable_online_maintenance_requests', 'maintenance_contact_name', 'maintenance_contact_phone', 'maintenance_contact_email',
    'maintenance_notes', 'online_maintenance_request_instructions',
    -- communications
    'violation_sender_name', 'violation_sender_email_uses_logged_in_user', 'violation_sender_email', 'electronic_doc_delivery_terms'
  ];
  v_keys text[];
  v_cols text;
  v_before jsonb;
  v_portfolio uuid;
  v_gl uuid;
begin
  if not public.can_manage_association(p_association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then raise exception 'Nothing to save'; end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_values) k where k = any(allowed);
  if coalesce(cardinality(v_keys), 0) = 0 then raise exception 'None of the submitted fields can be edited here'; end if;
  if exists (select 1 from jsonb_object_keys(p_values) k where not (k = any(allowed))) then
    raise exception 'Unknown or protected field submitted';
  end if;

  -- Field-level validation beyond column constraints.
  if p_values ? 'name' and char_length(btrim(coalesce(p_values ->> 'name', ''))) < 2 then raise exception 'Name is required'; end if;
  if p_values ? 'payment_frequency' and (p_values ->> 'payment_frequency') not in ('monthly', 'quarterly', 'semi_annually', 'annually') then
    raise exception 'Invalid payment frequency';
  end if;
  if p_values ? 'late_fee_eligible_charges' and coalesce(p_values ->> 'late_fee_eligible_charges', 'all') not in ('all', 'recurring_only') then
    raise exception 'Invalid late-fee eligible charges';
  end if;
  if p_values ? 'annual_interest_rate' and nullif(p_values ->> 'annual_interest_rate', '') is not null
     and (p_values ->> 'annual_interest_rate')::numeric not between 0 and 36 then
    raise exception 'Annual interest rate must be between 0 and 36%%';
  end if;
  if p_values ? 'interest_post_day_of_month' and nullif(p_values ->> 'interest_post_day_of_month', '') is not null
     and (p_values ->> 'interest_post_day_of_month')::integer not between 1 and 28 then
    raise exception 'Interest posting day must be 1–28';
  end if;
  if p_values ? 'violation_sender_email' and nullif(p_values ->> 'violation_sender_email', '') is not null
     and (p_values ->> 'violation_sender_email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid violation sender email';
  end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  v_gl := nullif(p_values ->> 'interest_income_gl_account_id', '')::uuid;
  if v_gl is not null and not exists (
    select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = v_portfolio and g.active
      and (g.association_id is null or g.association_id = p_association_id)
  ) then
    raise exception 'Interest income GL account is outside this association';
  end if;

  select to_jsonb(a) into v_before from public.associations a where a.id = p_association_id for update;
  select string_agg(format('%I', k), ', ') into v_cols from unnest(v_keys) k;
  execute format(
    'update public.associations set (%s) = (select %s from jsonb_populate_record(null::public.associations, $1)) where id = $2',
    v_cols, v_cols)
  using (select jsonb_object_agg(k, case when p_values -> k = '""'::jsonb then 'null'::jsonb else p_values -> k end)
           from unnest(v_keys) k),
        p_association_id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  select v_portfolio, 'association', p_association_id, 'association_settings_updated', auth.uid(),
         (select email from auth.users where id = auth.uid()),
         jsonb_build_object('before', (select jsonb_object_agg(k, v_before -> k) from unnest(v_keys) k),
                            'after', (select jsonb_object_agg(k, to_jsonb(a) -> k) from unnest(v_keys) k))
    from public.associations a where a.id = p_association_id;
end;
$$;
alter function public.update_association_settings(uuid, jsonb) owner to postgres;
revoke all on function public.update_association_settings(uuid, jsonb) from public, anon;
grant execute on function public.update_association_settings(uuid, jsonb) to authenticated, service_role;
