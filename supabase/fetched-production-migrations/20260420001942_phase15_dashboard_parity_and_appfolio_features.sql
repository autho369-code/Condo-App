-- =============================================================================
-- Phase 15 — Dashboard parity + AppFolio feature alignment
--   • approval_votes table with quorum-based auto-resolution
--   • income_recertifications for LIHTC/affordable housing
--   • data_diagnostics for data-quality tracking
--   • v_dashboard_summary view (one row per portfolio with dashboard widgets)
--   • v_insurance_expirations view
--   • v_homeowner_ledgers view (replaces "saved ledger per homeowner" UX pattern)
--   • 1099 data assembly function
--   • 20+ more report definitions to match AppFolio catalog
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. approval_votes (board voting on approval_requests)
-- -----------------------------------------------------------------------------
create type public.approval_vote_choice as enum ('yes', 'no', 'abstain');

alter table public.approval_requests
  add column required_votes integer not null default 1 check (required_votes >= 1),
  add column votes_for integer not null default 0,
  add column votes_against integer not null default 0,
  add column votes_abstain integer not null default 0;

create table public.approval_votes (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  board_member_id uuid references public.board_members(id) on delete set null,
  voter_user_id uuid references auth.users(id) on delete set null,
  choice public.approval_vote_choice not null,
  comment text,
  cast_at timestamptz not null default now(),
  unique (approval_request_id, board_member_id)
);
create index idx_approval_votes_request on public.approval_votes(approval_request_id);
create index idx_approval_votes_voter on public.approval_votes(voter_user_id);

alter table public.approval_votes enable row level security;
create policy approval_votes_staff_read on public.approval_votes
  for select to authenticated
  using (exists (select 1 from public.approval_requests ar
                 where ar.id = approval_request_id and public.can_access_portfolio(ar.portfolio_id)));
create policy approval_votes_board_cast on public.approval_votes
  for insert to authenticated
  with check (
    public.is_board_user()
    and voter_user_id = auth.uid()
    and exists (
      select 1 from public.approval_requests ar
      join public.board_members bm on bm.auth_user_id = auth.uid() and bm.active
      where ar.id = approval_request_id
        and ar.association_id = bm.association_id
        and ar.status = 'pending'
    )
  );
create policy approval_votes_platform_all on public.approval_votes
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());

-- Auto-tally when a vote is cast; flip status to approved/rejected when quorum hit
create or replace function public.tally_approval_vote()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  req public.approval_requests;
  n_for integer; n_against integer; n_abstain integer;
begin
  select count(*) filter (where choice = 'yes'),
         count(*) filter (where choice = 'no'),
         count(*) filter (where choice = 'abstain')
    into n_for, n_against, n_abstain
    from public.approval_votes
   where approval_request_id = new.approval_request_id;

  select * into req from public.approval_requests where id = new.approval_request_id;

  update public.approval_requests
     set votes_for = n_for,
         votes_against = n_against,
         votes_abstain = n_abstain,
         status = case
           when n_for >= req.required_votes then 'approved'::public.approval_request_status
           when n_against >= req.required_votes then 'rejected'::public.approval_request_status
           else status
         end,
         decision_at = case
           when (n_for >= req.required_votes or n_against >= req.required_votes) and decision_at is null then now()
           else decision_at
         end,
         updated_at = now()
   where id = new.approval_request_id;
  return new;
end;
$$;

drop trigger if exists trg_tally_approval_vote on public.approval_votes;
create trigger trg_tally_approval_vote
  after insert or update on public.approval_votes
  for each row execute function public.tally_approval_vote();

-- -----------------------------------------------------------------------------
-- 2. income_recertifications (LIHTC/Section 8)
-- -----------------------------------------------------------------------------
create type public.recert_status as enum ('scheduled','in_progress','submitted','approved','rejected','overdue');

create table public.income_recertifications (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  occupancy_id uuid references public.occupancies(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  program text,
  due_date date not null,
  status public.recert_status not null default 'scheduled',
  previous_income numeric(14,2),
  current_income numeric(14,2),
  household_size smallint,
  documents jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_recerts_portfolio on public.income_recertifications(portfolio_id);
create index idx_recerts_unit on public.income_recertifications(unit_id);
create index idx_recerts_due on public.income_recertifications(due_date) where status not in ('approved','rejected');
create index idx_recerts_status on public.income_recertifications(status);
create trigger trg_recerts_updated before update on public.income_recertifications
  for each row execute function public.touch_updated_at();

alter table public.income_recertifications enable row level security;
create policy recerts_staff_all on public.income_recertifications
  for all to authenticated
  using (public.can_access_portfolio(portfolio_id))
  with check (public.can_access_portfolio(portfolio_id));

-- -----------------------------------------------------------------------------
-- 3. data_diagnostics (data quality tracking)
-- -----------------------------------------------------------------------------
create type public.diagnostic_severity as enum ('info','warning','error');

create table public.data_diagnostics (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  category text not null,
  entity_type text,
  entity_id uuid,
  severity public.diagnostic_severity not null default 'warning',
  title text not null,
  details text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1
);
create index idx_diagnostics_portfolio_cat on public.data_diagnostics(portfolio_id, category) where resolved_at is null;
create index idx_diagnostics_entity on public.data_diagnostics(entity_type, entity_id);
create unique index idx_diagnostics_dedup on public.data_diagnostics(portfolio_id, category, coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), title)
  where resolved_at is null;

alter table public.data_diagnostics enable row level security;
create policy diagnostics_staff_read on public.data_diagnostics
  for select to authenticated using (public.can_access_portfolio(portfolio_id));
create policy diagnostics_admin_write on public.data_diagnostics
  for all to authenticated using (public.can_admin_portfolio(portfolio_id)) with check (public.can_admin_portfolio(portfolio_id));

comment on table public.data_diagnostics is 'AppFolio-style Data Diagnostics: tracks invalid phone numbers, missing emails, duplicate vendors, etc.';

-- Function that scans a portfolio and records diagnostics
create or replace function public.scan_data_diagnostics(p_portfolio_id uuid)
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  n integer := 0;
begin
  -- Invalid phone numbers (not matching typical US format)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'invalid_phone', 'owner', o.id, 'warning',
         'Owner ' || coalesce(o.full_name,'<unknown>') || ' has unparseable phone: ' || o.phone
    from public.owners o
   where o.portfolio_id = p_portfolio_id
     and o.phone is not null
     and o.phone !~ '^\+?[0-9 ().-]{10,20}$'
     and o.archived_at is null
  on conflict do nothing;
  get diagnostics n = row_count;

  -- Missing owner email (preferred_comm is email but email null/empty)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'missing_email', 'owner', o.id, 'warning',
         'Owner ' || coalesce(o.full_name,'<unknown>') || ' prefers email but email is missing'
    from public.owners o
   where o.portfolio_id = p_portfolio_id
     and o.preferred_comm = 'email'
     and (o.email is null or o.email = '')
     and o.archived_at is null
  on conflict do nothing;

  -- Vendors missing taxpayer_id but send_1099 = true
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'missing_taxpayer_id', 'vendor', v.id, 'error',
         'Vendor ' || v.name || ' has send_1099=true but no taxpayer_id'
    from public.vendors v
   where v.portfolio_id = p_portfolio_id
     and v.send_1099 = true
     and (v.taxpayer_id is null or v.taxpayer_id = '')
     and v.archived_at is null
  on conflict do nothing;

  -- Vendor compliance expired
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'vendor_compliance_expired', 'vendor', v.id, 'error',
         'Vendor ' || v.name || ' has expired compliance documents'
    from public.vendors v
    join public.vendor_compliance vc on vc.vendor_id = v.id
   where v.portfolio_id = p_portfolio_id
     and v.archived_at is null
     and (vc.workers_comp_expiration < current_date
          or vc.general_liability_expiration < current_date
          or vc.auto_insurance_expiration < current_date)
  on conflict do nothing;

  -- Units without an active occupancy (potentially vacant / data-missing)
  insert into public.data_diagnostics (portfolio_id, category, entity_type, entity_id, severity, title)
  select p_portfolio_id, 'unit_no_current_occupancy', 'unit', u.id, 'info',
         'Unit ' || u.unit_number || ' has no current occupancy record'
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where a.portfolio_id = p_portfolio_id
     and u.archived_at is null
     and not exists (select 1 from public.occupancies occ
                      where occ.unit_id = u.id and occ.status = 'current')
  on conflict do nothing;

  return (select count(*) from public.data_diagnostics
          where portfolio_id = p_portfolio_id and resolved_at is null);
end;
$$;

grant execute on function public.scan_data_diagnostics(uuid) to authenticated, service_role;

-- Schedule data diagnostics scan for all portfolios nightly
select cron.schedule(
  'scan-data-diagnostics-nightly',
  '15 2 * * *',
  $$ do $_$ declare p record; begin
       for p in select id from public.portfolios where suspended_at is null loop
         perform public.scan_data_diagnostics(p.id);
       end loop;
     end $_$; $$
);

-- -----------------------------------------------------------------------------
-- 4. Views for the admin dashboard
-- -----------------------------------------------------------------------------

-- Insurance expirations in next 60 days
create view public.v_insurance_expirations
  with (security_invoker = true) as
select
  v.portfolio_id,
  v.id as vendor_id,
  v.name as vendor_name,
  vc.workers_comp_expiration,
  vc.general_liability_expiration,
  vc.auto_insurance_expiration,
  vc.epa_certification_expiration,
  vc.state_license_expiration,
  least(
    vc.workers_comp_expiration,
    vc.general_liability_expiration,
    vc.auto_insurance_expiration,
    vc.epa_certification_expiration,
    vc.state_license_expiration,
    vc.contract_expiration
  ) as soonest_expiration
from public.vendors v
join public.vendor_compliance vc on vc.vendor_id = v.id
where v.archived_at is null
  and least(
    vc.workers_comp_expiration,
    vc.general_liability_expiration,
    vc.auto_insurance_expiration,
    vc.epa_certification_expiration,
    vc.state_license_expiration,
    vc.contract_expiration
  ) between current_date and current_date + interval '60 days';

-- Homeowner ledger summary (replaces AppFolio's 752 saved ledger reports)
create view public.v_homeowner_ledgers
  with (security_invoker = true) as
select
  o.id as owner_id,
  o.full_name as owner_name,
  o.email,
  a.portfolio_id,
  a.id as association_id,
  a.name as association_name,
  u.id as unit_id,
  u.unit_number,
  (select coalesce(sum(c.amount),0) from public.charges c where c.unit_id = u.id) as lifetime_charges,
  (select coalesce(sum(p.amount),0) from public.payments p where p.unit_id = u.id) as lifetime_payments,
  coalesce(ub.balance, 0) as current_balance,
  (select count(*) from public.charges c
    where c.unit_id = u.id and c.due_date < current_date
      and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id),0)) > 0
  ) as open_past_due_count
from public.owners o
join public.occupancies occ on occ.owner_id = o.id and occ.status = 'current'
join public.units u on u.id = occ.unit_id
join public.buildings b on b.id = u.building_id
join public.associations a on a.id = b.association_id
left join public.unit_balances ub on ub.unit_id = u.id
where o.archived_at is null and u.archived_at is null;

-- Dashboard summary (one row per portfolio)
create view public.v_dashboard_summary
  with (security_invoker = true) as
select
  p.id as portfolio_id,
  p.company_name,
  p.tier,
  p.suspended_at,

  -- Online Payment stats (rolling 30-day)
  coalesce((
    select count(*)::numeric / nullif(count(*), 0)
      from public.payments pm
     where pm.payment_date > current_date - interval '30 days'
       and exists (select 1 from public.units u
                   join public.buildings b on b.id = u.building_id
                   join public.associations a on a.id = b.association_id
                   where u.id = pm.unit_id and a.portfolio_id = p.id)
  ), 0) as recent_payment_count,

  -- Portal adoption
  (select count(*) from public.owners o where o.portfolio_id = p.id and o.portal_activated)
    as portal_activated_count,
  (select count(*) from public.owners o where o.portfolio_id = p.id and not o.portal_activated and o.email is not null)
    as portal_not_activated_count,
  (select count(*) from public.owners o where o.portfolio_id = p.id and (o.email is null or o.email = ''))
    as portal_no_email_count,

  -- Delinquency aging
  (select count(*) from public.charges c
     join public.units u on u.id = c.unit_id
     join public.buildings b on b.id = u.building_id
     join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id
      and c.due_date between current_date - interval '30 days' and current_date - interval '1 day'
      and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id),0)) > 0
  ) as delinquency_0_30,
  (select count(*) from public.charges c
     join public.units u on u.id = c.unit_id
     join public.buildings b on b.id = u.building_id
     join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id
      and c.due_date between current_date - interval '60 days' and current_date - interval '31 days'
      and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id),0)) > 0
  ) as delinquency_31_60,
  (select count(*) from public.charges c
     join public.units u on u.id = c.unit_id
     join public.buildings b on b.id = u.building_id
     join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id
      and c.due_date < current_date - interval '60 days'
      and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id),0)) > 0
  ) as delinquency_61_plus,

  -- Work orders
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'new') as wo_new,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'assigned') as wo_assigned,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'scheduled') as wo_scheduled,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'in_progress') as wo_in_progress,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'completed') as wo_completed,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null) as wo_total,

  -- Pending approvals
  (select count(*) from public.approval_requests ar where ar.portfolio_id = p.id and ar.status = 'pending') as pending_approvals,

  -- Upcoming recertifications
  (select count(*) from public.income_recertifications r
    where r.portfolio_id = p.id and r.status not in ('approved','rejected')
      and r.due_date <= current_date + interval '30 days') as upcoming_recerts,

  -- Vendor compliance expirations
  (select count(*) from public.v_insurance_expirations ie where ie.portfolio_id = p.id) as insurance_expirations_60d,

  -- Data diagnostics
  (select count(*) from public.data_diagnostics d where d.portfolio_id = p.id and d.resolved_at is null) as open_diagnostics,

  -- Outstanding vendor bills
  (select count(*) from public.payable_bills pb where pb.portfolio_id = p.id and pb.archived_at is null
    and pb.status in ('pending_approval','approved') and pb.paid_at is null) as outstanding_bills,

  -- Occupancy rate
  case
    when (select count(*) from public.units u
          join public.buildings b on b.id = u.building_id
          join public.associations a on a.id = b.association_id
          where a.portfolio_id = p.id and u.archived_at is null) = 0
    then 0::numeric
    else (100.0 * (select count(*) from public.occupancies occ
                   join public.units u on u.id = occ.unit_id
                   join public.buildings b on b.id = u.building_id
                   join public.associations a on a.id = b.association_id
                   where a.portfolio_id = p.id and occ.status = 'current')
          / nullif((select count(*) from public.units u
                    join public.buildings b on b.id = u.building_id
                    join public.associations a on a.id = b.association_id
                    where a.portfolio_id = p.id and u.archived_at is null), 0))::numeric(5,2)
  end as occupancy_pct
from public.portfolios p;

comment on view public.v_dashboard_summary is 'One row per portfolio. Powers the main admin dashboard widgets. Security-invoker — respects caller''s RLS via underlying tables.';

-- -----------------------------------------------------------------------------
-- 5. 1099 data assembly
-- -----------------------------------------------------------------------------
create or replace function public.assemble_vendor_1099_data(
  p_portfolio_id uuid,
  p_tax_year integer
)
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.total_paid desc), '[]'::jsonb)
    from (
      select
        v.id as vendor_id,
        v.name as vendor_name,
        v.taxpayer_name,
        v.taxpayer_id,
        v.address_street, v.address_city, v.address_state, v.address_zip,
        sum(pb.amount) filter (where pb.paid_at is not null) as total_paid,
        count(*) filter (where pb.paid_at is not null) as bill_count,
        p_tax_year as tax_year
      from public.vendors v
      left join public.payable_bills pb
             on pb.vendor_id = v.id
            and pb.paid_at >= make_date(p_tax_year, 1, 1)
            and pb.paid_at < make_date(p_tax_year + 1, 1, 1)
      where v.portfolio_id = p_portfolio_id
        and v.send_1099 = true
        and v.archived_at is null
      group by v.id, v.name, v.taxpayer_name, v.taxpayer_id,
               v.address_street, v.address_city, v.address_state, v.address_zip
      having coalesce(sum(pb.amount) filter (where pb.paid_at is not null), 0) >= 600  -- IRS threshold
    ) r;
$$;

grant execute on function public.assemble_vendor_1099_data(uuid, integer) to authenticated, service_role;

comment on function public.assemble_vendor_1099_data(uuid, integer) is 'Returns per-vendor 1099-MISC data for a tax year: aggregate payments, taxpayer info, address. Only includes vendors with send_1099=true and >= $600 paid.';

-- Add to the report dispatcher
create or replace function public.report_data_vendor_1099(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select public.assemble_vendor_1099_data(
    p_portfolio_id,
    coalesce((p_params->>'tax_year')::integer, extract(year from (now() - interval '1 year'))::integer)
  );
$$;

-- Update dispatcher to include vendor_1099_detail
create or replace function public.report_data_dispatch(
  p_portfolio_id uuid,
  p_slug text,
  p_params jsonb default '{}'
)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  case p_slug
    when 'delinquency'           then result := public.report_data_delinquency(p_portfolio_id, p_params);
    when 'homeowner_ledger'      then result := public.report_data_homeowner_ledger(p_portfolio_id, p_params);
    when 'work_order_report'     then result := public.report_data_work_orders(p_portfolio_id, p_params);
    when 'open_work_orders'      then result := public.report_data_open_work_orders(p_portfolio_id, p_params);
    when 'property_directory'    then result := public.report_data_property_directory(p_portfolio_id, p_params);
    when 'vendor_directory'      then result := public.report_data_vendor_directory(p_portfolio_id, p_params);
    when 'violation_log'         then result := public.report_data_violation_log(p_portfolio_id, p_params);
    when 'vendor_1099_detail'    then result := public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'vendor_1099_summary'   then result := public.report_data_vendor_1099(p_portfolio_id, p_params);
    else
      raise exception 'report slug "%" not implemented', p_slug;
  end case;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Additional report definitions (from AppFolio screenshot catalog)
-- -----------------------------------------------------------------------------
insert into public.report_definitions (portfolio_id, slug, name, category, description, is_system, output_formats) values
  -- Tax
  (null, 'vendor_1099_detail',      'Vendor 1099 Detail',       'accounting', 'Per-vendor 1099-MISC detail (IRS threshold $600+).', true, array['pdf','xlsx','csv']::public.report_format[]),
  (null, 'vendor_1099_summary',     'Vendor 1099 Summary',      'accounting', 'Summary of all 1099-eligible vendors for a tax year.', true, array['pdf','xlsx','csv']::public.report_format[]),
  (null, 'owner_1099_detail',       'Owner 1099 Detail',        'accounting', 'Per-owner 1099 detail for rental properties.', true, array['pdf','xlsx','csv']::public.report_format[]),
  (null, 'owner_1099_summary',      'Owner 1099 Summary',       'accounting', 'Summary of all 1099-eligible owners.', true, array['pdf','xlsx','csv']::public.report_format[]),

  -- Transaction registers
  (null, 'aged_payables_summary',   'Aged Payables Summary',    'accounting', 'A/P aged by bucket: current, 30, 60, 90+.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'bill_detail',             'Bill Detail',              'accounting', 'All bills with vendor, amount, status.', true, array['pdf','xlsx','csv']::public.report_format[]),
  (null, 'charge_detail',           'Charge Detail',            'accounting', 'All receivable charges with aging.', true, array['pdf','xlsx','csv']::public.report_format[]),
  (null, 'check_register',          'Check Register',           'accounting', 'Check-based payments by bank account.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'deposit_register',        'Deposit Register',         'accounting', 'Bank deposits over a period.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'expense_register',        'Expense Register',         'accounting', 'All expenses by GL account.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'income_register',         'Income Register',          'accounting', 'All income by GL account.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'journal_entry_register',  'Journal Entry Register',   'accounting', 'All posted journal entries.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'unpaid_balances_by_month','Unpaid Balances by Month', 'association','Trend of unpaid balances month over month.', true, array['pdf','xlsx']::public.report_format[]),

  -- Association-specific
  (null, 'homeowner_vehicle_info',  'Homeowner Vehicle Info',   'association', 'Vehicles on file per homeowner.', true, array['pdf','xlsx','csv']::public.report_format[]),
  (null, 'annual_budget_comparative','Annual Budget Comparative','association', 'Budget vs prior year.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'dues_roll',               'Dues Roll',                'association', 'Per-unit dues assignments.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'fund_balance_sheet',      'Fund Balance Sheet',       'association', 'Balance sheet per fund account.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'homeowner_directory',     'Homeowner Directory (Annual)','association','Annual homeowner directory for mailing.', true, array['pdf','xlsx','csv']::public.report_format[]),

  -- Maintenance
  (null, 'project_directory',       'Project Directory',        'maintenance', 'All maintenance projects.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'unit_turn_report',        'Unit Turn Report',         'property_unit', 'Unit turnover timeline.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'purchase_order_detail',   'Purchase Order Detail',    'maintenance', 'All POs with vendor + status + line items.', true, array['pdf','xlsx','csv']::public.report_format[]),

  -- Diagnostic
  (null, 'email_delivery_errors',   'Email Delivery Errors',    'compliance', 'Failed email deliveries — data quality.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'data_diagnostics_summary','Data Diagnostics Summary', 'compliance', 'Open data-quality issues by category.', true, array['pdf','xlsx']::public.report_format[]),
  (null, 'users_and_permissions',   'User Roles and Permissions','compliance', 'Per-user role + GL-account permissions.', true, array['pdf','xlsx']::public.report_format[])
on conflict (slug) do nothing;
;
