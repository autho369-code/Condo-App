-- Payables follow-ups (Next gaps): the 1099 totals no longer call
-- association_local_date once per paid bill (~0.75 s of the time at 50,000
-- paid bills a year). The tax year becomes a range on paid_at in the
-- association's time zone: a bill counts in the year of its local payment
-- date, exactly as before.
--
-- Both start from the paid bills (a bill with no association still counts,
-- under America/Chicago, as before), first narrowed by the index to bills
-- paid within two days of the year (every time zone is within a day of
-- UTC). A missing or blank time zone falls back to America/Chicago, as
-- association_local_date does. Rolled back on production at 50,000 paid
-- bills: 781 -> 56 ms (totals) and 814 -> 42 ms (1099 data), identical
-- output for four time zones x four tax years, New Year boundaries and a
-- bill with no association.
--
-- vendor_1099_totals stays an invoker function (row security): every role
-- that can see a paid bill can also see its association (finance staff and
-- managers through the same portfolio and scope, vendors through
-- associations_vendor_bill_read, the platform operator through both;
-- verified 2026-10-13: no bill's portfolio differs from its association's).
--
-- Re-runnable (create or replace, create index if not exists).

create index if not exists idx_payable_bills_paid_at
  on public.payable_bills (paid_at)
  where status = 'paid' and archived_at is null and paid_at is not null;

create or replace function public.vendor_1099_totals(p_tax_year integer)
returns table(association_id uuid, vendor_id uuid, total_paid numeric, bill_count integer)
language sql
stable
set search_path to 'public'
as $function$
  select pb.association_id,
         pb.vendor_id,
         coalesce(sum(pb.amount - coalesce(pb.credit_applied, 0)), 0)::numeric,
         (count(*) filter (where pb.amount - coalesce(pb.credit_applied, 0) > 0))::integer
    from public.payable_bills pb
    join public.vendors v on v.id = pb.vendor_id
    left join public.associations a on a.id = pb.association_id
   where pb.status = 'paid'
     and pb.archived_at is null
     and v.send_1099
     -- every time zone is within a day of UTC: narrows to the year's bills
     and pb.paid_at >= make_date(p_tax_year, 1, 1)::timestamp at time zone 'UTC' - interval '2 days'
     and pb.paid_at <  make_date(p_tax_year + 1, 1, 1)::timestamp at time zone 'UTC' + interval '2 days'
     -- the local payment date is in the tax year
     and pb.paid_at >= (make_date(p_tax_year, 1, 1)::timestamp at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))
     and pb.paid_at <  (make_date(p_tax_year + 1, 1, 1)::timestamp at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))
   group by pb.association_id, pb.vendor_id;
$function$;

create or replace function public.assemble_vendor_1099_data(p_portfolio_id uuid, p_tax_year integer)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association_name, r.total_paid desc), '[]'::jsonb)
    from (
      select
        a.id as association_id,
        a.name as association_name,
        a.tax_id as payer_tax_id,
        v.id as vendor_id,
        v.name as vendor_name,
        v.taxpayer_name,
        vfd.taxpayer_id,
        v.address_street, v.address_city, v.address_state, v.address_zip,
        sum(pb.amount - coalesce(pb.credit_applied, 0)) as total_paid,
        count(*) filter (where pb.amount - coalesce(pb.credit_applied, 0) > 0) as bill_count,
        p_tax_year as tax_year
      from public.payable_bills pb
      join public.associations a on a.id = pb.association_id and a.portfolio_id = p_portfolio_id
      join public.vendors v on v.id = pb.vendor_id
      left join public.vendor_financial_details vfd on vfd.vendor_id = v.id
      where pb.status = 'paid'
        and pb.archived_at is null
        and pb.paid_at is not null
        and pb.paid_at >= make_date(p_tax_year, 1, 1)::timestamp at time zone 'UTC' - interval '2 days'
        and pb.paid_at <  make_date(p_tax_year + 1, 1, 1)::timestamp at time zone 'UTC' + interval '2 days'
        and pb.paid_at >= (make_date(p_tax_year, 1, 1)::timestamp at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))
        and pb.paid_at <  (make_date(p_tax_year + 1, 1, 1)::timestamp at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))
        and v.portfolio_id = p_portfolio_id
        and (auth.role() = 'service_role' or (auth.uid() is null and session_user <> 'authenticator') or public.can_manage_finance(p_portfolio_id) or public.is_platform_operator())
        and v.send_1099 = true
      group by a.id, a.name, a.tax_id, v.id, v.name, v.taxpayer_name, vfd.taxpayer_id,
               v.address_street, v.address_city, v.address_state, v.address_zip
      having sum(pb.amount - coalesce(pb.credit_applied, 0)) >= 600  -- IRS threshold, per payer
    ) r
  ) s(x) limit 1);
end$function$;
