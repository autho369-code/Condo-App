-- Server-side totals for dashboards and reports.
-- PostgREST returns at most 1,000 rows per request (max_rows), so totals the
-- app built by summing fetched rows (cash balances, YTD income/expense, AR,
-- month billing/collections, unpaid bills, 1099 payments) were silently
-- understated once a company had more rows than that.
-- Every function is SECURITY INVOKER: it sums only rows the caller can
-- already read under RLS, exactly like the queries it replaces.

-- Posted journal-line totals grouped by GL account. Every filter is optional
-- (null = no filter).
create or replace function public.journal_line_totals(
  p_portfolio_id uuid default null,
  p_gl_account_ids uuid[] default null,
  p_association_ids uuid[] default null,
  p_account_types text[] default null,
  p_from date default null,
  p_to date default null
)
returns table (gl_account_id uuid, account_type text, debit_total numeric, credit_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select jl.gl_account_id,
         ga.account_type::text,
         coalesce(sum(jl.debit_amount), 0)::numeric,
         coalesce(sum(jl.credit_amount), 0)::numeric
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id and je.posted
    join public.gl_accounts ga on ga.id = jl.gl_account_id
   where (p_portfolio_id is null or je.portfolio_id = p_portfolio_id)
     and (p_gl_account_ids is null or jl.gl_account_id = any (p_gl_account_ids))
     and (p_association_ids is null or jl.association_id = any (p_association_ids))
     and (p_account_types is null or ga.account_type::text = any (p_account_types))
     and (p_from is null or je.entry_date >= p_from)
     and (p_to is null or je.entry_date <= p_to)
   group by jl.gl_account_id, ga.account_type;
$$;

-- Receivables summary from the aged_receivables view.
create or replace function public.receivable_summary(
  p_association_ids uuid[] default null,
  p_as_of date default current_date
)
returns table (ar_total numeric, overdue_total numeric, delinquent_units integer, weighted_days numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(ar.balance_due), 0)::numeric,
         coalesce(sum(ar.balance_due) filter (where ar.due_date < p_as_of), 0)::numeric,
         count(distinct ar.unit_id)::integer,
         case when coalesce(sum(ar.balance_due) filter (where ar.due_date is not null), 0) > 0
              then sum(greatest(0, p_as_of - ar.due_date) * ar.balance_due) filter (where ar.due_date is not null)
                   / sum(ar.balance_due) filter (where ar.due_date is not null)
              else null end::numeric
    from public.aged_receivables ar
   where (p_association_ids is null or ar.association_id = any (p_association_ids))
     and ar.balance_due > 0;
$$;

-- Owner charges billed and payments collected in a date range.
-- Credits (method = 'credit') are not cash collections.
create or replace function public.billing_collection_totals(
  p_from date,
  p_to date,
  p_association_ids uuid[] default null
)
returns table (charges_total numeric, payments_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select coalesce(sum(c.amount), 0)
       from public.charges c
       join public.units u on u.id = c.unit_id
       join public.buildings b on b.id = u.building_id
      where c.due_date between p_from and p_to
        and (p_association_ids is null or b.association_id = any (p_association_ids)))::numeric,
    (select coalesce(sum(p.amount), 0)
       from public.payments p
       join public.units u on u.id = p.unit_id
       join public.buildings b on b.id = u.building_id
      where p.payment_date between p_from and p_to
        and p.method is distinct from 'credit'
        and (p_association_ids is null or b.association_id = any (p_association_ids)))::numeric;
$$;

-- Unpaid payables (not paid or void), net of vendor credits applied.
create or replace function public.unpaid_bills_total(p_portfolio_id uuid default null)
returns table (unpaid_total numeric, unpaid_count integer, overdue_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(pb.amount - coalesce(pb.credit_applied, 0)), 0)::numeric,
         count(*)::integer,
         coalesce(sum(pb.amount - coalesce(pb.credit_applied, 0)) filter (where pb.due_date < current_date), 0)::numeric
    from public.payable_bills pb
   where pb.archived_at is null
     and pb.status not in ('paid', 'void')
     and (p_portfolio_id is null or pb.portfolio_id = p_portfolio_id);
$$;

-- 1099 payments per payer (association) and vendor for a tax year: cash paid
-- (bill amount net of vendor credits) on bills paid during the year.
create or replace function public.vendor_1099_totals(p_tax_year integer)
returns table (association_id uuid, vendor_id uuid, total_paid numeric, bill_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select pb.association_id,
         pb.vendor_id,
         coalesce(sum(pb.amount - coalesce(pb.credit_applied, 0)), 0)::numeric,
         count(*)::integer
    from public.payable_bills pb
    join public.vendors v on v.id = pb.vendor_id
   where pb.status = 'paid'
     and v.send_1099
     and pb.paid_at >= make_date(p_tax_year, 1, 1)
     and pb.paid_at < make_date(p_tax_year + 1, 1, 1)
   group by pb.association_id, pb.vendor_id;
$$;

revoke all on function public.journal_line_totals(uuid, uuid[], uuid[], text[], date, date) from public, anon;
revoke all on function public.receivable_summary(uuid[], date) from public, anon;
revoke all on function public.billing_collection_totals(date, date, uuid[]) from public, anon;
revoke all on function public.unpaid_bills_total(uuid) from public, anon;
revoke all on function public.vendor_1099_totals(integer) from public, anon;
grant execute on function public.journal_line_totals(uuid, uuid[], uuid[], text[], date, date) to authenticated;
grant execute on function public.receivable_summary(uuid[], date) to authenticated;
grant execute on function public.billing_collection_totals(date, date, uuid[]) to authenticated;
grant execute on function public.unpaid_bills_total(uuid) to authenticated;
grant execute on function public.vendor_1099_totals(integer) to authenticated;

-- Receivables by aging bucket (aged_receivables.aging_bucket).
create or replace function public.receivable_aging_buckets(p_association_ids uuid[] default null)
returns table (aging_bucket text, balance_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(ar.aging_bucket, 'unknown'), coalesce(sum(ar.balance_due), 0)::numeric
    from public.aged_receivables ar
   where (p_association_ids is null or ar.association_id = any (p_association_ids))
   group by 1;
$$;
revoke all on function public.receivable_aging_buckets(uuid[]) from public, anon;
grant execute on function public.receivable_aging_buckets(uuid[]) to authenticated;

-- Server code (report exports, crons) calls these with the service role.
grant execute on function public.journal_line_totals(uuid, uuid[], uuid[], text[], date, date) to service_role;
grant execute on function public.receivable_summary(uuid[], date) to service_role;
grant execute on function public.billing_collection_totals(date, date, uuid[]) to service_role;
grant execute on function public.unpaid_bills_total(uuid) to service_role;
grant execute on function public.vendor_1099_totals(integer) to service_role;
grant execute on function public.receivable_aging_buckets(uuid[]) to service_role;
