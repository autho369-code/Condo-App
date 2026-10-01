-- Report data corrections from the reports audit.
--  * cash_flow: summed income and expense accounts (net income, accruals
--    included); it now reports the movement of the cash accounts themselves.
--  * delinquency: used the whole unit balance (future charges included) and the
--    oldest due date of any charge ever (paid ones included); it now uses only
--    open charges already past due, in the association's local date.
--  * violation_log: ignored the report's date range.
--  * vendor 1099: merged every association into one row per vendor; each
--    association is its own payer, so amounts and the $600 threshold are per
--    association. Void/archived bills are excluded and the tax year follows
--    the association's local calendar.
--  * homeowner ledger: had no balance brought forward or running balance.

create or replace function public.report_data_cash_flow(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.number), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select g.number, g.name,
           coalesce(sum(jl.debit_amount) filter (where je.entry_date < prm.df), 0)
             - coalesce(sum(jl.credit_amount) filter (where je.entry_date < prm.df), 0) as opening_balance,
           coalesce(sum(jl.debit_amount) filter (where je.entry_date between prm.df and prm.dt), 0) as cash_in,
           coalesce(sum(jl.credit_amount) filter (where je.entry_date between prm.df and prm.dt), 0) as cash_out,
           coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where je.entry_date between prm.df and prm.dt), 0) as net_change,
           coalesce(sum(jl.debit_amount - jl.credit_amount) filter (where je.entry_date <= prm.dt), 0) as closing_balance
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
      join public.gl_accounts g on g.id = jl.gl_account_id and g.account_type::text = 'cash'
      cross join prm
     where (prm.aid is null or jl.association_id = prm.aid)
       and je.entry_date <= prm.dt
     group by g.id, g.number, g.name
  ) r;
$function$;

create or replace function public.report_data_delinquency(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.balance desc), '[]'::jsonb)
  from (
    select a.name as association_name,
           u.unit_number,
           o.homeowner,
           o.homeowner_email,
           sum(ar.balance_due) as balance,
           min(ar.due_date) as oldest_due_date,
           (public.association_local_date(a.id) - min(ar.due_date)) as days_past_due
      from public.aged_receivables ar
      join public.units u on u.id = ar.unit_id and u.archived_at is null
      join public.associations a on a.id = ar.association_id
      -- One row per unit even when several current owners are on file.
      left join lateral (
        select string_agg(ow.full_name, ', ' order by ow.full_name) as homeowner,
               string_agg(ow.email, ', ' order by ow.full_name) as homeowner_email
          from public.occupancies occ
          join public.owners ow on ow.id = occ.owner_id
         where occ.unit_id = u.id and occ.status = 'current'
      ) o on true
     where a.portfolio_id = p_portfolio_id
       and (nullif(p_params->>'association_id', '') is null
            or a.id = (p_params->>'association_id')::uuid)
       and ar.due_date < public.association_local_date(a.id)
     group by a.id, a.name, u.id, u.unit_number, o.homeowner, o.homeowner_email
    having sum(ar.balance_due) > 0
  ) r;
$function$;

create or replace function public.report_data_violation_log(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.date_observed desc), '[]'::jsonb)
  from (
    with prm as (select * from public.rpt_prm(p_params))
    select v.title, v.violation_type::text, v.status::text,
           a.name as association, u.unit_number, o.full_name as owner_name,
           v.date_observed, v.due_date, v.fine_amount, v.cured_at
      from public.violations v
      cross join prm
      join public.associations a on a.id = v.association_id
      left join public.units u on u.id = v.unit_id
      left join public.owners o on o.id = v.owner_id
     where a.portfolio_id = p_portfolio_id
       and (prm.aid is null or a.id = prm.aid)
       and v.archived_at is null
       and coalesce(v.date_observed, v.created_at::date) between prm.df and prm.dt
  ) r;
$function$;

create or replace function public.assemble_vendor_1099_data(p_portfolio_id uuid, p_tax_year integer)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
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
        count(*) as bill_count,
        p_tax_year as tax_year
      from public.vendors v
      join public.payable_bills pb
        on pb.vendor_id = v.id
       and pb.status = 'paid'
       and pb.archived_at is null
       and pb.paid_at is not null
      join public.associations a on a.id = pb.association_id and a.portfolio_id = p_portfolio_id
      left join public.vendor_financial_details vfd on vfd.vendor_id = v.id
      where v.portfolio_id = p_portfolio_id
        and (auth.role() = 'service_role' or (auth.uid() is null and session_user <> 'authenticator') or public.can_manage_finance(p_portfolio_id) or public.is_platform_operator())
        and v.send_1099 = true
        and v.archived_at is null
        and extract(year from public.association_local_date(a.id, pb.paid_at)) = p_tax_year
      group by a.id, a.name, a.tax_id, v.id, v.name, v.taxpayer_name, vfd.taxpayer_id,
               v.address_street, v.address_city, v.address_state, v.address_zip
      having sum(pb.amount - coalesce(pb.credit_applied, 0)) >= 600  -- IRS threshold, per payer
    ) r;
$function$;

create or replace function public.report_data_vendor_1099(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(e), '[]'::jsonb)
    from jsonb_array_elements(public.assemble_vendor_1099_data(
           p_portfolio_id,
           coalesce((p_params->>'tax_year')::integer,
                    extract(year from (now() - interval '1 year'))::integer))) e
   where nullif(p_params->>'association_id', '') is null
      or e->>'association_id' = p_params->>'association_id';
$function$;

create or replace function public.vendor_1099_totals(p_tax_year integer)
returns table(association_id uuid, vendor_id uuid, total_paid numeric, bill_count integer)
language sql
stable
set search_path to 'public'
as $function$
  select pb.association_id,
         pb.vendor_id,
         coalesce(sum(pb.amount - coalesce(pb.credit_applied, 0)), 0)::numeric,
         count(*)::integer
    from public.payable_bills pb
    join public.vendors v on v.id = pb.vendor_id
   where pb.status = 'paid'
     and pb.archived_at is null
     and v.send_1099
     and extract(year from public.association_local_date(pb.association_id, pb.paid_at)) = p_tax_year
   group by pb.association_id, pb.vendor_id;
$function$;

create or replace function public.report_data_homeowner_ledger(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t_unit uuid;
  t_from date;
  t_to date;
  t_opening numeric;
begin
  begin
    t_unit := nullif(p_params->>'unit_id', '')::uuid;
    t_from := coalesce(
      nullif(p_params->>'date_from', '')::date,
      nullif(p_params->>'from_date', '')::date,
      nullif(p_params->>'date_start', '')::date,
      current_date - interval '1 year'
    );
    t_to := coalesce(
      nullif(p_params->>'date_to', '')::date,
      nullif(p_params->>'to_date', '')::date,
      nullif(p_params->>'date_end', '')::date,
      current_date
    );
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'invalid owner-ledger report parameters';
  end;

  if t_unit is null or not exists (
    select 1
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
    where u.id = t_unit
      and a.portfolio_id = p_portfolio_id
      and u.archived_at is null
      and b.archived_at is null
      and a.archived_at is null
  ) then
    raise exception 'unit is not accessible for this portfolio';
  end if;

  if t_from > t_to then
    raise exception 'report start date must not be after end date';
  end if;

  t_opening := coalesce((select sum(c.amount) from public.charges c where c.unit_id = t_unit and c.due_date < t_from), 0)
             - coalesce((select sum(p.amount) from public.payments p where p.unit_id = t_unit and p.payment_date < t_from), 0);

  return (
    with events as (
      select t_from as event_date, 0 as seq,
             'opening_balance'::text as kind,
             'Balance brought forward'::text as description,
             greatest(t_opening, 0) as amount,
             greatest(-t_opening, 0) as payment
      union all
      select c.due_date, 1, 'charge'::text, c.description, c.amount, 0::numeric
        from public.charges c
       where c.unit_id = t_unit
         and c.due_date between t_from and t_to
      union all
      select p.payment_date, 2, 'payment'::text, coalesce(p.notes, p.method), 0, p.amount
        from public.payments p
       where p.unit_id = t_unit
         and p.payment_date between t_from and t_to
    ), ordered as (
      select e.*, sum(e.amount - e.payment) over (order by e.event_date, e.seq rows unbounded preceding) as balance,
             row_number() over (order by e.event_date, e.seq) as rn
        from events e
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'event_date', o.event_date, 'kind', o.kind, 'description', o.description,
             'amount', o.amount, 'payment', o.payment, 'balance', o.balance) order by o.rn), '[]'::jsonb)
      from ordered o
  );
end;
$function$;
