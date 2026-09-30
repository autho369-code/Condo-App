-- Management fee automation (AppFolio "management fee schedules"): a company
-- can have last month's management fees billed automatically on a chosen day
-- of each month, to the saved management company vendor and expense account.
--
-- The calculation and billing move into internal functions that take the
-- company explicitly (no session needed) so the daily cron can run them:
--   app_management_fee_calc(portfolio, month)   -- the fee each policy produces
--   app_bill_management_fees(...)               -- bills + accruals + fee rows
-- management_fee_preview / run_management_fees keep their signatures and their
-- caller checks (finance staff, scoped managers see only their associations)
-- and now wrap the internal functions. The scheduled run bills every
-- association with a fee policy — one fee per association per month, so it
-- never double-bills a month someone already billed by hand.

alter table public.portfolios
  add column if not exists management_fee_auto_enabled boolean not null default false,
  add column if not exists management_fee_auto_day smallint not null default 1,
  add column if not exists management_fee_auto_last_month date,
  add column if not exists management_fee_auto_last_run jsonb;
alter table public.portfolios drop constraint if exists portfolios_management_fee_auto_day_check;
alter table public.portfolios add constraint portfolios_management_fee_auto_day_check
  check (management_fee_auto_day between 1 and 28);

-- ------------------------------------------------------------ calculation
create or replace function public.app_management_fee_calc(p_portfolio_id uuid, p_month date)
returns table (association_id uuid, association_name text, fee_type text, rate numeric, door_count integer,
               basis numeric, fee numeric, already_billed boolean, bill_id uuid)
language sql stable security definer set search_path = pg_catalog, public as $$
  with m as (select date_trunc('month', p_month)::date as start_d,
                    (date_trunc('month', p_month) + interval '1 month - 1 day')::date as end_d),
  pol as (
    select distinct on (p.association_id) p.association_id, p.fee_type, p.amount
      from public.management_fee_policies p, m
     where p.effective_from <= m.end_d and (p.effective_to is null or p.effective_to >= m.start_d)
     order by p.association_id, p.effective_from desc
  ),
  base as (
    select a.id, a.name, pol.fee_type, pol.amount,
           (select count(*)::int from public.units u join public.buildings b on b.id = u.building_id
             where b.association_id = a.id and u.archived_at is null) as doors,
           (select coalesce(sum(c.amount), 0) from public.charges c
              join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id
             where b.association_id = a.id and c.charge_type in ('assessment', 'special_assessment')
               and c.due_date between m.start_d and m.end_d) as assessed,
           mf.bill_id
      from public.associations a
      join pol on pol.association_id = a.id
      cross join m
      left join public.management_fees mf on mf.association_id = a.id and mf.month = m.start_d
     where a.archived_at is null and a.portfolio_id = p_portfolio_id
  )
  select id, name, fee_type, amount, doors,
         case fee_type when 'percentage' then assessed when 'per_door' then doors::numeric else null end,
         round(case fee_type
           when 'per_door' then amount * doors
           when 'flat_monthly' then amount
           when 'percentage' then amount / 100.0 * assessed
         end, 2),
         bill_id is not null,
         bill_id
    from base
   order by name;
$$;

create or replace function public.management_fee_preview(p_month date)
returns table (association_id uuid, association_name text, fee_type text, rate numeric, door_count integer,
               basis numeric, fee numeric, already_billed boolean, bill_id uuid)
language sql stable security definer set search_path = pg_catalog, public as $$
  select c.*
    from public.app_management_fee_calc(public.current_portfolio_id(), p_month) c
   where public.can_manage_finance(public.current_portfolio_id())
     and public.can_manage_association(c.association_id);
$$;

-- ------------------------------------------------------------ billing
create or replace function public.app_bill_management_fees(
  p_portfolio_id uuid, p_month date, p_association_ids uuid[], p_vendor_id uuid, p_gl_account_id uuid,
  p_bill_date date, p_actor uuid, p_source text)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_bill_date date := coalesce(p_bill_date, (date_trunc('month', p_month) + interval '1 month - 1 day')::date);
  r record;
  v_bill uuid;
  n integer := 0;
begin
  if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.portfolio_id = p_portfolio_id and v.archived_at is null) then
    raise exception 'Choose the management company vendor' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = p_portfolio_id and g.active
                   and g.association_id is null and g.account_type::text in ('expense', 'other_expense')) then
    raise exception 'Choose a company-wide expense account for management fees' using errcode = '22023';
  end if;

  for r in
    select * from public.app_management_fee_calc(p_portfolio_id, v_month) pv
     where pv.association_id = any (p_association_ids) and not pv.already_billed and pv.fee > 0
  loop
    insert into public.payable_bills (portfolio_id, vendor_id, association_id, gl_account_id, bill_number, bill_date, due_date,
                                      amount, memo, status, approval_required, approved_at, approved_by, created_by)
    values (p_portfolio_id, p_vendor_id, r.association_id, p_gl_account_id,
            'MGMT-' || to_char(v_month, 'YYYY-MM'), v_bill_date, v_bill_date, r.fee,
            'Management fee — ' || to_char(v_month, 'FMMonth YYYY') || ' (' ||
              case r.fee_type when 'per_door' then r.door_count || ' units × ' || to_char(r.rate, 'FM$999,990.00')
                              when 'flat_monthly' then 'flat monthly'
                              else r.rate || '% of ' || to_char(r.basis, 'FM$999,999,990.00') || ' assessments' end || ')',
            'approved', false, now(), p_actor, p_actor)
    returning id into v_bill;
    perform public.ensure_payable_bill_accrual(v_bill);

    insert into public.management_fees (portfolio_id, association_id, month, fee_amount_cents, door_count,
                                        avg_per_door_cents, fee_type, rate, basis_cents, bill_id, created_by)
    values (p_portfolio_id, r.association_id, v_month, round(r.fee * 100)::int, r.door_count,
            case when r.door_count > 0 then round(r.fee * 100 / r.door_count)::int end,
            r.fee_type, r.rate, round(coalesce(r.basis, 0) * 100)::bigint, v_bill, p_actor)
    on conflict (association_id, month) do update
      set fee_amount_cents = excluded.fee_amount_cents, door_count = excluded.door_count,
          avg_per_door_cents = excluded.avg_per_door_cents, fee_type = excluded.fee_type, rate = excluded.rate,
          basis_cents = excluded.basis_cents, bill_id = excluded.bill_id, created_by = excluded.created_by
      where public.management_fees.bill_id is null;
    if not found then
      raise exception 'Management fee for % was already billed', to_char(v_month, 'FMMonth YYYY') using errcode = '23505';
    end if;
    n := n + 1;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (p_portfolio_id, 'management_fees', null, 'management_fees_billed', p_actor,
          (select email from auth.users where id = p_actor),
          jsonb_build_object('month', v_month, 'bills', n, 'associations', to_jsonb(p_association_ids), 'source', p_source));
  return n;
end $$;

create or replace function public.run_management_fees(
  p_month date, p_association_ids uuid[], p_vendor_id uuid, p_gl_account_id uuid, p_bill_date date default null)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_ids uuid[];
  n integer;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if coalesce(cardinality(p_association_ids), 0) = 0 then raise exception 'Select at least one association' using errcode = '22023'; end if;
  -- Only associations this caller manages (scoped managers see a subset).
  select coalesce(array_agg(a.id), '{}') into v_ids
    from public.associations a
   where a.id = any (p_association_ids) and a.portfolio_id = v_pid and public.can_manage_association(a.id);

  n := public.app_bill_management_fees(v_pid, p_month, v_ids, p_vendor_id, p_gl_account_id, p_bill_date, auth.uid(), 'manual');

  -- Remember the choices for next month.
  update public.portfolios set management_fee_vendor_id = p_vendor_id, management_fee_gl_account_id = p_gl_account_id
   where id = v_pid;
  return n;
end $$;

-- ------------------------------------------------------------ schedule
create or replace function public.set_management_fee_schedule(
  p_enabled boolean, p_day integer, p_vendor_id uuid, p_gl_account_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  -- Automation bills every association in the company, so scoped managers can't turn it on.
  if public.manager_is_scoped() and not public.is_company_admin() then
    raise exception 'Only company-wide finance staff can schedule management fees' using errcode = '42501';
  end if;
  if p_day is null or p_day not between 1 and 28 then
    raise exception 'Choose a day between 1 and 28' using errcode = '22023';
  end if;
  if coalesce(p_enabled, false) then
    if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.portfolio_id = v_pid and v.archived_at is null) then
      raise exception 'Choose the management company vendor' using errcode = '22023';
    end if;
    if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and g.active
                     and g.association_id is null and g.account_type::text in ('expense', 'other_expense')) then
      raise exception 'Choose a company-wide expense account for management fees' using errcode = '22023';
    end if;
  end if;
  update public.portfolios
     set management_fee_auto_enabled = coalesce(p_enabled, false),
         management_fee_auto_day = p_day,
         management_fee_vendor_id = coalesce(p_vendor_id, management_fee_vendor_id),
         management_fee_gl_account_id = coalesce(p_gl_account_id, management_fee_gl_account_id)
   where id = v_pid;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'management_fees', null, 'management_fee_schedule_updated', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('enabled', coalesce(p_enabled, false), 'day', p_day, 'vendor_id', p_vendor_id, 'gl_account_id', p_gl_account_id));
end $$;

-- Daily cron (service role only): on or after each company's chosen day,
-- bill LAST month's fees once. A failure (e.g. the vendor was archived) is
-- recorded on the company and retried the next day.
create or replace function public.run_scheduled_management_fees(p_today date default current_date)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  p record;
  v_month date := (date_trunc('month', p_today) - interval '1 month')::date;
  v_ids uuid[];
  n integer;
  n_companies integer := 0;
  n_bills integer := 0;
  n_failed integer := 0;
begin
  for p in
    select id, management_fee_vendor_id, management_fee_gl_account_id
      from public.portfolios
     where management_fee_auto_enabled and archived_at is null
       and extract(day from p_today)::int >= management_fee_auto_day
       and (management_fee_auto_last_month is null or management_fee_auto_last_month < v_month)
     order by id
  loop
    n_companies := n_companies + 1;
    begin
      select coalesce(array_agg(c.association_id), '{}') into v_ids
        from public.app_management_fee_calc(p.id, v_month) c;
      n := public.app_bill_management_fees(p.id, v_month, v_ids, p.management_fee_vendor_id,
             p.management_fee_gl_account_id, null, null, 'schedule');
      update public.portfolios
         set management_fee_auto_last_month = v_month,
             management_fee_auto_last_run = jsonb_build_object('month', v_month, 'ran_at', now(), 'bills', n)
       where id = p.id;
      n_bills := n_bills + n;
    exception when others then
      n_failed := n_failed + 1;
      update public.portfolios
         set management_fee_auto_last_run = jsonb_build_object('month', v_month, 'ran_at', now(), 'error', sqlerrm)
       where id = p.id;
    end;
  end loop;
  return jsonb_build_object('month', v_month, 'companies', n_companies, 'bills', n_bills, 'failed', n_failed);
end $$;

do $$
begin
  alter function public.app_management_fee_calc(uuid, date) owner to postgres;
  revoke all on function public.app_management_fee_calc(uuid, date) from public, anon, authenticated;
  grant execute on function public.app_management_fee_calc(uuid, date) to service_role;
  alter function public.app_bill_management_fees(uuid, date, uuid[], uuid, uuid, date, uuid, text) owner to postgres;
  revoke all on function public.app_bill_management_fees(uuid, date, uuid[], uuid, uuid, date, uuid, text) from public, anon, authenticated;
  grant execute on function public.app_bill_management_fees(uuid, date, uuid[], uuid, uuid, date, uuid, text) to service_role;
  alter function public.run_scheduled_management_fees(date) owner to postgres;
  revoke all on function public.run_scheduled_management_fees(date) from public, anon, authenticated;
  grant execute on function public.run_scheduled_management_fees(date) to service_role;
  alter function public.set_management_fee_schedule(boolean, integer, uuid, uuid) owner to postgres;
  revoke all on function public.set_management_fee_schedule(boolean, integer, uuid, uuid) from public, anon;
  grant execute on function public.set_management_fee_schedule(boolean, integer, uuid, uuid) to authenticated, service_role;
  alter function public.management_fee_preview(date) owner to postgres;
  revoke all on function public.management_fee_preview(date) from public, anon;
  grant execute on function public.management_fee_preview(date) to authenticated, service_role;
  alter function public.run_management_fees(date, uuid[], uuid, uuid, date) owner to postgres;
  revoke all on function public.run_management_fees(date, uuid[], uuid, uuid, date) from public, anon;
  grant execute on function public.run_management_fees(date, uuid[], uuid, uuid, date) to authenticated, service_role;
end $$;
