-- Atomic, audited accounting-period administration for the guided close UI.

drop policy if exists acct_periods_finance on public.accounting_periods;
create policy acct_periods_finance on public.accounting_periods
to authenticated
using (
  public.can_manage_finance(portfolio_id)
  or public.can_admin_portfolio(portfolio_id)
)
with check (
  public.can_manage_finance(portfolio_id)
  or public.can_admin_portfolio(portfolio_id)
);

create or replace function public.initialize_accounting_year(
  p_portfolio_id uuid,
  p_fiscal_year integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inserted_count integer;
begin
  if p_fiscal_year < 2000 or p_fiscal_year > 2100 then
    raise exception 'Fiscal year must be between 2000 and 2100';
  end if;
  if not (public.can_manage_finance(p_portfolio_id) or public.can_admin_portfolio(p_portfolio_id) or public.is_platform_operator()) then
    raise exception 'Not authorized to initialize accounting periods';
  end if;

  insert into public.accounting_periods (portfolio_id, fiscal_year, period_month)
  select p_portfolio_id, p_fiscal_year, month_number
  from generate_series(1, 12) as month_number
  on conflict (portfolio_id, fiscal_year, period_month) do nothing;
  get diagnostics inserted_count = row_count;

  insert into public.audit_logs (entity_type, entity_id, action, actor_id, changes)
  values (
    'accounting_year', p_portfolio_id, 'accounting_year_initialized', auth.uid(),
    jsonb_build_object('fiscal_year', p_fiscal_year, 'periods_created', inserted_count)
  );
  return inserted_count;
end;
$$;

create or replace function public.set_accounting_period_status(
  p_period_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  period_row public.accounting_periods;
  start_date date;
  next_date date;
  end_date date;
  unposted_count integer := 0;
  unreconciled_count integer := 0;
begin
  if p_status not in ('open', 'soft_closed', 'closed') then
    raise exception 'Invalid accounting period status';
  end if;

  select * into period_row
  from public.accounting_periods
  where id = p_period_id
  for update;
  if not found then raise exception 'Accounting period not found'; end if;
  if not (public.can_manage_finance(period_row.portfolio_id) or public.can_admin_portfolio(period_row.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Not authorized to manage this accounting period';
  end if;

  start_date := make_date(period_row.fiscal_year, period_row.period_month, 1);
  next_date := (start_date + interval '1 month')::date;
  end_date := next_date - 1;

  if p_status = 'closed' then
    select count(*) into unposted_count
    from public.journal_entries
    where portfolio_id = period_row.portfolio_id
      and entry_date >= start_date
      and entry_date < next_date
      and not posted;

    select count(*) into unreconciled_count
    from public.bank_accounts
    where portfolio_id = period_row.portfolio_id
      and archived_at is null
      and (last_reconciliation_date is null or last_reconciliation_date < end_date);

    if unposted_count > 0 then
      raise exception 'Post or remove % draft journal entries before closing this period', unposted_count;
    end if;
    if unreconciled_count > 0 then
      raise exception 'Reconcile % bank accounts through % before closing this period', unreconciled_count, end_date;
    end if;
  elsif period_row.status = 'closed' and p_status <> 'closed'
        and char_length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception 'A reopening reason of at least 10 characters is required';
  end if;

  update public.accounting_periods
  set status = p_status::public.period_status,
      closed_at = case when p_status = 'closed' then now() else closed_at end,
      closed_by = case when p_status = 'closed' then auth.uid() else closed_by end,
      reopened_at = case when period_row.status = 'closed' and p_status <> 'closed' then now() else reopened_at end,
      reopened_by = case when period_row.status = 'closed' and p_status <> 'closed' then auth.uid() else reopened_by end,
      notes = case when btrim(coalesce(p_note, '')) <> '' then btrim(p_note) else notes end
  where id = p_period_id;

  insert into public.audit_logs (entity_type, entity_id, action, actor_id, changes)
  values (
    'accounting_period', p_period_id, 'accounting_period_status_changed', auth.uid(),
    jsonb_build_object(
      'from', period_row.status,
      'to', p_status,
      'fiscal_year', period_row.fiscal_year,
      'period_month', period_row.period_month,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  return jsonb_build_object('success', true, 'status', p_status);
end;
$$;

revoke all on function public.initialize_accounting_year(uuid, integer) from public, anon;
grant execute on function public.initialize_accounting_year(uuid, integer) to authenticated, service_role;
revoke all on function public.set_accounting_period_status(uuid, text, text) from public, anon;
grant execute on function public.set_accounting_period_status(uuid, text, text) to authenticated, service_role;

comment on function public.set_accounting_period_status(uuid, text, text) is
  'Atomically validates, updates, and audits accounting-period state changes.';
