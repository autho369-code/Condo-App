-- Establish an explicit execution boundary for public-schema SECURITY DEFINER
-- functions.  PostgreSQL grants EXECUTE to PUBLIC by default; without an
-- explicit revoke, both Supabase's anon and authenticated roles inherit it.
--
-- The application audit found exactly one intentional unauthenticated RPC:
-- tenant_branding(text, text).  Elevated report and maintenance functions run
-- only through server-side service clients after an authenticated scope check.

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Budget rows must not reference a GL account from another tenant.
-- ---------------------------------------------------------------------------

create or replace function public.can_read_association_budget(p_association_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.associations a
      where a.id = p_association_id
        and (
          public.is_platform_operator()
          or (
            (public.is_any_staff() or public.is_company_admin())
            and public.can_access_portfolio(a.portfolio_id)
            and public.can_access_association(a.id)
          )
          or (
            public.is_board_user()
            and a.id in (select public.current_board_association_ids())
          )
        )
    );
$$;

create or replace function public.can_mutate_association_budget(p_association_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.associations a
      where a.id = p_association_id
        and (
          public.is_platform_operator()
          or (
            public.can_manage_finance(a.portfolio_id)
            and public.can_access_association(a.id)
          )
        )
    );
$$;

create or replace function public.budget_gl_account_scope_valid(
  p_association_id uuid,
  p_gl_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.associations a
    join public.gl_accounts ga
      on ga.id = p_gl_account_id
     and ga.portfolio_id = a.portfolio_id
     and (ga.association_id is null or ga.association_id = a.id)
    where a.id = p_association_id
  );
$$;

alter policy budget_lines_scoped_read on public.budget_lines
  using (
    public.can_read_association_budget(association_id)
    and public.budget_gl_account_scope_valid(association_id, gl_account_id)
  );

alter policy budget_lines_finance_insert on public.budget_lines
  with check (
    public.can_mutate_association_budget(association_id)
    and public.budget_gl_account_scope_valid(association_id, gl_account_id)
  );

alter policy budget_lines_finance_update on public.budget_lines
  using (
    public.can_mutate_association_budget(association_id)
    and public.budget_gl_account_scope_valid(association_id, gl_account_id)
  )
  with check (
    public.can_mutate_association_budget(association_id)
    and public.budget_gl_account_scope_valid(association_id, gl_account_id)
  );

alter policy budget_lines_finance_delete on public.budget_lines
  using (
    public.can_mutate_association_budget(association_id)
    and public.budget_gl_account_scope_valid(association_id, gl_account_id)
  );

-- ---------------------------------------------------------------------------
-- Meetings must agree with the portfolio of their association.
-- ---------------------------------------------------------------------------

create or replace function public.meeting_tenant_scope_valid(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.meetings m
    join public.associations a
      on a.id = m.association_id
     and a.portfolio_id = m.portfolio_id
    where m.id = p_meeting_id
  );
$$;

create or replace function public.can_access_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.meetings m
      join public.associations a
        on a.id = m.association_id
       and a.portfolio_id = m.portfolio_id
      where m.id = p_meeting_id
        and (
          public.is_platform_operator()
          or (
            (public.is_any_staff() or public.is_company_admin())
            and public.can_access_portfolio(a.portfolio_id)
            and public.can_access_association(a.id)
          )
          or (
            public.is_board_user()
            and a.id in (select public.current_board_association_ids())
          )
          or (
            public.is_portal_resident()
            and a.id in (select public.current_resident_association_ids())
          )
        )
    );
$$;

create or replace function public.validate_meeting_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  if not exists (
    select 1
    from public.associations a
    where a.id = new.association_id
      and a.portfolio_id = new.portfolio_id
  ) then
    raise exception 'Meeting tenant scope is invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_meeting_tenant_scope on public.meetings;
create trigger trg_validate_meeting_tenant_scope
before insert or update
on public.meetings
for each row execute function public.validate_meeting_tenant_scope();

create or replace function public.validate_meeting_attendee_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_association_id uuid;
begin
  select m.association_id
  into v_association_id
  from public.meetings m
  join public.associations a
    on a.id = m.association_id
   and a.portfolio_id = m.portfolio_id
  where m.id = new.meeting_id;

  if v_association_id is null then
    raise exception 'Meeting tenant scope is invalid' using errcode = '23514';
  end if;
  if length(trim(new.attendee_name)) not between 1 and 200
     or length(coalesce(new.notes, '')) > 2000
     or octet_length(coalesce(new.signature_data, '')) > 1048576
     or new.attendee_role is null
     or new.attendee_role not in ('board_member', 'owner', 'manager', 'guest') then
    raise exception 'Invalid meeting attendance input' using errcode = '22023';
  end if;
  if new.owner_id is not null
     and not exists (
       select 1
       from public.occupancies o
       where o.owner_id = new.owner_id
         and o.association_id = v_association_id
     ) then
    raise exception 'Owner is outside the meeting association' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Keep the hardened implementations from the preceding migration, but place a
-- tenant-integrity precondition in front of both public RPC entry points.
alter function public.calculate_meeting_quorum(uuid)
  rename to calculate_meeting_quorum_tenant_checked_impl;

create function public.calculate_meeting_quorum(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  if not public.meeting_tenant_scope_valid(p_meeting_id)
     or not public.can_access_meeting(p_meeting_id) then
    raise exception 'Meeting not found or access denied' using errcode = '42501';
  end if;
  return public.calculate_meeting_quorum_tenant_checked_impl(p_meeting_id);
end;
$$;

alter function public.record_meeting_attendance(
  uuid, text, uuid, text, text, boolean, text
) rename to record_meeting_attendance_tenant_checked_impl;

create function public.record_meeting_attendance(
  p_meeting_id uuid,
  p_attendee_name text,
  p_owner_id uuid default null,
  p_attendee_role text default 'owner',
  p_signature_data text default null,
  p_voting_eligible boolean default true,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  if not public.meeting_tenant_scope_valid(p_meeting_id)
     or not public.can_access_meeting(p_meeting_id) then
    raise exception 'Meeting not found or access denied' using errcode = '42501';
  end if;
  return public.record_meeting_attendance_tenant_checked_impl(
    p_meeting_id,
    p_attendee_name,
    p_owner_id,
    p_attendee_role,
    p_signature_data,
    p_voting_eligible,
    p_notes
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Board-packet financials: exact association authorization and valid columns.
-- The legacy implementation had no authorization check and referenced the
-- removed charges.paid column.
-- ---------------------------------------------------------------------------

create or replace function public.get_meeting_financial_snapshot(
  p_association_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_total_receivables numeric := 0;
  v_total_payables numeric := 0;
  v_delinquency_count integer := 0;
  v_bank_balance numeric := 0;
  v_current_month_income numeric := 0;
  v_current_month_expenses numeric := 0;
begin
  if auth.uid() is null or p_association_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association' using errcode = '42501';
  end if;

  select coalesce(sum(greatest(coalesce(ub.balance, 0), 0)), 0)
  into v_total_receivables
  from public.unit_balances ub
  where ub.association_id = p_association_id;

  select coalesce(sum(pb.amount), 0)
  into v_total_payables
  from public.payable_bills pb
  where pb.association_id = p_association_id
    and pb.archived_at is null
    and pb.status not in ('paid', 'void');

  select count(distinct o.unit_id)::integer
  into v_delinquency_count
  from public.occupancies o
  join public.units u on u.id = o.unit_id
  join public.buildings b on b.id = u.building_id
  where b.association_id = p_association_id
    and o.status = 'current'
    and o.dues_paid_through < date_trunc('month', pg_catalog.now())::date;

  select coalesce(sum(jl.debit_amount - jl.credit_amount), 0)
  into v_bank_balance
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  where je.posted
    and exists (
      select 1
      from public.bank_accounts ba
      join public.associations a
        on a.id = ba.association_id
       and a.portfolio_id = ba.portfolio_id
      where ba.association_id = p_association_id
        and ba.archived_at is null
        and ba.gl_account_id = jl.gl_account_id
        and je.portfolio_id = a.portfolio_id
    );

  select coalesce(sum(c.amount), 0)
  into v_current_month_income
  from public.charges c
  join public.units u on u.id = c.unit_id
  join public.buildings b on b.id = u.building_id
  where b.association_id = p_association_id
    and c.created_at >= date_trunc('month', pg_catalog.now());

  select coalesce(sum(pb.amount), 0)
  into v_current_month_expenses
  from public.payable_bills pb
  where pb.association_id = p_association_id
    and pb.archived_at is null
    and pb.occurred_on >= date_trunc('month', pg_catalog.now())::date
    and pb.status in ('paid', 'approved');

  return jsonb_build_object(
    'total_receivables', v_total_receivables,
    'total_payables', v_total_payables,
    'delinquency_count', v_delinquency_count,
    'bank_balance', v_bank_balance,
    'current_month_income', v_current_month_income,
    'current_month_expenses', v_current_month_expenses,
    'net_income', v_current_month_income - v_current_month_expenses,
    'generated_at', pg_catalog.now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Agenda ordering: replace the unusable integer overload with the UUID shape
-- used by both the live tables and application, and authorize the meeting.
-- ---------------------------------------------------------------------------

drop function if exists public.reorder_agenda_items(integer, integer[]);

create or replace function public.reorder_agenda_items(
  p_meeting_id uuid,
  p_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_portfolio_id uuid;
  v_association_id uuid;
  v_item_count integer;
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_meeting_id is null
     or p_item_ids is null
     or cardinality(p_item_ids) not between 1 and 500
     or exists (select 1 from unnest(p_item_ids) as item(item_id) where item.item_id is null)
     or (select count(distinct item.item_id) from unnest(p_item_ids) as item(item_id))
        <> cardinality(p_item_ids) then
    raise exception 'Invalid agenda ordering input' using errcode = '22023';
  end if;

  select m.portfolio_id, m.association_id
  into v_portfolio_id, v_association_id
  from public.meetings m
  join public.associations a
    on a.id = m.association_id
   and a.portfolio_id = m.portfolio_id
  where m.id = p_meeting_id;

  if not found then
    raise exception 'Meeting not found or tenant scope is invalid' using errcode = 'P0002';
  end if;
  if not (
    coalesce(public.is_platform_operator(), false)
    or (
      (coalesce(public.is_any_staff(), false) or coalesce(public.is_company_admin(), false))
      and coalesce(public.can_access_portfolio(v_portfolio_id), false)
      and coalesce(public.can_access_association(v_association_id), false)
    )
  ) then
    raise exception 'Staff authorization required' using errcode = '42501';
  end if;

  perform 1
  from public.agenda_items ai
  where ai.meeting_id = p_meeting_id
    and ai.id = any (p_item_ids)
  for update;

  select count(*)::integer
  into v_item_count
  from public.agenda_items ai
  where ai.meeting_id = p_meeting_id
    and ai.id = any (p_item_ids);

  if v_item_count <> cardinality(p_item_ids) then
    raise exception 'Agenda item is outside the meeting scope' using errcode = '23514';
  end if;

  update public.agenda_items ai
  set sort_order = (ordered.ordinal - 1)::integer,
      updated_at = pg_catalog.now()
  from unnest(p_item_ids) with ordinality as ordered(item_id, ordinal)
  where ai.id = ordered.item_id
    and ai.meeting_id = p_meeting_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> cardinality(p_item_ids) then
    raise exception 'Agenda ordering changed concurrently' using errcode = '40001';
  end if;
end;
$$;

-- The new application-facing functions were created after the default PUBLIC
-- grant was disabled, so make their authenticated contract explicit.
grant execute on function public.budget_gl_account_scope_valid(uuid, uuid) to authenticated;
grant execute on function public.calculate_meeting_quorum(uuid) to authenticated;
grant execute on function public.record_meeting_attendance(
  uuid, text, uuid, text, text, boolean, text
) to authenticated;
grant execute on function public.get_meeting_financial_snapshot(uuid) to authenticated;
grant execute on function public.reorder_agenda_items(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Existing SECURITY DEFINER ACL normalization.
--
-- Preserve an existing authenticated contract unless the function is proven
-- internal below.  This avoids breaking user-facing RPCs while removing the
-- implicit PUBLIC grant.  All internal and trigger functions become callable
-- only by service_role (or their owning role / trigger machinery).
-- ---------------------------------------------------------------------------

do $$
declare
  v_function record;
  v_service_only_names constant text[] := array[
    'aggregate_usage_metrics',
    'alert_overdue_bills',
    'anonymize_owner',
    'apply_late_fees',
    'apply_payment',
    'assemble_vendor_1099_data',
    'assess_late_fee',
    'bootstrap_platform_admin',
    'bulk_update_statement_settings',
    'calculate_meeting_quorum_tenant_checked_impl',
    'check_insurance_expirations',
    'claim_stripe_autopay_run',
    'claim_stripe_webhook_event',
    'confirm_owner_invitation',
    'consume_api_rate_limit',
    'enqueue_scheduled_reports',
    'ensure_operating_and_reserve_accounts',
    'finalize_stripe_autopay_run',
    'generate_monthly_statements',
    'generate_recurring_bills',
    'generate_recurring_journal_entries',
    'generate_recurring_work_orders',
    'invoke_edge_function',
    'mark_webhook_delivery',
    'meeting_tenant_scope_valid',
    'platform_create_company',
    'post_nsf_fee',
    'post_stripe_ledger_payment',
    'post_unit_recurring_charges',
    'queue_calendar_sms',
    'queue_invitation_email',
    'queue_payment_reminders',
    'recent_failed_attempts',
    'receptionist_knowledge_search',
    'record_login_attempt',
    'record_meeting_attendance_tenant_checked_impl',
    'relink_all_portal_users',
    'render_invitation_email',
    'run_autopay_mandates',
    'scan_data_diagnostics',
    'scan_financial_diagnostics',
    'setup_edge_function_secrets',
    'stage_owner_activation',
    'stage_owner_form',
    'verify_api_key'
  ];
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog, public', true);

  for v_function in
    select p.oid,
           p.oid::regprocedure as identity,
           p.proname,
           p.prorettype,
           pg_catalog.has_function_privilege(
             'authenticated', p.oid, 'EXECUTE'
           ) as authenticated_before
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated',
      v_function.identity
    );
    execute pg_catalog.format(
      'grant execute on function %s to service_role',
      v_function.identity
    );

    if v_function.proname = 'tenant_branding' then
      execute pg_catalog.format(
        'grant execute on function %s to anon, authenticated',
        v_function.identity
      );
    elsif v_function.prorettype in (
            'pg_catalog.trigger'::pg_catalog.regtype,
            'pg_catalog.event_trigger'::pg_catalog.regtype
          )
       or v_function.proname = any (v_service_only_names)
       or pg_catalog.left(v_function.proname, 5) = 'auto_'
       or pg_catalog.left(v_function.proname, 9) = 'dispatch_'
       or pg_catalog.left(v_function.proname, 6) = 'guard_'
       or pg_catalog.left(v_function.proname, 4) = 'log_'
       or pg_catalog.left(v_function.proname, 12) = 'report_data_'
       or pg_catalog.left(v_function.proname, 5) = 'sync_'
       or pg_catalog.left(v_function.proname, 4) = 'trg_' then
      null;
    elsif v_function.authenticated_before then
      execute pg_catalog.format(
        'grant execute on function %s to authenticated',
        v_function.identity
      );
    end if;
  end loop;
end;
$$;
