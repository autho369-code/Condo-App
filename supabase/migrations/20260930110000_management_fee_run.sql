-- Pay management fees (AppFolio "Pay Management Fees") + two broken policies.
--
-- BUG FIXES (RLS enabled but no permissive policy = every read/write denied):
--   * management_fee_policies: the association Management Fees form could
--     never save or show a policy.
--   * platform_requests: company admins could not submit support requests and
--     the platform operator could not see or answer them.
--
-- Fee run: for a month, each association's active fee policy is calculated —
--   per_door      amount × active units
--   flat_monthly  amount
--   percentage    amount % × assessments billed in the month
-- — and, for the associations staff select, an approved bill payable to the
-- management company is created and accrued (Dr management fee expense /
-- Cr A/P), ready for the check run. One fee per association per month
-- (management_fees unique), so re-running cannot double-bill.

-- ---------------------------------------------------------------- policies
drop policy if exists management_fee_policies_staff_read on public.management_fee_policies;
create policy management_fee_policies_staff_read on public.management_fee_policies
  for select to authenticated using (public.can_access_association(association_id));
drop policy if exists management_fee_policies_finance_write on public.management_fee_policies;
create policy management_fee_policies_finance_write on public.management_fee_policies
  for all to authenticated
  using (public.can_manage_finance((select a.portfolio_id from public.associations a where a.id = association_id)))
  with check (public.can_manage_finance((select a.portfolio_id from public.associations a where a.id = association_id)));
revoke all on public.management_fee_policies from anon;

alter table public.management_fee_policies drop constraint if exists management_fee_policies_type_check;
alter table public.management_fee_policies add constraint management_fee_policies_type_check
  check (fee_type in ('per_door', 'flat_monthly', 'percentage') and amount >= 0) not valid;

drop policy if exists platform_requests_read on public.platform_requests;
create policy platform_requests_read on public.platform_requests for select to authenticated
  using (public.is_platform_operator() or (public.is_company_admin() and portfolio_id = public.current_portfolio_id()));
drop policy if exists platform_requests_submit on public.platform_requests;
create policy platform_requests_submit on public.platform_requests for insert to authenticated
  with check (public.is_company_admin() and portfolio_id = public.current_portfolio_id()
              and submitted_by = auth.uid() and coalesce(status, 'open') = 'open'
              and platform_response is null and internal_notes is null and assigned_to is null);
drop policy if exists platform_requests_operator_update on public.platform_requests;
create policy platform_requests_operator_update on public.platform_requests for update to authenticated
  using (public.is_platform_operator()) with check (public.is_platform_operator());
revoke all on public.platform_requests from anon;

-- ---------------------------------------------------------------- fee run
alter table public.portfolios
  add column if not exists management_fee_vendor_id uuid references public.vendors(id) on delete set null,
  add column if not exists management_fee_gl_account_id uuid references public.gl_accounts(id) on delete set null;

alter table public.management_fees
  add column if not exists fee_type text,
  add column if not exists rate numeric,
  add column if not exists basis_cents bigint,
  add column if not exists bill_id uuid references public.payable_bills(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Preview: one row per association with the fee its policy produces for the month.
create or replace function public.management_fee_preview(p_month date)
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
  )
  select a.id, a.name, pol.fee_type, pol.amount,
         (select count(*)::int from public.units u join public.buildings b on b.id = u.building_id
           where b.association_id = a.id and u.archived_at is null) as doors,
         case pol.fee_type
           when 'percentage' then (select coalesce(sum(c.amount), 0) from public.charges c
                                    join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id, m
                                   where b.association_id = a.id and c.charge_type in ('assessment', 'special_assessment')
                                     and c.due_date between m.start_d and m.end_d)
           when 'per_door' then (select count(*) from public.units u join public.buildings b on b.id = u.building_id
                                  where b.association_id = a.id and u.archived_at is null)
           else null end as basis,
         round(case pol.fee_type
           when 'per_door' then pol.amount * (select count(*) from public.units u join public.buildings b on b.id = u.building_id
                                                where b.association_id = a.id and u.archived_at is null)
           when 'flat_monthly' then pol.amount
           when 'percentage' then pol.amount / 100.0 * (select coalesce(sum(c.amount), 0) from public.charges c
                                    join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id, m
                                   where b.association_id = a.id and c.charge_type in ('assessment', 'special_assessment')
                                     and c.due_date between m.start_d and m.end_d)
         end, 2) as fee,
         mf.bill_id is not null as already_billed,
         mf.bill_id
    from public.associations a
    join pol on pol.association_id = a.id
    cross join m
    left join public.management_fees mf on mf.association_id = a.id and mf.month = m.start_d
   where a.archived_at is null
     and a.portfolio_id = public.current_portfolio_id()
     and public.can_manage_finance(a.portfolio_id)
     and public.can_access_association(a.id)
   order by a.name;
$$;

create or replace function public.run_management_fees(
  p_month date, p_association_ids uuid[], p_vendor_id uuid, p_gl_account_id uuid, p_bill_date date default null)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_month date := date_trunc('month', p_month)::date;
  v_bill_date date := coalesce(p_bill_date, (date_trunc('month', p_month) + interval '1 month - 1 day')::date);
  r record;
  v_bill uuid;
  n integer := 0;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if coalesce(cardinality(p_association_ids), 0) = 0 then raise exception 'Select at least one association' using errcode = '22023'; end if;
  if not exists (select 1 from public.vendors v where v.id = p_vendor_id and v.portfolio_id = v_pid and v.archived_at is null) then
    raise exception 'Choose the management company vendor' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and g.active
                   and g.association_id is null and g.account_type::text in ('expense', 'other_expense')) then
    raise exception 'Choose a company-wide expense account for management fees' using errcode = '22023';
  end if;

  -- Remember the choices for next month.
  update public.portfolios set management_fee_vendor_id = p_vendor_id, management_fee_gl_account_id = p_gl_account_id
   where id = v_pid;

  for r in
    select * from public.management_fee_preview(v_month) pv
     where pv.association_id = any (p_association_ids) and not pv.already_billed and pv.fee > 0
  loop
    insert into public.payable_bills (portfolio_id, vendor_id, association_id, gl_account_id, bill_number, bill_date, due_date,
                                      amount, memo, status, approval_required, approved_at, approved_by, created_by)
    values (v_pid, p_vendor_id, r.association_id, p_gl_account_id,
            'MGMT-' || to_char(v_month, 'YYYY-MM'), v_bill_date, v_bill_date, r.fee,
            'Management fee — ' || to_char(v_month, 'FMMonth YYYY') || ' (' ||
              case r.fee_type when 'per_door' then r.door_count || ' units × ' || to_char(r.rate, 'FM$999,990.00')
                              when 'flat_monthly' then 'flat monthly'
                              else r.rate || '% of ' || to_char(r.basis, 'FM$999,999,990.00') || ' assessments' end || ')',
            'approved', false, now(), auth.uid(), auth.uid())
    returning id into v_bill;
    perform public.ensure_payable_bill_accrual(v_bill);

    insert into public.management_fees (portfolio_id, association_id, month, fee_amount_cents, door_count,
                                        avg_per_door_cents, fee_type, rate, basis_cents, bill_id, created_by)
    values (v_pid, r.association_id, v_month, round(r.fee * 100)::int, r.door_count,
            case when r.door_count > 0 then round(r.fee * 100 / r.door_count)::int end,
            r.fee_type, r.rate, round(coalesce(r.basis, 0) * 100)::bigint, v_bill, auth.uid())
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
  values (v_pid, 'management_fees', null, 'management_fees_billed', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('month', v_month, 'bills', n, 'associations', to_jsonb(p_association_ids)));
  return n;
end $$;

do $$
begin
  alter function public.management_fee_preview(date) owner to postgres;
  revoke all on function public.management_fee_preview(date) from public, anon;
  grant execute on function public.management_fee_preview(date) to authenticated, service_role;
  alter function public.run_management_fees(date, uuid[], uuid, uuid, date) owner to postgres;
  revoke all on function public.run_management_fees(date, uuid[], uuid, uuid, date) from public, anon;
  grant execute on function public.run_management_fees(date, uuid[], uuid, uuid, date) to authenticated, service_role;
end $$;
