-- AppFolio reports: Import Variances, Vendor Ledger (Enhanced), Check Register
-- Detail (Enhanced), and Owner 1099 Detail / Summary (the live report view
-- already exists; its definitions were inactive).

-- ── Imported opening balances ──────────────────────────────
-- The opening-balance import posted a charge per unit but kept no record of
-- the balance the previous system reported, so nothing could be compared.
-- Each imported row is now recorded here; Import Variances compares it with
-- the balance Portier369 calculates for the unit on the same date.
create table if not exists public.imported_balances (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  as_of_date date not null,
  imported_balance numeric(14,2) not null,
  memo text,
  charge_id uuid references public.charges(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists imported_balances_assoc_idx on public.imported_balances (association_id, as_of_date);
alter table public.imported_balances enable row level security;
revoke all on public.imported_balances from anon;

create policy imported_balances_staff_read on public.imported_balances
  for select to authenticated
  using (public.is_any_staff() and public.can_access_portfolio(portfolio_id));
create policy imported_balances_staff_insert on public.imported_balances
  for insert to authenticated
  with check (public.is_any_staff() and public.can_access_portfolio(portfolio_id)
              and exists (select 1 from public.associations a where a.id = association_id and a.portfolio_id = imported_balances.portfolio_id)
              and public.unit_association_id(unit_id) = association_id);

create or replace function public.report_data_import_variances(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association, r.unit, r.as_of_date), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
         rows as (
           select ib.*, a.name as association, u.unit_number as unit,
                  (select coalesce(sum(c.amount), 0) from public.charges c where c.unit_id = ib.unit_id and c.due_date <= ib.as_of_date)
                - (select coalesce(sum(p.amount), 0) from public.payments p where p.unit_id = ib.unit_id and p.payment_date <= ib.as_of_date) as system_balance,
                  (select ub.balance from public.unit_balances ub where ub.unit_id = ib.unit_id) as current_balance
             from public.imported_balances ib
             cross join prm
             join public.associations a on a.id = ib.association_id
             join public.units u on u.id = ib.unit_id
            where ib.portfolio_id = p_portfolio_id and (prm.aid is null or ib.association_id = prm.aid)
         )
    select association, unit, as_of_date, imported_balance, round(system_balance, 2) as system_balance,
           round(system_balance - imported_balance, 2) as variance, round(current_balance, 2) as current_balance,
           memo, created_at::date as imported_on
      from rows
     where (coalesce(p_params->>'only_variances', '') <> 'true' or round(system_balance - imported_balance, 2) <> 0)
  ) r;
$$;

-- ── Vendor Ledger (Enhanced) ───────────────────────────────
-- Per vendor: balance brought forward, then bills (with due date, GL account
-- and memo), checks (bank account, check number) and vendor credits, with a
-- running balance owed to the vendor.
create or replace function public.report_data_vendor_ledger_enhanced(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) - 'seq' - 'vendor_id' order by r.vendor, r.seq, r.date, r.reference), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
         tx as (
           select b.vendor_id, b.association_id, b.bill_date as date, 'Bill' as type, b.bill_number as reference, a.name as association,
                  coalesce(g.number || ' ', '') || coalesce(g.name, '') as gl_account, b.memo, b.due_date,
                  null::text as bank_account, b.amount as amount
             from public.payable_bills b
             left join public.associations a on a.id = b.association_id
             left join public.gl_accounts g on g.id = b.gl_account_id
            where b.portfolio_id = p_portfolio_id and b.archived_at is null and b.status::text <> 'void'
           union all
           select pc.vendor_id, pc.association_id, pc.payment_date, 'Check', pc.check_number::text, a.name, null, pb.memo, null,
                  ba.name, -pc.amount
             from public.payable_checks pc
             left join public.associations a on a.id = pc.association_id
             left join public.bank_accounts ba on ba.id = pc.bank_account_id
             left join public.payable_bills pb on pb.id = pc.bill_id
            where pc.portfolio_id = p_portfolio_id and pc.voided_at is null
           union all
           select vc.vendor_id, vc.association_id, vc.credit_date, 'Vendor credit', vc.reference, a.name,
                  coalesce(g.number || ' ', '') || coalesce(g.name, ''), vc.memo, null, null, -vc.amount
             from public.vendor_credits vc
             left join public.associations a on a.id = vc.association_id
             left join public.gl_accounts g on g.id = vc.gl_account_id
            where vc.portfolio_id = p_portfolio_id
         ),
         scoped as (
           select tx.* from tx cross join prm
            where prm.aid is null or tx.association_id = prm.aid
         ),
         lines as (
           select s.vendor_id, (select df from prm) as date, 'Opening balance' as type, null::text as reference, null::text as association,
                  null::text as gl_account, null::text as memo, null::date as due_date, null::text as bank_account,
                  sum(s.amount) as amount, 0 as seq
             from scoped s where s.date < (select df from prm) group by s.vendor_id
           union all
           select s.vendor_id, s.date, s.type, s.reference, s.association, s.gl_account, s.memo, s.due_date, s.bank_account, s.amount, 1
             from scoped s cross join prm where s.date between prm.df and prm.dt
         )
    select l.vendor_id, v.name as vendor, l.date, l.type, l.reference, l.association, l.gl_account, l.memo, l.due_date, l.bank_account,
           case when l.seq = 1 and l.amount > 0 then l.amount end as charges,
           case when l.seq = 1 and l.amount < 0 then -l.amount end as payments,
           sum(l.amount) over (partition by l.vendor_id order by l.seq, l.date, l.reference rows between unbounded preceding and current row) as balance,
           l.seq
      from lines l join public.vendors v on v.id = l.vendor_id
  ) r;
$$;

-- ── Check Register Detail (Enhanced) ───────────────────────
-- Every check with the bill it paid (number, date, GL account, memo), the
-- bank account, whether it has cleared the bank, and void details.
create or replace function public.report_data_check_register_detail_enhanced(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.payment_date, r.bank_account, r.check_number), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select pc.check_number, pc.payment_date, ba.name as bank_account, v.name as payee, a.name as association,
           pc.amount, initcap(coalesce(pc.status, case when pc.voided_at is not null then 'void' else 'issued' end)) as status,
           pb.bill_number, pb.bill_date, coalesce(g.number || ' ', '') || coalesce(g.name, '') as gl_account, pb.memo,
           exists (select 1 from public.bank_reconciliation_items bri
                     join public.journal_lines jl on jl.id = bri.journal_line_id
                    where jl.entry_id = pc.payment_entry_id and bri.is_cleared) as cleared,
           (select max(bri.cleared_at)::date from public.bank_reconciliation_items bri
              join public.journal_lines jl on jl.id = bri.journal_line_id
             where jl.entry_id = pc.payment_entry_id and bri.is_cleared) as cleared_on,
           pc.voided_at::date as voided_on, pc.void_reason, pc.authorized_signer_label as signer
      from public.payable_checks pc cross join prm
      left join public.vendors v on v.id = pc.vendor_id
      left join public.associations a on a.id = pc.association_id
      left join public.bank_accounts ba on ba.id = pc.bank_account_id
      left join public.payable_bills pb on pb.id = pc.bill_id
      left join public.gl_accounts g on g.id = pb.gl_account_id
     where pc.portfolio_id = p_portfolio_id and (prm.aid is null or pc.association_id = prm.aid)
       and pc.payment_date between prm.df and prm.dt
  ) r;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.report_data_import_variances(uuid, jsonb)',
    'public.report_data_vendor_ledger_enhanced(uuid, jsonb)',
    'public.report_data_check_register_detail_enhanced(uuid, jsonb)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_dispatch(uuid, text, jsonb)'::regprocedure);
  if def !~ 'case p_slug' then
    raise exception 'import_variances: report_data_dispatch drifted';
  end if;
  if def !~ 'import_variances' then
    def := regexp_replace(def, 'case p_slug',
      'case p_slug' || chr(10) ||
      '    when ''import_variances'' then return public.report_data_import_variances(p_portfolio_id, p_params);' || chr(10) ||
      '    when ''vendor_ledger_enhanced'' then return public.report_data_vendor_ledger_enhanced(p_portfolio_id, p_params);' || chr(10) ||
      '    when ''check_register_detail_enhanced'' then return public.report_data_check_register_detail_enhanced(p_portfolio_id, p_params);');
    execute def;
  end if;
end $$;

insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active)
select v.slug, v.name, v.category::public.report_category, v.description, '{}', '{}', '{pdf,csv}', true, true
  from (values
    ('import_variances', 'Import Variances', 'compliance', 'Opening balances imported from the previous system compared with the balance Portier369 calculates for each unit on the same date.'),
    ('vendor_ledger_enhanced', 'Vendor Ledger (Enhanced)', 'accounting', 'Each vendor''s balance brought forward, bills with due date and GL account, checks with bank account, vendor credits, and a running balance.'),
    ('check_register_detail_enhanced', 'Check Register Detail (Enhanced)', 'accounting', 'Every check with the bill it paid, GL account, bank account, cleared status and void details.')
  ) as v(slug, name, category, description)
 where not exists (select 1 from public.report_definitions d where d.slug = v.slug and d.portfolio_id is null);

-- Owner 1099: the live report page already computes it from owner_payables.
update public.report_definitions set active = true
 where slug in ('owner_1099_detail', 'owner_1099_summary') and portfolio_id is null;
