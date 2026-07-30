-- =============================================================================
-- Phase 16 — AppFolio-screenshot parity (fixed)
-- =============================================================================

alter table public.associations
  add column late_fee_amount_override numeric(10,2) check (late_fee_amount_override is null or late_fee_amount_override >= 0),
  add column late_fee_type text check (late_fee_type in ('flat','percent') or late_fee_type is null),
  add column late_fee_grace_days_override integer check (late_fee_grace_days_override is null or late_fee_grace_days_override between 0 and 60),
  add column late_fee_eligible_charges text default 'every_charge',
  add column nsf_fee_amount_override numeric(10,2) check (nsf_fee_amount_override is null or nsf_fee_amount_override >= 0),
  add column maintenance_limit numeric(14,2) check (maintenance_limit is null or maintenance_limit >= 0),
  add column insurance_expiration date,
  add column home_warranty_covered boolean not null default false,
  add column unit_entry_pre_authorized boolean not null default false,
  add column maintenance_notes text,
  add column online_maintenance_request_instructions text,
  add column year_built smallint check (year_built is null or (year_built between 1700 and 2100)),
  add column budget_variance_threshold_amount numeric(14,2),
  add column budget_variance_threshold_pct numeric(5,2),
  add column budget_variance_threshold_op text check (budget_variance_threshold_op in ('and','or') or budget_variance_threshold_op is null),
  add column reserve_funds numeric(14,2) not null default 0,
  add column basis_for_owner_packets text default 'cash' check (basis_for_owner_packets in ('cash','accrual'));

create type public.agreement_status as enum ('draft','active','expired','terminated','renewing');

create table public.management_agreements (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  name text not null,
  status public.agreement_status not null default 'active',
  start_date date not null,
  end_date date,
  auto_renew boolean not null default true,
  renewal_term_months integer check (renewal_term_months is null or renewal_term_months > 0),
  management_fee_schedule_id uuid references public.management_fee_schedules(id) on delete set null,
  termination_notice_days integer,
  terms jsonb not null default '{}'::jsonb,
  document_url text,
  signed_at timestamptz,
  signed_by_owner text,
  signed_by_manager uuid references auth.users(id) on delete set null,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (end_date is null or end_date > start_date)
);
create index idx_mgmt_agreements_portfolio on public.management_agreements(portfolio_id) where archived_at is null;
create index idx_mgmt_agreements_owner on public.management_agreements(owner_id);
create index idx_mgmt_agreements_association on public.management_agreements(association_id);
create index idx_mgmt_agreements_expiring on public.management_agreements(end_date) where status = 'active' and archived_at is null;
create trigger trg_mgmt_agreements_updated before update on public.management_agreements
  for each row execute function public.touch_updated_at();

alter table public.management_agreements enable row level security;
create policy mgmt_agreements_admin on public.management_agreements
  for all to authenticated using (public.can_admin_portfolio(portfolio_id)) with check (public.can_admin_portfolio(portfolio_id));
create policy mgmt_agreements_staff_read on public.management_agreements
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  association_id uuid references public.associations(id) on delete set null,
  gl_account_id uuid references public.gl_accounts(id) on delete set null,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  name text not null,
  memo text,
  amount numeric(14,2) not null check (amount >= 0),
  frequency public.recurring_frequency not null default 'monthly',
  interval_count integer not null default 1 check (interval_count >= 1),
  start_date date not null default current_date,
  end_date date,
  next_post_date date not null default current_date,
  last_generated_at timestamptz,
  auto_generate boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_recurring_bills_portfolio on public.recurring_bills(portfolio_id) where archived_at is null;
create index idx_recurring_bills_next on public.recurring_bills(next_post_date) where auto_generate and archived_at is null;
create trigger trg_recurring_bills_updated before update on public.recurring_bills
  for each row execute function public.touch_updated_at();

alter table public.recurring_bills enable row level security;
create policy recurring_bills_finance on public.recurring_bills
  for all to authenticated using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

create table public.recurring_journal_entries (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  memo text,
  frequency public.recurring_frequency not null default 'monthly',
  interval_count integer not null default 1 check (interval_count >= 1),
  next_post_date date not null default current_date,
  last_generated_at timestamptz,
  auto_generate boolean not null default true,
  template_lines jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_recurring_je_portfolio on public.recurring_journal_entries(portfolio_id) where archived_at is null;
create index idx_recurring_je_next on public.recurring_journal_entries(next_post_date) where auto_generate and archived_at is null;
create trigger trg_recurring_je_updated before update on public.recurring_journal_entries
  for each row execute function public.touch_updated_at();

alter table public.recurring_journal_entries enable row level security;
create policy recurring_je_finance on public.recurring_journal_entries
  for all to authenticated using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

create type public.je_batch_status as enum ('draft','validating','validated','posted','failed');

create table public.journal_entry_batches (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  description text,
  status public.je_batch_status not null default 'draft',
  upload_url text,
  total_entries integer not null default 0,
  total_debit numeric(14,2) not null default 0,
  total_credit numeric(14,2) not null default 0,
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_je_batches_portfolio on public.journal_entry_batches(portfolio_id, created_at desc);
create trigger trg_je_batches_updated before update on public.journal_entry_batches
  for each row execute function public.touch_updated_at();

alter table public.journal_entry_batches enable row level security;
create policy je_batches_finance on public.journal_entry_batches
  for all to authenticated using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

alter table public.journal_entries add column batch_id uuid references public.journal_entry_batches(id) on delete set null;
create index idx_journal_entries_batch on public.journal_entries(batch_id);

create type public.period_status as enum ('open','soft_closed','closed');

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  period_month smallint not null check (period_month between 1 and 12),
  status public.period_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, fiscal_year, period_month)
);
create index idx_acct_periods_portfolio on public.accounting_periods(portfolio_id, fiscal_year desc, period_month desc);
create trigger trg_acct_periods_updated before update on public.accounting_periods
  for each row execute function public.touch_updated_at();

alter table public.accounting_periods enable row level security;
create policy acct_periods_finance on public.accounting_periods
  for all to authenticated using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

create or replace function public.guard_closed_period_on_je()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare period_row public.accounting_periods;
begin
  if new.posted = true and (tg_op = 'INSERT' or old.posted = false or old.posted is null) then
    select * into period_row from public.accounting_periods
     where portfolio_id = new.portfolio_id
       and fiscal_year = extract(year from new.entry_date)::int
       and period_month = extract(month from new.entry_date)::int;
    if found and period_row.status = 'closed' then
      raise exception 'cannot post journal entry to closed period %/%', period_row.fiscal_year, period_row.period_month;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_closed_period on public.journal_entries;
create trigger trg_guard_closed_period
  before insert or update on public.journal_entries
  for each row execute function public.guard_closed_period_on_je();

create type public.dues_increase_status as enum ('draft','scheduled','posted','cancelled');

create table public.dues_increases (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  name text not null,
  status public.dues_increase_status not null default 'draft',
  effective_date date not null,
  letter_template_id uuid references public.document_templates(id) on delete set null,
  notes text,
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_dues_increases_association on public.dues_increases(association_id, effective_date desc);
create index idx_dues_increases_status on public.dues_increases(status) where status in ('draft','scheduled');
create trigger trg_dues_increases_updated before update on public.dues_increases
  for each row execute function public.touch_updated_at();

alter table public.dues_increases enable row level security;
create policy dues_increases_finance on public.dues_increases
  for all to authenticated using (public.can_manage_finance(portfolio_id)) with check (public.can_manage_finance(portfolio_id));

create table public.dues_increase_lines (
  id uuid primary key default gen_random_uuid(),
  dues_increase_id uuid not null references public.dues_increases(id) on delete cascade,
  occupancy_id uuid not null references public.occupancies(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  old_amount numeric(12,2) not null,
  new_amount numeric(12,2) not null check (new_amount >= 0),
  change_type text not null default 'flat' check (change_type in ('flat','percent','dollar_amount')),
  change_value numeric(12,2),
  letter_generated_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_dues_lines_increase on public.dues_increase_lines(dues_increase_id);
create index idx_dues_lines_occupancy on public.dues_increase_lines(occupancy_id);

alter table public.dues_increase_lines enable row level security;
create policy dues_increase_lines_finance on public.dues_increase_lines
  for all to authenticated
  using (exists (select 1 from public.dues_increases di where di.id = dues_increase_id and public.can_manage_finance(di.portfolio_id)))
  with check (exists (select 1 from public.dues_increases di where di.id = dues_increase_id and public.can_manage_finance(di.portfolio_id)));

alter table public.occupancies
  add column dues_frequency public.recurring_frequency not null default 'monthly',
  add column dues_paid_through date,
  add column last_dues_increase_date date,
  add column last_dues_increase_amount numeric(12,2),
  add column next_scheduled_increase_date date,
  add column next_scheduled_increase_amount numeric(12,2),
  add column nsf_count integer not null default 0,
  add column late_count integer not null default 0;

create or replace function public.post_dues_increase(p_dues_increase_id uuid)
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare increase_row public.dues_increases; line_row record; n integer := 0;
begin
  select * into increase_row from public.dues_increases where id = p_dues_increase_id for update;
  if not found then raise exception 'dues_increase not found'; end if;
  if increase_row.status <> 'scheduled' then
    raise exception 'dues_increase status must be scheduled (is %)', increase_row.status;
  end if;
  for line_row in select * from public.dues_increase_lines where dues_increase_id = p_dues_increase_id loop
    update public.occupancies
       set dues_amount = line_row.new_amount,
           last_dues_increase_date = increase_row.effective_date,
           last_dues_increase_amount = line_row.new_amount - line_row.old_amount,
           next_scheduled_increase_date = null, next_scheduled_increase_amount = null, updated_at = now()
     where id = line_row.occupancy_id;
    n := n + 1;
  end loop;
  update public.dues_increases set status = 'posted', posted_at = now(), posted_by = auth.uid(), updated_at = now()
   where id = p_dues_increase_id;
  return n;
end;
$$;

grant execute on function public.post_dues_increase(uuid) to authenticated;

alter type public.charge_type add value if not exists 'nsf_fee' after 'late_fee';

create table public.amenity_tags (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  category text,
  icon text,
  created_at timestamptz not null default now()
);
create unique index uq_amenity_tags_portfolio_name on public.amenity_tags(portfolio_id, lower(name));
create index idx_amenity_tags_portfolio on public.amenity_tags(portfolio_id);

alter table public.amenity_tags enable row level security;
create policy amenity_tags_staff on public.amenity_tags
  for all to authenticated using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));

create table public.association_amenities (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  amenity_tag_id uuid references public.amenity_tags(id) on delete set null,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);
create unique index uq_assoc_amenities_name on public.association_amenities(association_id, lower(name));
create index idx_assoc_amenities_association on public.association_amenities(association_id);

alter table public.association_amenities enable row level security;
create policy assoc_amenities_staff on public.association_amenities
  for all to authenticated using (public.can_access_association(association_id)) with check (public.can_access_association(association_id));

create table public.unit_amenities (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  amenity_tag_id uuid references public.amenity_tags(id) on delete set null,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);
create unique index uq_unit_amenities_name on public.unit_amenities(unit_id, lower(name));
create index idx_unit_amenities_unit on public.unit_amenities(unit_id);

alter table public.unit_amenities enable row level security;
create policy unit_amenities_staff on public.unit_amenities
  for all to authenticated using (public.can_access_unit(unit_id)) with check (public.can_access_unit(unit_id));

create type public.document_request_status as enum ('requested','in_progress','submitted','approved','rejected','expired');

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete cascade,
  doc_type text not null,
  name text not null,
  description text,
  status public.document_request_status not null default 'requested',
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  due_date date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  attachment_urls jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((vendor_id is not null) or (owner_id is not null))
);
create index idx_doc_requests_portfolio on public.document_requests(portfolio_id);
create index idx_doc_requests_vendor on public.document_requests(vendor_id) where status <> 'approved';
create index idx_doc_requests_owner on public.document_requests(owner_id) where status <> 'approved';
create index idx_doc_requests_status on public.document_requests(status);
create trigger trg_doc_requests_updated before update on public.document_requests
  for each row execute function public.touch_updated_at();

alter table public.document_requests enable row level security;
create policy doc_requests_staff on public.document_requests
  for all to authenticated using (public.can_access_portfolio(portfolio_id)) with check (public.can_access_portfolio(portfolio_id));
create policy doc_requests_vendor_self on public.document_requests
  for all to authenticated using (vendor_id = public.current_vendor_id()) with check (vendor_id = public.current_vendor_id());

create or replace function public.scan_financial_diagnostics(p_portfolio_id uuid)
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer := 0;
begin
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'reconciliation_lapsed', 'bank_account', ba.id, 'error',
         'Bank account ' || ba.name || ' not reconciled in ' || (current_date - coalesce(ba.last_reconciliation_date, ba.created_at::date))::text || ' days'
    from public.bank_accounts ba
   where ba.portfolio_id = p_portfolio_id
     and ba.archived_at is null
     and (ba.last_reconciliation_date is null or ba.last_reconciliation_date < current_date - interval '60 days')
  on conflict do nothing;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unused_prepayment', 'unit', u.id, 'info',
         'Unit ' || u.unit_number || ' has credit balance of ' || to_char(-ub.balance, 'FM$999,999.00')
    from public.unit_balances ub
    join public.units u on u.id = ub.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id and ub.balance < -0.01
  on conflict do nothing;

  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'vendor_insurance_expiring', 'vendor', v.id, 'warning',
         'Vendor ' || v.name || ' has insurance expiring within 30 days'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id and v.archived_at is null
     and ((vc.workers_comp_expiration between current_date and current_date + interval '30 days')
          or (vc.general_liability_expiration between current_date and current_date + interval '30 days')
          or (vc.auto_insurance_expiration between current_date and current_date + interval '30 days'))
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.scan_financial_diagnostics(uuid) to authenticated, service_role;

select cron.schedule('scan-financial-diagnostics-nightly', '25 2 * * *',
  $$ do $_$ declare p record; begin
       for p in select id from public.portfolios where suspended_at is null loop
         perform public.scan_financial_diagnostics(p.id);
       end loop;
     end $_$; $$);

create or replace function public.generate_recurring_bills()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare row record; next_due date; n integer := 0;
begin
  for row in
    select * from public.recurring_bills
     where auto_generate and archived_at is null
       and next_post_date <= current_date
       and (end_date is null or next_post_date <= end_date)
  loop
    insert into public.payable_bills (
      portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
      bill_date, due_date, amount, memo, status, created_by
    ) values (
      row.portfolio_id, row.vendor_id, row.association_id, row.gl_account_id, row.bank_account_id,
      current_date, current_date + 30, row.amount, row.memo || ' (recurring)', 'draft', row.created_by
    );
    next_due := case row.frequency
      when 'daily'     then row.next_post_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_post_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_post_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_post_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_post_date + (row.interval_count || ' years')::interval
    end::date;
    update public.recurring_bills set next_post_date = next_due, last_generated_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.schedule('generate-recurring-bills-daily', '20 2 * * *', $$ select public.generate_recurring_bills(); $$);

create or replace function public.generate_recurring_journal_entries()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare row record; new_entry_id uuid; line jsonb; next_due date; n integer := 0;
begin
  for row in
    select * from public.recurring_journal_entries
     where auto_generate and archived_at is null and next_post_date <= current_date
  loop
    insert into public.journal_entries (
      portfolio_id, entry_date, memo, source_type, source_id, created_by, posted
    ) values (
      row.portfolio_id, current_date, row.memo || ' (recurring)', 'recurring_je', row.id, row.created_by, false
    ) returning id into new_entry_id;
    for line in select * from jsonb_array_elements(row.template_lines) loop
      insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo)
      values (
        new_entry_id, (line->>'gl_account_id')::uuid, (line->>'association_id')::uuid,
        coalesce((line->>'debit')::numeric, 0), coalesce((line->>'credit')::numeric, 0), line->>'memo'
      );
    end loop;
    update public.journal_entries set posted = true where id = new_entry_id;
    next_due := case row.frequency
      when 'daily'     then row.next_post_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_post_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_post_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_post_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_post_date + (row.interval_count || ' years')::interval
    end::date;
    update public.recurring_journal_entries set next_post_date = next_due, last_generated_at = now(), updated_at = now() where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.schedule('generate-recurring-journal-entries-daily', '25 2 * * *', $$ select public.generate_recurring_journal_entries(); $$);

create or replace function public.effective_late_fee_amount(p_association_id uuid)
returns numeric language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(a.late_fee_amount_override, p.default_late_fee_amount)
    from public.associations a join public.portfolios p on p.id = a.portfolio_id where a.id = p_association_id;
$$;

create or replace function public.effective_late_fee_grace_days(p_association_id uuid)
returns integer language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(a.late_fee_grace_days_override, p.default_late_fee_grace_days)
    from public.associations a join public.portfolios p on p.id = a.portfolio_id where a.id = p_association_id;
$$;

create or replace function public.effective_nsf_fee_amount(p_association_id uuid)
returns numeric language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(a.nsf_fee_amount_override, p.default_nsf_fee_amount)
    from public.associations a join public.portfolios p on p.id = a.portfolio_id where a.id = p_association_id;
$$;
;
