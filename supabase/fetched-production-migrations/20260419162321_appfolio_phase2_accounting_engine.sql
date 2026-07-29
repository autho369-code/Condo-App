-- =============================================================================
-- AppFolio buildout — Phase 2: Accounting Engine
--   • GL accounts (hierarchical chart of accounts) + role permissions
--   • Management fee schedules
--   • Bank accounts + owners + transfers
--   • Payable bills + line items (with approval workflow)
--   • Journal entries + lines (double-entry, balance-enforcing)
--   • Budget lines (monthly × GL × association × fiscal year)
--   • Wire gl_account_id / bank_account_id into existing charges/payments/vendors/associations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.gl_account_type as enum (
  'asset', 'liability', 'equity', 'income', 'expense',
  'cost_of_goods_sold', 'other_income', 'other_expense', 'non_operating',
  'cash', 'accounts_receivable', 'accounts_payable', 'fixed_asset'
);
create type public.gl_fund_account as enum ('operating', 'reserve', 'special_assessment');
create type public.gl_permission as enum ('full', 'read', 'none');

create type public.bank_account_type as enum ('checking', 'savings', 'money_market');

create type public.payable_bill_status as enum ('draft', 'pending_approval', 'approved', 'paid', 'void');

create type public.budget_category as enum ('income', 'expense');

create type public.management_fee_type as enum ('per_unit', 'flat_monthly', 'percentage_of_income');

-- -----------------------------------------------------------------------------
-- 2. gl_accounts (chart of accounts, self-referential for sub-accounts)
-- -----------------------------------------------------------------------------
create table public.gl_accounts (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  number integer not null check (number between 1000 and 9999),
  name text not null check (length(name) between 1 and 200),
  account_type public.gl_account_type not null,
  sub_account_of_id uuid references public.gl_accounts(id) on delete set null,
  include_on_cash_flow boolean not null default true,
  fund_account public.gl_fund_account,
  subject_to_management_fees boolean not null default false,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (portfolio_id, association_id, number)
);
create index idx_gl_accounts_portfolio on public.gl_accounts(portfolio_id) where active;
create index idx_gl_accounts_association on public.gl_accounts(association_id) where active;
create index idx_gl_accounts_parent on public.gl_accounts(sub_account_of_id);
create index idx_gl_accounts_type on public.gl_accounts(account_type);
create trigger trg_gl_accounts_updated before update on public.gl_accounts
  for each row execute function public.touch_updated_at();

alter table public.gl_accounts enable row level security;
create policy gl_accounts_manager_all on public.gl_accounts
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 3. gl_account_role_permissions (per-role access to each GL account)
-- -----------------------------------------------------------------------------
create table public.gl_account_role_permissions (
  id uuid primary key default gen_random_uuid(),
  gl_account_id uuid not null references public.gl_accounts(id) on delete cascade,
  role_id uuid not null references public.user_roles(id) on delete cascade,
  permission public.gl_permission not null default 'read',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gl_account_id, role_id)
);
create index idx_gl_role_perms_gl on public.gl_account_role_permissions(gl_account_id);
create index idx_gl_role_perms_role on public.gl_account_role_permissions(role_id);
create trigger trg_gl_role_perms_updated before update on public.gl_account_role_permissions
  for each row execute function public.touch_updated_at();

alter table public.gl_account_role_permissions enable row level security;
create policy gl_role_perms_manager_all on public.gl_account_role_permissions
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 4. management_fee_schedules
-- -----------------------------------------------------------------------------
create table public.management_fee_schedules (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  fee_type public.management_fee_type not null default 'per_unit',
  amount numeric(14,2) not null default 0,
  percentage numeric(5,2),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mgmt_fee_portfolio on public.management_fee_schedules(portfolio_id) where archived_at is null;
create trigger trg_mgmt_fee_updated before update on public.management_fee_schedules
  for each row execute function public.touch_updated_at();

alter table public.management_fee_schedules enable row level security;
create policy mgmt_fee_manager_all on public.management_fee_schedules
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 5. bank_accounts + bank_account_owners
-- -----------------------------------------------------------------------------
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  bank_name text,
  description text,
  routing_number text,
  account_number text,
  account_type public.bank_account_type not null default 'checking',
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  use_printable_deposit_slip boolean not null default false,
  address_street text, address_city text, address_state text, address_zip text,
  payments_enabled boolean not null default false,
  auto_reconciliation boolean not null default false,
  last_reconciliation_date date,
  next_check_number integer,
  company_name text,
  company_address text,
  check_signature text,
  entity_name text,
  entity_address text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bank_accounts_portfolio on public.bank_accounts(portfolio_id) where archived_at is null;
create index idx_bank_accounts_association on public.bank_accounts(association_id);
create index idx_bank_accounts_gl on public.bank_accounts(gl_account_id);
create trigger trg_bank_accounts_updated before update on public.bank_accounts
  for each row execute function public.touch_updated_at();

alter table public.bank_accounts enable row level security;
create policy bank_accounts_manager_all on public.bank_accounts
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.bank_account_owners (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  full_name text not null,
  role text default 'authorized',
  created_at timestamptz not null default now(),
  unique (bank_account_id, owner_id)
);
create index idx_bank_owners_bank on public.bank_account_owners(bank_account_id);

alter table public.bank_account_owners enable row level security;
create policy bank_owners_manager_all on public.bank_account_owners
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 6. bank_transfers
-- -----------------------------------------------------------------------------
create table public.bank_transfers (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  from_bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  to_bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  transfer_date date not null default current_date,
  reference_number text,
  memo text,
  journal_entry_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_bank_account_id <> to_bank_account_id)
);
create index idx_bank_transfers_from on public.bank_transfers(from_bank_account_id);
create index idx_bank_transfers_to on public.bank_transfers(to_bank_account_id);
create index idx_bank_transfers_date on public.bank_transfers(transfer_date desc);
create trigger trg_bank_transfers_updated before update on public.bank_transfers
  for each row execute function public.touch_updated_at();

alter table public.bank_transfers enable row level security;
create policy bank_transfers_manager_all on public.bank_transfers
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 7. payable_bills + payable_bill_line_items
-- -----------------------------------------------------------------------------
create table public.payable_bills (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  association_id uuid references public.associations(id) on delete set null,
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  bill_number text,
  bill_date date not null default current_date,
  due_date date,
  occurred_on date,
  amount numeric(14,2) not null check (amount >= 0),
  memo text,
  status public.payable_bill_status not null default 'draft',
  approval_required boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_payable_bills_vendor on public.payable_bills(vendor_id) where archived_at is null;
create index idx_payable_bills_association on public.payable_bills(association_id);
create index idx_payable_bills_status on public.payable_bills(status) where archived_at is null;
create index idx_payable_bills_due on public.payable_bills(due_date) where archived_at is null and status in ('approved','pending_approval');
create trigger trg_payable_bills_updated before update on public.payable_bills
  for each row execute function public.touch_updated_at();

alter table public.payable_bills enable row level security;
create policy payable_bills_manager_all on public.payable_bills
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.payable_bill_line_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.payable_bills(id) on delete cascade,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  association_id uuid references public.associations(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bill_line_items_bill on public.payable_bill_line_items(bill_id);
create index idx_bill_line_items_gl on public.payable_bill_line_items(gl_account_id);
create trigger trg_bill_line_items_updated before update on public.payable_bill_line_items
  for each row execute function public.touch_updated_at();

alter table public.payable_bill_line_items enable row level security;
create policy bill_line_items_manager_all on public.payable_bill_line_items
  for all to public using (public.is_manager()) with check (public.is_manager());

-- -----------------------------------------------------------------------------
-- 8. journal_entries + journal_lines (double-entry)
-- -----------------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  entry_date date not null default current_date,
  reference_number text,
  memo text,
  description text,
  source_type text,
  source_id uuid,
  posted boolean not null default false,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_journal_entries_portfolio_date on public.journal_entries(portfolio_id, entry_date desc);
create index idx_journal_entries_source on public.journal_entries(source_type, source_id);
create trigger trg_journal_entries_updated before update on public.journal_entries
  for each row execute function public.touch_updated_at();

alter table public.journal_entries enable row level security;
create policy journal_entries_manager_all on public.journal_entries
  for all to public using (public.is_manager()) with check (public.is_manager());

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  gl_account_id uuid not null references public.gl_accounts(id) on delete restrict,
  association_id uuid references public.associations(id) on delete set null,
  debit_amount numeric(14,2) not null default 0 check (debit_amount >= 0),
  credit_amount numeric(14,2) not null default 0 check (credit_amount >= 0),
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0))
);
create index idx_journal_lines_entry on public.journal_lines(entry_id);
create index idx_journal_lines_gl on public.journal_lines(gl_account_id);
create index idx_journal_lines_association on public.journal_lines(association_id);

alter table public.journal_lines enable row level security;
create policy journal_lines_manager_all on public.journal_lines
  for all to public using (public.is_manager()) with check (public.is_manager());

-- Balance-enforcement trigger: when posted=true, sum(debits) must equal sum(credits)
create or replace function public.validate_journal_entry_balance()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  total_debit numeric;
  total_credit numeric;
  should_check boolean;
begin
  should_check := false;
  if tg_op = 'INSERT' and new.posted = true then
    should_check := true;
  elsif tg_op = 'UPDATE' and new.posted = true and (old.posted is distinct from true) then
    should_check := true;
  end if;

  if should_check then
    select coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0)
      into total_debit, total_credit
      from public.journal_lines
      where entry_id = new.id;

    if abs(total_debit - total_credit) > 0.001 then
      raise exception 'Journal entry % unbalanced: debits=% credits=%', new.id, total_debit, total_credit;
    end if;
    if new.posted_at is null then
      new.posted_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_journal_entries_validate_balance
  before insert or update on public.journal_entries
  for each row execute function public.validate_journal_entry_balance();

-- -----------------------------------------------------------------------------
-- 9. budget_lines
-- -----------------------------------------------------------------------------
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  gl_account_id uuid not null references public.gl_accounts(id) on delete restrict,
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  monthly_amounts numeric(14,2)[] not null default array_fill(0::numeric, array[12]),
  category public.budget_category not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(monthly_amounts, 1) = 12),
  unique (association_id, gl_account_id, fiscal_year)
);
create index idx_budget_lines_assoc_year on public.budget_lines(association_id, fiscal_year);
create index idx_budget_lines_gl on public.budget_lines(gl_account_id);
create trigger trg_budget_lines_updated before update on public.budget_lines
  for each row execute function public.touch_updated_at();

alter table public.budget_lines enable row level security;
create policy budget_lines_manager_all on public.budget_lines
  for all to public using (public.is_manager()) with check (public.is_manager());

-- Convenience view: annual_total per budget line
create view public.budget_line_totals
  with (security_invoker = true) as
select
  bl.*,
  (coalesce(monthly_amounts[1],0) + coalesce(monthly_amounts[2],0) + coalesce(monthly_amounts[3],0)
   + coalesce(monthly_amounts[4],0) + coalesce(monthly_amounts[5],0) + coalesce(monthly_amounts[6],0)
   + coalesce(monthly_amounts[7],0) + coalesce(monthly_amounts[8],0) + coalesce(monthly_amounts[9],0)
   + coalesce(monthly_amounts[10],0) + coalesce(monthly_amounts[11],0) + coalesce(monthly_amounts[12],0)
  )::numeric(14,2) as annual_total
from public.budget_lines bl;

-- -----------------------------------------------------------------------------
-- 10. Wire existing tables
-- -----------------------------------------------------------------------------
alter table public.charges
  add column gl_account_id uuid references public.gl_accounts(id) on delete set null;
create index idx_charges_gl_account on public.charges(gl_account_id);

alter table public.payments
  add column gl_account_id uuid references public.gl_accounts(id) on delete set null,
  add column bank_account_id uuid references public.bank_accounts(id) on delete set null;
create index idx_payments_gl_account on public.payments(gl_account_id);
create index idx_payments_bank_account on public.payments(bank_account_id);

-- Finalize the placeholder FKs from Phase 1
alter table public.vendors
  add constraint vendors_default_gl_account_id_fkey
  foreign key (default_gl_account_id) references public.gl_accounts(id) on delete set null;

alter table public.associations
  add constraint associations_primary_bank_account_id_fkey
  foreign key (primary_bank_account_id) references public.bank_accounts(id) on delete set null;

alter table public.associations
  add constraint associations_management_fee_schedule_id_fkey
  foreign key (management_fee_schedule_id) references public.management_fee_schedules(id) on delete set null;

-- Wire bank_transfers.journal_entry_id now that journal_entries exists
alter table public.bank_transfers
  add constraint bank_transfers_journal_entry_fkey
  foreign key (journal_entry_id) references public.journal_entries(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 11. Comments
-- -----------------------------------------------------------------------------
comment on table public.gl_accounts is 'Chart of accounts per portfolio (optionally per-association). Hierarchical via sub_account_of_id.';
comment on column public.gl_accounts.number is 'AppFolio-style 4-digit account number. 1xxx=assets, 2xxx=liabilities, 3xxx=equity, 4xxx=income, 5xxx=COGS, 6xxx=opex, 7xxx=other income, 8xxx=other expense, 9xxx=non-operating.';
comment on table public.journal_entries is 'Double-entry journal. Flipping posted=true triggers balance validation.';
comment on column public.bank_accounts.account_number is 'Sensitive — consider Vault encryption for production.';
comment on column public.payable_bills.status is 'Workflow: draft → pending_approval → approved → paid (or void).';
;
