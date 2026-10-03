-- Corporate Accounting reports (AppFolio's "Corporate Accounting Reports"):
-- the management company's own receivables from the associations it manages.
-- What an association owes the company is every bill payable to the
-- company's own vendor record (portfolios.management_fee_vendor_id):
-- management fees and anything else the company bills. A bill is a charge on
-- its bill date; it is paid on paid_at for its amount less credits applied.
--   * Corporate - Association Transactions: charges and payments in the period.
--   * Corporate Aged Receivable Detail: unpaid bills as of the end date, aged.
--   * Customer Ledger: per association, opening balance + running balance.

create or replace function public.corporate_receivable_bills(p_portfolio_id uuid)
returns table (bill_id uuid, association_id uuid, association text, bill_number text, bill_date date, due_date date,
               memo text, amount numeric, paid_on date)
language sql stable security definer set search_path = pg_catalog, public as $$
  select pb.id, pb.association_id, a.name, pb.bill_number, pb.bill_date, pb.due_date, pb.memo,
         round(pb.amount - coalesce(pb.credit_applied, 0), 2),
         case when pb.status = 'paid' then coalesce(pb.paid_at::date, pb.bill_date) end
    from public.payable_bills pb
    join public.portfolios p on p.id = pb.portfolio_id and p.management_fee_vendor_id = pb.vendor_id
    join public.associations a on a.id = pb.association_id
   where pb.portfolio_id = p_portfolio_id and pb.archived_at is null and pb.status::text <> 'void';
$$;

create or replace function public.report_data_corporate_association_transactions(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) - 'seq' order by r.date, r.association, r.seq), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
         b as (select * from public.corporate_receivable_bills(p_portfolio_id) cross join prm where prm.aid is null or association_id = prm.aid)
    select b.bill_date as date, b.association, 'Charge' as type, b.bill_number as reference, b.memo, b.amount, 1 as seq
      from b where b.bill_date between b.df and b.dt
    union all
    select b.paid_on, b.association, 'Payment', b.bill_number, b.memo, -b.amount, 2
      from b where b.paid_on between b.df and b.dt
  ) r;
$$;

create or replace function public.report_data_corporate_aged_receivable_detail(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association, r.due_date, r.bill_number), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select b.association, b.bill_number, b.bill_date, b.due_date, b.memo, b.amount as amount_due,
           (prm.dt - coalesce(b.due_date, b.bill_date)) as days_past_due,
           case when prm.dt - coalesce(b.due_date, b.bill_date) <= 0 then b.amount else 0 end as current,
           case when prm.dt - coalesce(b.due_date, b.bill_date) between 1 and 30 then b.amount else 0 end as "1_30",
           case when prm.dt - coalesce(b.due_date, b.bill_date) between 31 and 60 then b.amount else 0 end as "31_60",
           case when prm.dt - coalesce(b.due_date, b.bill_date) between 61 and 90 then b.amount else 0 end as "61_90",
           case when prm.dt - coalesce(b.due_date, b.bill_date) > 90 then b.amount else 0 end as over_90
      from public.corporate_receivable_bills(p_portfolio_id) b cross join prm
     where (prm.aid is null or b.association_id = prm.aid)
       and b.bill_date <= prm.dt
       and (b.paid_on is null or b.paid_on > prm.dt)
  ) r;
$$;

create or replace function public.report_data_customer_ledger(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) - 'seq' - 'association_id' order by r.association, r.seq, r.date, r.reference), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
         b as (select * from public.corporate_receivable_bills(p_portfolio_id) cross join prm where prm.aid is null or association_id = prm.aid),
         lines as (
           -- Balance brought forward: charged minus paid before the period.
           select b.association_id, b.association, b.df as date, 'Opening balance' as type, null::text as reference, null::text as memo,
                  sum(case when b.bill_date < b.df then b.amount else 0 end) - sum(case when b.paid_on < b.df then b.amount else 0 end) as amount,
                  0 as seq
             from b group by b.association_id, b.association, b.df
           union all
           select b.association_id, b.association, b.bill_date, 'Charge', b.bill_number, b.memo, b.amount, 1
             from b where b.bill_date between b.df and b.dt
           union all
           select b.association_id, b.association, b.paid_on, 'Payment', b.bill_number, b.memo, -b.amount, 2
             from b where b.paid_on between b.df and b.dt
         )
    select l.association_id, l.association, l.date, l.type, l.reference, l.memo,
           case when l.type = 'Charge' then l.amount end as charges,
           case when l.type = 'Payment' then -l.amount end as payments,
           sum(l.amount) over (partition by l.association_id order by l.seq = 0 desc, l.date, l.seq, l.reference
                               rows between unbounded preceding and current row) as balance,
           case when l.seq = 0 then 0 else 1 end as seq
      from lines l
  ) r;
$$;

do $$
begin
  alter function public.corporate_receivable_bills(uuid) owner to postgres;
  alter function public.report_data_corporate_association_transactions(uuid, jsonb) owner to postgres;
  alter function public.report_data_corporate_aged_receivable_detail(uuid, jsonb) owner to postgres;
  alter function public.report_data_customer_ledger(uuid, jsonb) owner to postgres;
  revoke all on function public.corporate_receivable_bills(uuid) from public, anon, authenticated;
  revoke all on function public.report_data_corporate_association_transactions(uuid, jsonb) from public, anon, authenticated;
  revoke all on function public.report_data_corporate_aged_receivable_detail(uuid, jsonb) from public, anon, authenticated;
  revoke all on function public.report_data_customer_ledger(uuid, jsonb) from public, anon, authenticated;
  grant execute on function public.corporate_receivable_bills(uuid) to service_role;
  grant execute on function public.report_data_corporate_association_transactions(uuid, jsonb) to service_role;
  grant execute on function public.report_data_corporate_aged_receivable_detail(uuid, jsonb) to service_role;
  grant execute on function public.report_data_customer_ledger(uuid, jsonb) to service_role;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_dispatch(uuid, text, jsonb)'::regprocedure);
  if def !~ 'case p_slug' then
    raise exception 'corporate_accounting_reports: report_data_dispatch drifted';
  end if;
  if def !~ 'corporate_association_transactions' then
    def := regexp_replace(def, 'case p_slug',
      'case p_slug' || chr(10) ||
      '    when ''corporate_association_transactions'' then return public.report_data_corporate_association_transactions(p_portfolio_id, p_params);' || chr(10) ||
      '    when ''corporate_aged_receivable_detail'' then return public.report_data_corporate_aged_receivable_detail(p_portfolio_id, p_params);' || chr(10) ||
      '    when ''customer_ledger'' then return public.report_data_customer_ledger(p_portfolio_id, p_params);');
    execute def;
  end if;
end $$;

insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active)
select v.slug, v.name, 'accounting', v.description, '{}', '{}', '{pdf,csv}', true, true
  from (values
    ('corporate_association_transactions', 'Corporate - Association Transactions', 'Management company charges to each association and the payments received, by date.'),
    ('corporate_aged_receivable_detail', 'Corporate Aged Receivable Detail', 'Unpaid management company bills as of the end date, aged by days past due.'),
    ('customer_ledger', 'Customer Ledger', 'Each association''s account with the management company: opening balance, charges, payments and running balance.')
  ) as v(slug, name, description)
 where not exists (select 1 from public.report_definitions d where d.slug = v.slug and d.portfolio_id is null);

-- The management company's own receivables are finance-only, like tax reports.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_run_access_error(uuid)'::regprocedure);
  if def !~ 'customer_ledger' then
    if position('''(1099|_tax_)''' in def) = 0 then
      raise exception 'corporate_accounting_reports: report_run_access_error drifted';
    end if;
    def := replace(def, '''(1099|_tax_)''', '''(1099|_tax_|^corporate_|^customer_ledger$)''');
    def := replace(def, 'Tax reports are limited to finance staff.', 'Tax and corporate accounting reports are limited to finance staff.');
    execute def;
  end if;
end $$;
