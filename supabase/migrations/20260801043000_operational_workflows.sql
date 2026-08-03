-- Durable capital projects, GL role-permission administration, inspection
-- offline idempotency, and owner-delinquency case management.

create table if not exists public.capital_projects (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  reserve_component_id uuid references public.reserve_components(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  status text not null default 'planning'
    check (status in ('planning', 'board_review', 'approved', 'active', 'on_hold', 'completed', 'cancelled')),
  priority text not null default 'standard'
    check (priority in ('critical', 'high', 'standard', 'deferred')),
  start_date date,
  target_end_date date,
  completed_at timestamptz,
  budget_amount numeric(16,2) not null default 0 check (budget_amount >= 0),
  contingency_amount numeric(16,2) not null default 0 check (contingency_amount >= 0),
  approved_budget_amount numeric(16,2) check (approved_budget_amount >= 0),
  board_approval_required boolean not null default false,
  board_approved_at timestamptz,
  board_approved_by uuid references auth.users(id) on delete set null,
  manager_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_end_date is null or start_date is null or target_end_date >= start_date),
  check (not board_approval_required or status not in ('active', 'completed') or board_approved_at is not null)
);

create table if not exists public.capital_project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.capital_projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  completed_at timestamptz,
  sort_order integer not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.capital_project_work_orders (
  project_id uuid not null references public.capital_projects(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, work_order_id),
  unique (work_order_id)
);

create index if not exists idx_capital_projects_portfolio
  on public.capital_projects(portfolio_id, status, updated_at desc) where archived_at is null;
create index if not exists idx_capital_projects_association
  on public.capital_projects(association_id, status) where archived_at is null;
create index if not exists idx_capital_project_milestones_project
  on public.capital_project_milestones(project_id, sort_order, due_date);

create or replace function public.enforce_capital_project_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  association_portfolio uuid;
  component_portfolio uuid;
  component_association uuid;
begin
  select portfolio_id into association_portfolio
  from public.associations where id = new.association_id;

  if association_portfolio is null or association_portfolio <> new.portfolio_id then
    raise exception 'Capital project association must belong to the same portfolio';
  end if;

  if new.reserve_component_id is not null then
    select portfolio_id, association_id into component_portfolio, component_association
    from public.reserve_components where id = new.reserve_component_id;
    if component_portfolio is null
       or component_portfolio <> new.portfolio_id
       or component_association <> new.association_id then
      raise exception 'Reserve component must match the capital project scope';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_capital_project_work_order_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_portfolio uuid;
  project_association uuid;
  work_order_portfolio uuid;
  work_order_association uuid;
begin
  select portfolio_id, association_id into project_portfolio, project_association
  from public.capital_projects where id = new.project_id;
  select coalesce(wo.portfolio_id, a.portfolio_id), wo.association_id
    into work_order_portfolio, work_order_association
  from public.work_orders wo
  join public.associations a on a.id = wo.association_id
  where wo.id = new.work_order_id;

  if project_portfolio is null or work_order_portfolio is null
     or project_portfolio <> work_order_portfolio
     or project_association <> work_order_association then
    raise exception 'Work order must match the capital project portfolio and association';
  end if;
  return new;
end;
$$;

create or replace function public.guard_capital_project_governance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if ((tg_op = 'INSERT' and (new.board_approved_at is not null or new.board_approved_by is not null or new.approved_budget_amount is not null))
      or (tg_op = 'UPDATE' and (new.board_approved_at, new.board_approved_by, new.approved_budget_amount)
       is distinct from
     (old.board_approved_at, old.board_approved_by, old.approved_budget_amount)))
     and not (public.can_admin_portfolio(new.portfolio_id) or public.is_platform_operator()) then
    raise exception 'portfolio administrator approval is required to change project governance fields';
  end if;
  if new.board_approved_at is not null and new.board_approved_by is null then
    raise exception 'board approval must identify the administrator who recorded it';
  end if;
  if tg_op = 'UPDATE'
     and old.board_approval_required
     and not new.board_approval_required
     and not (public.can_admin_portfolio(new.portfolio_id) or public.is_platform_operator()) then
    raise exception 'portfolio administrator approval is required to remove the board-approval requirement';
  end if;
  if new.board_approval_required
     and new.status in ('active', 'completed')
     and new.board_approved_at is null then
    raise exception 'board approval is required before project activation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capital_projects_scope on public.capital_projects;
create trigger trg_capital_projects_scope
before insert or update of portfolio_id, association_id, reserve_component_id
on public.capital_projects for each row execute function public.enforce_capital_project_scope();

drop trigger if exists trg_capital_projects_governance on public.capital_projects;
create trigger trg_capital_projects_governance
before insert or update of board_approved_at, board_approved_by, approved_budget_amount, board_approval_required, status
on public.capital_projects for each row execute function public.guard_capital_project_governance();

drop trigger if exists trg_capital_project_work_orders_scope on public.capital_project_work_orders;
create trigger trg_capital_project_work_orders_scope
before insert or update on public.capital_project_work_orders
for each row execute function public.enforce_capital_project_work_order_scope();

drop trigger if exists trg_capital_projects_updated on public.capital_projects;
create trigger trg_capital_projects_updated before update on public.capital_projects
for each row execute function public.touch_updated_at();
drop trigger if exists trg_capital_project_milestones_updated on public.capital_project_milestones;
create trigger trg_capital_project_milestones_updated before update on public.capital_project_milestones
for each row execute function public.touch_updated_at();

alter table public.capital_projects enable row level security;
alter table public.capital_project_milestones enable row level security;
alter table public.capital_project_work_orders enable row level security;

create policy capital_projects_staff_all on public.capital_projects to authenticated
using ((public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()) and public.can_access_portfolio(portfolio_id))
with check ((public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()) and public.can_access_portfolio(portfolio_id));
create policy capital_projects_board_read on public.capital_projects for select to authenticated
using (public.is_board_user() and association_id in (select public.current_board_association_ids()) and status <> 'planning');

create policy capital_project_milestones_staff_all on public.capital_project_milestones to authenticated
using (exists (select 1 from public.capital_projects p where p.id = project_id and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()) and public.can_access_portfolio(p.portfolio_id)))
with check (exists (select 1 from public.capital_projects p where p.id = project_id and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()) and public.can_access_portfolio(p.portfolio_id)));
create policy capital_project_milestones_board_read on public.capital_project_milestones for select to authenticated
using (exists (select 1 from public.capital_projects p where p.id = project_id and public.is_board_user() and p.association_id in (select public.current_board_association_ids()) and p.status <> 'planning'));

create policy capital_project_work_orders_staff_all on public.capital_project_work_orders to authenticated
using (exists (select 1 from public.capital_projects p where p.id = project_id and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()) and public.can_access_portfolio(p.portfolio_id)))
with check (exists (select 1 from public.capital_projects p where p.id = project_id and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()) and public.can_access_portfolio(p.portfolio_id)));
create policy capital_project_work_orders_board_read on public.capital_project_work_orders for select to authenticated
using (exists (select 1 from public.capital_projects p where p.id = project_id and public.is_board_user() and p.association_id in (select public.current_board_association_ids()) and p.status <> 'planning'));

create or replace view public.capital_project_financials
with (security_invoker = true)
as
select
  project.id as project_id,
  count(distinct link.work_order_id)::integer as work_order_count,
  coalesce(sum(bill.amount) filter (where bill.status in ('approved', 'paid')), 0)::numeric(16,2) as committed_spend
from public.capital_projects project
left join public.capital_project_work_orders link on link.project_id = project.id
left join public.payable_bills bill
  on bill.work_order_id = link.work_order_id
 and bill.archived_at is null
group by project.id;

grant select on public.capital_project_financials to authenticated, service_role;

-- Role-specific GL visibility and use. `full` means the role may select the
-- account in posting forms; `read` means reporting only; `none` is explicit.
create or replace function public.can_read_gl(gl_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_platform_operator()
      or public.is_company_admin()
      or public.is_finance_staff()
      or public.is_full_access_staff()
      or exists (
        select 1
        from public.profiles p
        join public.gl_account_role_permissions grp on grp.role_id = p.role_id
        where p.id = auth.uid()
          and grp.gl_account_id = gl_id
          and grp.permission in ('read', 'full')
      );
$$;

create or replace function public.can_use_gl(gl_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_platform_operator()
      or public.is_company_admin()
      or public.is_finance_staff()
      or public.is_full_access_staff()
      or exists (
        select 1
        from public.profiles p
        join public.gl_account_role_permissions grp on grp.role_id = p.role_id
        where p.id = auth.uid()
          and grp.gl_account_id = gl_id
          and grp.permission = 'full'
      );
$$;

drop policy if exists gl_accounts_role_read on public.gl_accounts;
create policy gl_accounts_role_read on public.gl_accounts for select to authenticated
using (public.can_access_portfolio(portfolio_id) and public.can_read_gl(id));

create or replace function public.enforce_gl_use_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  gl_id uuid;
begin
  gl_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  -- Service jobs have no end-user auth identity and remain governed by their
  -- service-role boundary. Every authenticated write must honor `full`.
  if auth.uid() is not null and gl_id is not null and not public.can_use_gl(gl_id) then
    raise exception 'Your role does not have full permission for this GL account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bank_transactions_gl_permission on public.bank_transactions;
create trigger trg_bank_transactions_gl_permission before insert or update of gl_account_id on public.bank_transactions for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_budget_lines_gl_permission on public.budget_lines;
create trigger trg_budget_lines_gl_permission before insert or update of gl_account_id on public.budget_lines for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_charge_categories_gl_permission on public.charge_categories;
create trigger trg_charge_categories_gl_permission before insert or update of gl_account_id on public.charge_categories for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_charges_gl_permission on public.charges;
create trigger trg_charges_gl_permission before insert or update of gl_account_id on public.charges for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_journal_lines_gl_permission on public.journal_lines;
create trigger trg_journal_lines_gl_permission before insert or update of gl_account_id on public.journal_lines for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_owner_payables_gl_permission on public.owner_payables;
create trigger trg_owner_payables_gl_permission before insert or update of gl_account_id on public.owner_payables for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_payable_bills_gl_permission on public.payable_bills;
create trigger trg_payable_bills_gl_permission before insert or update of gl_account_id on public.payable_bills for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_payable_bill_lines_gl_permission on public.payable_bill_line_items;
create trigger trg_payable_bill_lines_gl_permission before insert or update of gl_account_id on public.payable_bill_line_items for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_payments_gl_permission on public.payments;
create trigger trg_payments_gl_permission before insert or update of gl_account_id on public.payments for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_purchase_order_lines_gl_permission on public.purchase_order_line_items;
create trigger trg_purchase_order_lines_gl_permission before insert or update of gl_account_id on public.purchase_order_line_items for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_recurring_bills_gl_permission on public.recurring_bills;
create trigger trg_recurring_bills_gl_permission before insert or update of gl_account_id on public.recurring_bills for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_recurring_work_orders_gl_permission on public.recurring_work_orders;
create trigger trg_recurring_work_orders_gl_permission before insert or update of gl_account_id on public.recurring_work_orders for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_fixed_assets_gl_permission on public.fixed_assets;
create trigger trg_fixed_assets_gl_permission before insert or update of gl_account_id on public.fixed_assets for each row execute function public.enforce_gl_use_permission('gl_account_id');
drop trigger if exists trg_vendors_default_gl_permission on public.vendors;
create trigger trg_vendors_default_gl_permission before insert or update of default_gl_account_id on public.vendors for each row execute function public.enforce_gl_use_permission('default_gl_account_id');

create or replace function public.set_gl_role_permission(
  p_gl_account_id uuid,
  p_role_id uuid,
  p_permission public.gl_permission
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  account_portfolio uuid;
  role_portfolio uuid;
  prior_permission public.gl_permission;
begin
  select portfolio_id into account_portfolio from public.gl_accounts where id = p_gl_account_id;
  select portfolio_id into role_portfolio from public.user_roles where id = p_role_id;
  if account_portfolio is null or role_portfolio is null or account_portfolio <> role_portfolio then
    raise exception 'GL account and role must belong to the same portfolio';
  end if;
  if not (public.can_admin_portfolio(account_portfolio) or public.is_platform_operator()) then
    raise exception 'Not authorized to administer GL permissions';
  end if;

  select permission into prior_permission
  from public.gl_account_role_permissions
  where gl_account_id = p_gl_account_id and role_id = p_role_id;

  insert into public.gl_account_role_permissions (gl_account_id, role_id, permission)
  values (p_gl_account_id, p_role_id, p_permission)
  on conflict (gl_account_id, role_id)
  do update set permission = excluded.permission, updated_at = now();

  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, before_state, after_state
  ) values (
    auth.uid(), account_portfolio, 'gl_account_role_permission', p_gl_account_id,
    'set', to_jsonb(prior_permission),
    jsonb_build_object('role_id', p_role_id, 'permission', p_permission)
  );
end;
$$;

revoke all on function public.set_gl_role_permission(uuid, uuid, public.gl_permission) from public, anon;
grant execute on function public.set_gl_role_permission(uuid, uuid, public.gl_permission) to authenticated, service_role;

-- Client-generated identifiers make an offline finding sync idempotent.
alter table public.inspection_items
  add column if not exists client_mutation_id text,
  add column if not exists captured_at timestamptz,
  add column if not exists captured_by uuid references auth.users(id) on delete set null;
create unique index if not exists idx_inspection_items_client_mutation
  on public.inspection_items(inspection_id, client_mutation_id)
  where client_mutation_id is not null;

create table if not exists public.inspection_finding_events (
  id uuid primary key default gen_random_uuid(),
  inspection_item_id uuid not null references public.inspection_items(id) on delete cascade,
  action text not null check (action in ('captured', 'resolved', 'reopened', 'remediation_linked')),
  note text,
  work_order_id uuid references public.work_orders(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_inspection_finding_events_item
  on public.inspection_finding_events(inspection_item_id, created_at desc);

create or replace function public.audit_inspection_finding_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.inspection_finding_events(inspection_item_id, action, note, actor_user_id)
    values (new.id, 'captured', new.issue, coalesce(new.captured_by, auth.uid()));
    return new;
  end if;
  if new.resolved is distinct from old.resolved then
    insert into public.inspection_finding_events(inspection_item_id, action, note, actor_user_id)
    values (new.id, case when new.resolved then 'resolved' else 'reopened' end, new.resolution_notes, auth.uid());
  end if;
  if new.work_order_id is distinct from old.work_order_id and new.work_order_id is not null then
    insert into public.inspection_finding_events(inspection_item_id, action, note, work_order_id, actor_user_id)
    values (new.id, 'remediation_linked', 'Remediation work order linked', new.work_order_id, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inspection_finding_lifecycle on public.inspection_items;
create trigger trg_inspection_finding_lifecycle
after insert or update of resolved, resolution_notes, work_order_id on public.inspection_items
for each row execute function public.audit_inspection_finding_lifecycle();

alter table public.inspection_finding_events enable row level security;
create policy inspection_finding_events_staff_read on public.inspection_finding_events for select to authenticated
using (exists (
  select 1
  from public.inspection_items item
  join public.inspections inspection on inspection.id = item.inspection_id
  where item.id = inspection_item_id
    and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
    and public.can_access_portfolio(inspection.portfolio_id)
));

grant select on public.inspection_finding_events to authenticated;
grant all on public.inspection_finding_events to service_role;

-- Owner delinquency is case management, not autonomous legal enforcement.
create table if not exists public.delinquency_policies (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  name text not null default 'Standard owner collection policy',
  minimum_balance numeric(16,2) not null default 25 check (minimum_balance >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (association_id)
);

create table if not exists public.delinquency_steps (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.delinquency_policies(id) on delete cascade,
  step_number smallint not null check (step_number between 1 and 20),
  name text not null check (char_length(name) between 1 and 120),
  days_past_due integer not null check (days_past_due >= 0),
  action_type text not null check (action_type in ('review', 'email', 'sms', 'letter', 'physical_mail', 'legal_review')),
  requires_human_approval boolean not null default false,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, step_number),
  check (action_type <> 'legal_review' or requires_human_approval)
);

create table if not exists public.delinquency_cases (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  policy_id uuid references public.delinquency_policies(id) on delete set null,
  unit_id uuid not null references public.units(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'on_hold', 'legal_review', 'approved_for_counsel', 'resolved', 'closed')),
  current_step_number smallint not null default 0 check (current_step_number between 0 and 20),
  balance_snapshot numeric(16,2) not null default 0,
  oldest_due_date date,
  next_action_at timestamptz,
  hold_reason text,
  legal_reviewed_at timestamptz,
  legal_reviewed_by uuid references auth.users(id) on delete set null,
  legal_review_note text,
  last_synced_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id)
);

create table if not exists public.delinquency_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delinquency_cases(id) on delete cascade,
  event_type text not null,
  step_number smallint,
  balance_snapshot numeric(16,2),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_delinquency_cases_portfolio
  on public.delinquency_cases(portfolio_id, status, next_action_at);
create index if not exists idx_delinquency_cases_association
  on public.delinquency_cases(association_id, status);
create index if not exists idx_delinquency_case_events_case
  on public.delinquency_case_events(case_id, created_at desc);

create or replace function public.enforce_delinquency_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  association_portfolio uuid;
  unit_association uuid;
  policy_association uuid;
begin
  select portfolio_id into association_portfolio from public.associations where id = new.association_id;
  select b.association_id into unit_association
  from public.units u join public.buildings b on b.id = u.building_id where u.id = new.unit_id;
  if new.policy_id is not null then
    select association_id into policy_association from public.delinquency_policies where id = new.policy_id;
  end if;
  if association_portfolio is null or association_portfolio <> new.portfolio_id
     or unit_association is null or unit_association <> new.association_id
     or (new.policy_id is not null and policy_association <> new.association_id) then
    raise exception 'Delinquency case records must share one portfolio and association';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_delinquency_cases_scope on public.delinquency_cases;
create trigger trg_delinquency_cases_scope before insert or update of portfolio_id, association_id, policy_id, unit_id
on public.delinquency_cases for each row execute function public.enforce_delinquency_scope();
drop trigger if exists trg_delinquency_policies_updated on public.delinquency_policies;
create trigger trg_delinquency_policies_updated before update on public.delinquency_policies
for each row execute function public.touch_updated_at();
drop trigger if exists trg_delinquency_steps_updated on public.delinquency_steps;
create trigger trg_delinquency_steps_updated before update on public.delinquency_steps
for each row execute function public.touch_updated_at();
drop trigger if exists trg_delinquency_cases_updated on public.delinquency_cases;
create trigger trg_delinquency_cases_updated before update on public.delinquency_cases
for each row execute function public.touch_updated_at();

alter table public.delinquency_policies enable row level security;
alter table public.delinquency_steps enable row level security;
alter table public.delinquency_cases enable row level security;
alter table public.delinquency_case_events enable row level security;

create policy delinquency_policies_staff_read on public.delinquency_policies for select to authenticated
using (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()));
create policy delinquency_policies_admin_write on public.delinquency_policies for all to authenticated
using (public.can_admin_portfolio(portfolio_id) or public.is_platform_operator())
with check (public.can_admin_portfolio(portfolio_id) or public.is_platform_operator());

create policy delinquency_steps_staff_read on public.delinquency_steps for select to authenticated
using (exists (select 1 from public.delinquency_policies p where p.id = policy_id and public.can_access_portfolio(p.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())));
create policy delinquency_steps_admin_write on public.delinquency_steps for all to authenticated
using (exists (select 1 from public.delinquency_policies p where p.id = policy_id and (public.can_admin_portfolio(p.portfolio_id) or public.is_platform_operator())))
with check (exists (select 1 from public.delinquency_policies p where p.id = policy_id and (public.can_admin_portfolio(p.portfolio_id) or public.is_platform_operator())));

create policy delinquency_cases_staff_all on public.delinquency_cases to authenticated
using (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()))
with check (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()));
create policy delinquency_cases_board_read on public.delinquency_cases for select to authenticated
using (public.is_board_user() and association_id in (select public.current_board_association_ids()));

create policy delinquency_events_staff_read on public.delinquency_case_events for select to authenticated
using (exists (select 1 from public.delinquency_cases c where c.id = case_id and public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())));
create policy delinquency_events_board_read on public.delinquency_case_events for select to authenticated
using (exists (select 1 from public.delinquency_cases c where c.id = case_id and public.is_board_user() and c.association_id in (select public.current_board_association_ids())));
create policy delinquency_events_staff_insert on public.delinquency_case_events for insert to authenticated
with check (exists (select 1 from public.delinquency_cases c where c.id = case_id and public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())));

create or replace function public.initialize_delinquency_policy(p_association_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  portfolio uuid;
  policy uuid;
begin
  select portfolio_id into portfolio from public.associations where id = p_association_id;
  if portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_admin_portfolio(portfolio) or public.is_platform_operator()) then
    raise exception 'Not authorized to configure delinquency policy';
  end if;
  insert into public.delinquency_policies (portfolio_id, association_id)
  values (portfolio, p_association_id)
  on conflict (association_id) do update set updated_at = now()
  returning id into policy;

  insert into public.delinquency_steps (policy_id, step_number, name, days_past_due, action_type, requires_human_approval, instructions)
  values
    (policy, 1, 'Courtesy reminder', 10, 'email', false, 'Review account and send a courteous balance reminder.'),
    (policy, 2, 'Formal collection notice', 30, 'letter', true, 'Confirm ledger accuracy and approve the formal notice.'),
    (policy, 3, 'Tracked physical notice', 45, 'physical_mail', true, 'Approve physical-mail fulfillment and retain delivery evidence.'),
    (policy, 4, 'Counsel review gate', 60, 'legal_review', true, 'Human portfolio administrator must approve or reject referral. No filing is automated.')
  on conflict (policy_id, step_number) do nothing;
  return policy;
end;
$$;

create or replace function public.advance_delinquency_case(p_case_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  case_row public.delinquency_cases;
  next_step public.delinquency_steps;
begin
  select * into case_row from public.delinquency_cases where id = p_case_id for update;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(case_row.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to manage this delinquency case';
  end if;
  if case_row.status not in ('open', 'legal_review') then
    raise exception 'Case must be open before advancing';
  end if;
  select * into next_step
  from public.delinquency_steps
  where policy_id = case_row.policy_id and step_number > case_row.current_step_number
  order by step_number limit 1;
  if not found then raise exception 'No further policy step is configured'; end if;
  if case_row.oldest_due_date is null
     or (current_date - case_row.oldest_due_date) < next_step.days_past_due then
    raise exception 'The next policy step is not due yet';
  end if;

  update public.delinquency_cases
  set current_step_number = next_step.step_number,
      status = case when next_step.action_type = 'legal_review' then 'legal_review' else 'open' end,
      next_action_at = null
  where id = p_case_id;
  insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note, metadata)
  values (p_case_id, case when next_step.action_type = 'legal_review' then 'legal_review_requested' else 'step_advanced' end,
          next_step.step_number, case_row.balance_snapshot, nullif(btrim(coalesce(p_note, '')), ''),
          jsonb_build_object('step_name', next_step.name, 'action_type', next_step.action_type, 'requires_human_approval', next_step.requires_human_approval));
  return jsonb_build_object('step_number', next_step.step_number, 'action_type', next_step.action_type,
                            'requires_human_approval', next_step.requires_human_approval);
end;
$$;

create or replace function public.sync_owner_delinquency_cases(p_portfolio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  synced_count integer := 0;
  cured_count integer := 0;
begin
  if not (public.can_access_portfolio(p_portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to synchronize delinquency cases';
  end if;

  insert into public.delinquency_cases (
    portfolio_id, association_id, policy_id, unit_id, owner_id,
    status, balance_snapshot, oldest_due_date, last_synced_at
  )
  select
    p_portfolio_id,
    due.association_id,
    policy.id,
    due.unit_id,
    ownership.owner_id,
    'open',
    due.balance,
    due.oldest_due,
    now()
  from public.delinquent_units due
  join public.associations association on association.id = due.association_id
  left join public.delinquency_policies policy
    on policy.association_id = due.association_id and policy.active
  left join lateral (
    select unit_owner.owner_id
    from public.unit_owners unit_owner
    where unit_owner.unit_id = due.unit_id and unit_owner.end_date is null
    order by unit_owner.is_primary desc, unit_owner.start_date desc
    limit 1
  ) ownership on true
  where association.portfolio_id = p_portfolio_id
    and due.unit_id is not null
    and due.balance >= coalesce(policy.minimum_balance, 0)
  on conflict (unit_id) do update
    set association_id = excluded.association_id,
        policy_id = excluded.policy_id,
        owner_id = excluded.owner_id,
        balance_snapshot = excluded.balance_snapshot,
        oldest_due_date = excluded.oldest_due_date,
        last_synced_at = now(),
        resolved_at = null,
        status = case when delinquency_cases.status = 'resolved' then 'open' else delinquency_cases.status end;
  get diagnostics synced_count = row_count;

  with cured as (
    update public.delinquency_cases case_record
    set status = 'resolved', resolved_at = now(), balance_snapshot = 0, last_synced_at = now()
    where case_record.portfolio_id = p_portfolio_id
      and case_record.status not in ('resolved', 'closed')
      and not exists (
        select 1
        from public.delinquent_units due
        left join public.delinquency_policies policy
          on policy.association_id = due.association_id and policy.active
        where due.unit_id = case_record.unit_id
          and due.balance >= coalesce(policy.minimum_balance, 0)
      )
    returning case_record.id
  ), logged as (
    insert into public.delinquency_case_events (case_id, event_type, balance_snapshot, note)
    select id, 'balance_cured', 0, 'Resolved after ledger sync confirmed no qualifying overdue balance.'
    from cured returning 1
  )
  select count(*) into cured_count from logged;

  return jsonb_build_object('synced', synced_count, 'cured', cured_count);
end;
$$;

create or replace function public.set_delinquency_case_hold(
  p_case_id uuid,
  p_hold boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare case_row public.delinquency_cases;
begin
  select * into case_row from public.delinquency_cases where id = p_case_id for update;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(case_row.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to manage this delinquency case';
  end if;
  if p_hold and case_row.status <> 'open' then raise exception 'Only an open case may be placed on hold'; end if;
  if not p_hold and case_row.status <> 'on_hold' then raise exception 'Case is not on hold'; end if;
  if p_hold and char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'Hold reason must be at least 10 characters'; end if;
  update public.delinquency_cases
  set status = case when p_hold then 'on_hold' else 'open' end,
      hold_reason = case when p_hold then btrim(p_note) else null end
  where id = p_case_id;
  insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note)
  values (p_case_id, case when p_hold then 'hold_placed' else 'hold_released' end,
          case_row.current_step_number, case_row.balance_snapshot, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

create or replace function public.review_delinquency_legal_gate(
  p_case_id uuid,
  p_approved boolean,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  case_row public.delinquency_cases;
begin
  select * into case_row from public.delinquency_cases where id = p_case_id for update;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_admin_portfolio(case_row.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Only a human portfolio administrator may review legal escalation';
  end if;
  if case_row.status <> 'legal_review' then raise exception 'Case is not awaiting legal review'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 20 then
    raise exception 'Legal review note must be at least 20 characters';
  end if;
  update public.delinquency_cases
  set status = case when p_approved then 'approved_for_counsel' else 'on_hold' end,
      hold_reason = case when p_approved then null else btrim(p_note) end,
      legal_reviewed_at = now(), legal_reviewed_by = auth.uid(), legal_review_note = btrim(p_note)
  where id = p_case_id;
  insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note)
  values (p_case_id, case when p_approved then 'counsel_referral_approved' else 'legal_escalation_rejected' end,
          case_row.current_step_number, case_row.balance_snapshot, btrim(p_note));
end;
$$;

revoke all on function public.initialize_delinquency_policy(uuid) from public, anon;
grant execute on function public.initialize_delinquency_policy(uuid) to authenticated, service_role;
revoke all on function public.advance_delinquency_case(uuid, text) from public, anon;
grant execute on function public.advance_delinquency_case(uuid, text) to authenticated, service_role;
revoke all on function public.sync_owner_delinquency_cases(uuid) from public, anon;
grant execute on function public.sync_owner_delinquency_cases(uuid) to authenticated, service_role;
revoke all on function public.set_delinquency_case_hold(uuid, boolean, text) from public, anon;
grant execute on function public.set_delinquency_case_hold(uuid, boolean, text) to authenticated, service_role;
revoke all on function public.review_delinquency_legal_gate(uuid, boolean, text) from public, anon;
grant execute on function public.review_delinquency_legal_gate(uuid, boolean, text) to authenticated, service_role;

comment on function public.review_delinquency_legal_gate(uuid, boolean, text) is
  'Records a human administrative decision only. It never files, sends, or executes legal action.';

grant select, insert, update on public.capital_projects to authenticated;
grant select, insert, update, delete on public.capital_project_milestones, public.capital_project_work_orders to authenticated;
grant select, insert, update on public.delinquency_policies, public.delinquency_steps to authenticated;
grant select on public.delinquency_cases, public.delinquency_case_events to authenticated;
revoke insert, update, delete on public.delinquency_cases, public.delinquency_case_events from authenticated;
grant all on public.capital_projects, public.capital_project_milestones, public.capital_project_work_orders to service_role;
grant all on public.delinquency_policies, public.delinquency_steps, public.delinquency_cases, public.delinquency_case_events to service_role;
