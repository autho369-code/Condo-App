-- Reports, scheduled reports: deep-check fixes.
--
-- 1. User and sign-in reports (users, users_and_permissions,
--    user_roles_permissions, login_audit) are limited to company admins and
--    full-access staff (President / Property Manager / no role), the same
--    people who can read login_attempts and manage users. Any unscoped staff
--    member (Leasing Agent, On-Site Manager, Accounts Payable...) could run
--    them. The two permission reports list staff accounts only, not owner,
--    board or vendor portal logins.
-- 2. Scheduled report emails go only to active staff of the company who can
--    see the report themselves (association scope, finance-only reports):
--    checked when a schedule is saved (guard trigger) and again for every
--    delivery (scheduled_report_delivery_recipients), so someone who left
--    or lost access stops receiving it. Any address could be entered before.
-- 3. A schedule whose run-as user lost access is paused when it comes due,
--    with one failed run explaining why, instead of failing every period.
--    Saving the schedule or resuming it makes it run as the person who did,
--    after their access and the recipients are checked again.
-- 4. Report "as of" defaults use the association's local date (the
--    schedule's zone for company-wide runs), not UTC: rpt_prm, insurance
--    expiration dates, owner insurance audit, open work order age.
-- 5. Fund balance sheets tie out per fund: the active-funds summary now
--    counts each fund's accumulated surplus in equity, and both fund
--    reports show the interfund balance (due to / from other funds) that
--    makes each fund's assets equal its liabilities plus equity.
-- 6. Runs saved with a time-limited storage link now point at the app's
--    sign-in download route (no schedules existed, so none were emailed).
--
-- Every replaced function body is the live definition (pg_get_functiondef,
-- 2026-10-14) with only the changes above. Additive: no DROP, no DELETE; one UPDATE (6).

-- 1. report_params_access_error ------------------------------------------------
create or replace function public.report_params_access_error(p_portfolio_id uuid, p_slug text, p_params jsonb)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_assoc uuid;
  v_unit uuid;
  v_unit_assoc uuid;
  v_slug text := coalesce(p_slug, '');
begin
  begin
    v_assoc := nullif(p_params ->> 'association_id', '')::uuid;
    v_unit := nullif(p_params ->> 'unit_id', '')::uuid;
  exception when invalid_text_representation then
    return 'The selected association or unit is not valid.';
  end;

  if not public.can_access_portfolio(p_portfolio_id) then
    return 'You no longer have access to this company.';
  end if;
  if v_slug ~ '(1099|_tax_|^corporate_|^customer_ledger$)' and not public.can_manage_finance(p_portfolio_id) then
    return 'Tax and corporate accounting reports are limited to finance staff.';
  end if;
  -- People data: who works here, their roles and every sign-in attempt.
  if v_slug in ('users', 'users_and_permissions', 'user_roles_permissions', 'login_audit')
     and not (public.is_full_access_staff() or public.is_company_admin() or public.is_platform_operator()) then
    return 'User and sign-in reports are limited to company admins and full-access staff.';
  end if;
  if v_slug in ('association_log', 'email_delivery_errors', 'survey_results', 'users', 'users_and_permissions', 'data_diagnostics_summary', 'login_audit',
                'user_roles_permissions', 'vendor_directory', 'inventory_status', 'property_group_directory')
     and public.manager_is_scoped() then
    return 'This company-wide report is limited to staff with access to every association.';
  end if;
  if v_assoc is not null and not exists (
       select 1 from public.associations a
        where a.id = v_assoc and a.portfolio_id = p_portfolio_id and public.can_view_association_row(a.id)) then
    return 'You cannot access the selected association.';
  end if;
  if v_assoc is null and public.manager_is_scoped() then
    return 'Choose one of your associations for this report.';
  end if;
  if nullif(p_params ->> 'owner_id', '') is not null then
    return 'This report cannot be filtered by homeowner. Choose an association instead.';
  end if;
  if v_unit is not null then
    if v_slug not in ('owner_ledger', 'homeowner_ledger', 'homeowner_resale') then
      return 'This report cannot be filtered by unit. Choose an association instead.';
    end if;
    select b.association_id into v_unit_assoc
      from public.units u join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = v_unit and a.portfolio_id = p_portfolio_id;
    if v_unit_assoc is null or not public.can_view_association_row(v_unit_assoc) then
      return 'You cannot access the selected unit.';
    end if;
    if v_assoc is not null and v_unit_assoc <> v_assoc then
      return 'The selected unit is not in the selected association.';
    end if;
  end if;
  return null;
end $function$;

-- 1. Permission reports list staff accounts only --------------------------------
create or replace function public.report_data_users_and_permissions(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.full_name, p.email, p.hoa_role::text as role, p.mvp_role::text as company_role, p.last_login_at, p.mfa_enrolled_at is not null as mfa_enrolled, p.disabled_at is not null as disabled
      from public.profiles p
     where p.portfolio_id = p_portfolio_id
       and p.hoa_role::text in ('manager', 'company_admin')
     order by p.full_name
  ) r
  ) s(x) limit 1);
end$function$;

create or replace function public.report_data_user_roles_permissions(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select p.full_name, p.email, p.hoa_role::text as role, p.mvp_role::text as company_role, p.last_login_at, p.mfa_enrolled_at is not null as mfa_enrolled, p.disabled_at is not null as disabled
      from public.profiles p
     where p.portfolio_id = p_portfolio_id
       and p.hoa_role::text in ('manager', 'company_admin')
     order by p.full_name
  ) r
  ) s(x) limit 1);
end$function$;

-- 2 + 3. Evaluate a report's access rule as another user -------------------------
-- Same claim switch as report_run_access_error; the caller's claims are put
-- back before returning. Service-only.
create or replace function public.report_access_error_as(p_user_id uuid, p_portfolio_id uuid, p_slug text, p_params jsonb)
 returns text
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_error text;
begin
  if p_user_id is null then return 'This schedule has no user to run as.'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  v_error := public.report_params_access_error(p_portfolio_id, p_slug, coalesce(p_params, '{}'::jsonb));
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return v_error;
end $function$;

revoke all on function public.report_access_error_as(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.report_access_error_as(uuid, uuid, text, jsonb) to service_role;

-- 2. Which of a schedule's recipients may receive a report ----------------------
-- A recipient is an active staff member (manager or company admin) of the
-- company whose own access passes the report's rule. One row per distinct
-- address; error is null for an allowed recipient. Service-only.
create or replace function public.report_allowed_recipients(p_portfolio_id uuid, p_slug text, p_params jsonb, p_targets jsonb)
 returns table(email text, full_name text, error text)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
declare
  v_target text;
  v_profile_id uuid;
  v_profile_name text;
  v_error text;
begin
  if p_targets is null or jsonb_typeof(p_targets) <> 'array' then return; end if;
  for v_target in
    select distinct lower(btrim(t.value)) from jsonb_array_elements_text(p_targets) t where btrim(t.value) <> ''
  loop
    select p.id, p.full_name into v_profile_id, v_profile_name
      from public.profiles p
     where lower(p.email) = v_target
       and p.portfolio_id = p_portfolio_id
       and p.disabled_at is null
       and p.hoa_role::text in ('manager', 'company_admin')
     order by p.created_at, p.id
     limit 1;
    if not found then
      email := v_target; full_name := null;
      error := format('%s is not an active user of this company. Scheduled reports are emailed only to your company''s staff.', v_target);
      return next;
      continue;
    end if;
    v_error := public.report_access_error_as(v_profile_id, p_portfolio_id, p_slug, p_params);
    email := v_target; full_name := v_profile_name;
    error := case when v_error is null then null else format('%s is not allowed to receive this report.', v_target) end;
    return next;
  end loop;
end $function$;

revoke all on function public.report_allowed_recipients(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.report_allowed_recipients(uuid, text, jsonb, jsonb) to service_role;

-- 2. Recipient check used when a schedule is saved (guard trigger) --------------
create or replace function public.report_recipients_error(p_portfolio_id uuid, p_slug text, p_params jsonb, p_targets jsonb)
 returns text
 language plpgsql
 volatile security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_error text;
  v_count integer := 0;
begin
  if not public.can_access_portfolio(p_portfolio_id) then
    return 'You no longer have access to this company.';
  end if;
  if p_targets is not null and jsonb_typeof(p_targets) = 'array' then
    select count(distinct lower(btrim(t.value))) into v_count
      from jsonb_array_elements_text(p_targets) t where btrim(t.value) <> '';
  end if;
  if v_count = 0 then
    return 'Add at least one recipient for email delivery.';
  end if;
  if v_count > 25 then
    return 'Add at most 25 recipients.';
  end if;
  select r.error into v_error
    from public.report_allowed_recipients(p_portfolio_id, p_slug, p_params, p_targets) r
   where r.error is not null
   limit 1;
  return v_error;
end $function$;

revoke all on function public.report_recipients_error(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.report_recipients_error(uuid, text, jsonb, jsonb) to authenticated, service_role;

-- 2. Recipients for one finished scheduled run (the delivery worker) ------------
create or replace function public.scheduled_report_delivery_recipients(p_run_id uuid)
 returns table(email text, full_name text)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v record;
begin
  select r.portfolio_id, r.parameters, r.status::text as status, d.slug, s.delivery_channel::text as channel, s.delivery_targets
    into v
    from public.report_runs r
    join public.scheduled_reports s on s.id = r.scheduled_report_id
    left join public.report_definitions d on d.id = r.definition_id
   where r.id = p_run_id;
  if not found or v.status <> 'succeeded' or v.channel <> 'email' then return; end if;
  return query
    select a.email, a.full_name
      from public.report_allowed_recipients(v.portfolio_id, v.slug, coalesce(v.parameters, '{}'::jsonb), v.delivery_targets) a
     where a.error is null;
end $function$;

revoke all on function public.scheduled_report_delivery_recipients(uuid) from public, anon, authenticated;
grant execute on function public.scheduled_report_delivery_recipients(uuid) to service_role;

-- 2. guard_scheduled_report_change: recipients checked on save -------------------
-- Saving the edit form (report, filters, recipients, format, name, timing)
-- or resuming a paused schedule makes it run as the person saving, after
-- their access and the recipients are checked again. Pausing, deleting and
-- "Run now" (which only moves next_run_at) keep the run-as user.
create or replace function public.guard_scheduled_report_change()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_slug text;
  v_error text;
  v_takeover boolean := false;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if auth.uid() is null then raise exception 'Sign in to change scheduled reports.' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.run_as := auth.uid();
    v_takeover := true;
  else
    new.created_by := old.created_by;
    new.portfolio_id := old.portfolio_id;
    v_takeover :=
      (new.definition_id, new.saved_report_id, new.parameters, new.delivery_targets, new.delivery_channel, new.output_format)
        is distinct from (old.definition_id, old.saved_report_id, old.parameters, old.delivery_targets, old.delivery_channel, old.output_format)
      or (new.name, new.frequency, new.day_of_week, new.day_of_month, new.local_hour, new.hour_utc, new.time_zone)
        is distinct from (old.name, old.frequency, old.day_of_week, old.day_of_month, old.local_hour, old.hour_utc, old.time_zone)
      or (old.active is not true and new.active is true);
    if v_takeover then
      new.run_as := auth.uid();
    else
      new.run_as := old.run_as;
    end if;
  end if;

  if v_takeover then
    if new.saved_report_id is not null and not exists (
         select 1 from public.saved_reports s where s.id = new.saved_report_id and s.portfolio_id = new.portfolio_id) then
      raise exception 'That custom report was not found.' using errcode = 'P0002';
    end if;
    select d.slug into v_slug from public.report_definitions d where d.id = new.definition_id and d.active;
    if v_slug is null then raise exception 'That report is not available.' using errcode = 'P0002'; end if;
    v_error := public.report_params_access_error(new.portfolio_id, v_slug, coalesce(new.parameters, '{}'::jsonb));
    if v_error is not null then raise exception '%', v_error using errcode = '42501'; end if;

    -- Emailed reports go only to the company's own staff who can see the report.
    if new.delivery_channel::text = 'email' then
      v_error := public.report_recipients_error(new.portfolio_id, v_slug, coalesce(new.parameters, '{}'::jsonb), new.delivery_targets);
      if v_error is not null then raise exception '%', v_error using errcode = '42501'; end if;
    end if;
  end if;
  return new;
end $function$;

-- 3. enqueue_scheduled_reports: pause a schedule whose run-as user lost access --
create or replace function public.enqueue_scheduled_reports()
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  row record;
  n integer := 0;
  v_run_as uuid;
  v_error text;
begin
  for row in
    select s.*, d.slug as report_slug
      from public.scheduled_reports s
      left join public.report_definitions d on d.id = s.definition_id
     where s.active and s.archived_at is null
       and (s.next_run_at is null or s.next_run_at <= now())
  loop
    v_run_as := coalesce(row.run_as, row.created_by);
    -- One schedule's failed check pauses that schedule, not the whole run.
    begin
      v_error := public.report_access_error_as(v_run_as, row.portfolio_id, row.report_slug, coalesce(row.parameters, '{}'::jsonb));
    exception when others then
      v_error := 'The access check for this report could not be completed.';
    end;
    if v_error is not null then
      -- One failed run says why; the schedule stops until someone with access
      -- saves or resumes it (which makes it run with their access).
      insert into public.report_runs (
        portfolio_id, definition_id, saved_report_id, scheduled_report_id,
        status, parameters, output_format, triggered_by, started_at, finished_at, error_message
      ) values (
        row.portfolio_id, row.definition_id, row.saved_report_id, row.id,
        'failed', row.parameters, row.output_format, v_run_as, now(), now(),
        'Schedule paused: ' || v_error || ' Someone who can see this report can resume the schedule; it then runs with their access.'
      );
      update public.scheduled_reports
         set active = false, last_run_at = now(), updated_at = now()
       where id = row.id;
      continue;
    end if;

    insert into public.report_runs (
      portfolio_id, definition_id, saved_report_id, scheduled_report_id,
      status, parameters, output_format, triggered_by
    ) values (
      row.portfolio_id, row.definition_id, row.saved_report_id, row.id,
      'queued', row.parameters, row.output_format, v_run_as
    );

    update public.scheduled_reports
       set next_run_at = public.scheduled_report_next_run(
             row.frequency, row.day_of_week, row.day_of_month,
             coalesce(row.local_hour, row.hour_utc),
             case when row.local_hour is null then 'UTC' else row.time_zone end,
             case when row.frequency = 'biweekly' then now() + interval '7 days' else now() end),
           last_run_at = now(),
           updated_at = now()
     where id = row.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

-- 4. rpt_prm: "today" is the association's local date ---------------------------
-- Company-wide runs use the schedule's zone when the run carries one, else
-- association_local_date's default zone. The default start is January 1 of
-- the as-of year (it was January 1 of the current UTC year, after the end
-- date for a past as-of date).
create or replace function public.rpt_prm(p_params jsonb)
 returns table(aid uuid, df date, dt date, cmp date)
 language plpgsql
 stable
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_today date;
  v_zone text := nullif(p_params ->> 'time_zone', '');
begin
  aid := nullif(p_params ->> 'association_id', '')::uuid;
  if aid is null and v_zone is not null then
    begin
      v_today := (now() at time zone v_zone)::date;
    exception when others then
      v_today := null;
    end;
  end if;
  v_today := coalesce(v_today, public.association_local_date(aid));
  dt := coalesce(nullif(p_params ->> 'date_to', '')::date, v_today);
  df := coalesce(nullif(p_params ->> 'date_from', '')::date, date_trunc('year', dt)::date);
  cmp := coalesce(nullif(p_params ->> 'compare_to', '')::date, (dt - interval '1 year')::date);
  return next;
end $function$;

-- 4. Local dates in insurance and work order reports -----------------------------
create or replace function public.report_data_insurance_expiration_dates(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*) - 'local_today'), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    assoc as materialized (
      select a.id, a.name, public.association_local_date(a.id) as local_today
        from public.associations a cross join prm
       where a.portfolio_id = p_portfolio_id and (prm.aid is null or a.id = prm.aid)
    )
    select a.name as association, o.full_name as owner, ip.insurance_company, ip.policy_number, ip.effective_date, ip.expiration_date,
             (ip.expiration_date - a.local_today) as days_until_expiration, ip.status, a.local_today
      from public.insurance_policies ip
      join assoc a on a.id = ip.association_id
      left join public.owners o on o.id = ip.owner_id
      where ip.archived_at is null
        and ip.expiration_date <= a.local_today + coalesce(nullif(p_params->>'days','')::int, 90)
      order by ip.expiration_date
  ) r
  ) s(x) limit 1);
end$function$;

create or replace function public.report_data_owner_insurance_audit(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    assoc as materialized (
      select a.id, a.name, public.association_local_date(a.id) as local_today
        from public.associations a cross join prm
       where a.portfolio_id = p_portfolio_id and (prm.aid is null or a.id = prm.aid)
    )
    select a.name as association, u.unit_number, o.full_name as homeowner,
             max(ip.expiration_date) as latest_expiration,
             case when max(ip.expiration_date) is null then 'No policy on file'
                  when max(ip.expiration_date) < a.local_today then 'Expired'
                  when max(ip.expiration_date) < a.local_today + 30 then 'Expiring within 30 days' else 'Current' end as insurance_status
      from public.units u
      join public.buildings b on b.id = u.building_id
      join assoc a on a.id = b.association_id
      left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
      left join public.owners o on o.id = occ.owner_id
      left join public.insurance_policies ip on ip.owner_id = o.id and ip.association_id = a.id and ip.archived_at is null
      where u.archived_at is null and o.id is not null
      group by a.id, a.name, a.local_today, u.id, o.id
      order by insurance_status, a.name, u.unit_number
  ) r
  ) s(x) limit 1);
end$function$;

create or replace function public.report_data_open_work_orders(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.priority desc, r.created_at), '[]'::jsonb)
  from (
    with assoc as materialized (
      select a.id, a.name, coalesce(nullif(a.timezone, ''), 'America/Chicago') as zone,
             public.association_local_date(a.id) as local_today
        from public.associations a
       where a.portfolio_id = p_portfolio_id
         and (nullif(p_params->>'association_id', '') is null
              or a.id = (p_params->>'association_id')::uuid)
    )
    select w.number, w.title, w.status::text, w.priority::text,
           a.name as association, u.unit_number, v.name as vendor,
           w.scheduled_date, w.created_at,
           (a.local_today - (w.created_at at time zone a.zone)::date) as age_days
    from public.work_orders w
    join assoc a on a.id = w.association_id
    left join public.units u on u.id = w.unit_id
    left join public.vendors v on v.id = w.vendor_id
    where w.archived_at is null
      and w.status in ('new', 'assigned', 'scheduled', 'in_progress')
  ) r
  ) s(x) limit 1);
end$function$;

-- 5. Fund balance sheets tie out per fund ---------------------------------------
create or replace function public.report_data_fund_balance_sheet(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.fund, r.number), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params)),
    bal as (
      select coalesce(g.fund_account::text, 'unassigned') as fund, g.number, g.name, g.account_type::text as account_type, sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as balance
        from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
        join public.gl_accounts g on g.id = jl.gl_account_id
        cross join prm
        where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
        group by g.fund_account, g.id
      union all
      select coalesce(g.fund_account::text, 'unassigned'), 39999, 'Accumulated Surplus (income less expenses)', 'equity', sum(jl.credit_amount - jl.debit_amount)
        from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
        join public.gl_accounts g on g.id = jl.gl_account_id
        cross join prm
        where (prm.aid is null or jl.association_id = prm.aid) and je.entry_date <= prm.dt
          and g.account_type::text in ('income','other_income','expense','cost_of_goods_sold','other_expense','non_operating')
        group by g.fund_account
    ),
    -- Assets less liabilities and equity per fund, shown as the balancing
    -- line: positive means the fund owes the other funds (due to), negative
    -- means the other funds owe it (due from). Totals zero.
    interfund as (
      select b.fund, sum(case when b.account_type in ('asset','cash','accounts_receivable','fixed_asset') then b.balance else -b.balance end) as diff
        from bal b group by b.fund
    )
    select b.fund, b.number, b.name, b.account_type, b.balance from bal b
    union all
    select i.fund, 39998, 'Interfund balance (due to / from other funds)', 'equity', round(i.diff, 2)
      from interfund i where abs(i.diff) >= 0.005
  ) r
  ) s(x) limit 1);
end$function$;

create or replace function public.report_data_fund_balance_sheet_active_funds(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$#variable_conflict use_column
begin
  return (select s.x from (

  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select fund,
           sum(case when section = 'asset' then bal else 0 end) as assets,
           sum(case when section = 'liability' then bal else 0 end) as liabilities,
           sum(case when section = 'equity' then bal else 0 end) as equity,
           round(sum(case when section = 'asset' then bal else -bal end), 2) as interfund_balance
      from (select coalesce(g.fund_account::text,'unassigned') as fund,
                   case when g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset') then 'asset'
                        when g.account_type::text in ('liability','accounts_payable') then 'liability' else 'equity' end as section,
                   sum(public.rpt_sign(g.account_type::text, jl.debit_amount, jl.credit_amount)) as bal
              from public.journal_lines jl
              join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
              join public.gl_accounts g on g.id = jl.gl_account_id
              cross join prm
             where (prm.aid is null or jl.association_id = prm.aid) and g.account_type::text in ('asset','cash','accounts_receivable','fixed_asset','liability','accounts_payable','equity') and je.entry_date <= prm.dt
             group by g.fund_account, g.id, g.account_type
            union all
            -- The fund's accumulated surplus (income less expenses) is equity.
            select coalesce(g.fund_account::text,'unassigned'), 'equity', sum(jl.credit_amount - jl.debit_amount)
              from public.journal_lines jl
              join public.journal_entries je on je.id = jl.entry_id and je.posted and je.portfolio_id = p_portfolio_id
              join public.gl_accounts g on g.id = jl.gl_account_id
              cross join prm
             where (prm.aid is null or jl.association_id = prm.aid) and je.entry_date <= prm.dt
               and g.account_type::text in ('income','other_income','expense','cost_of_goods_sold','other_expense','non_operating')
             group by g.fund_account) x
      group by fund having sum(abs(bal)) > 0 order by fund
  ) r
  ) s(x) limit 1);
end$function$;

-- 6. Report run files open through the app's sign-in download route ----------
-- Older runs stored a time-limited storage link; the download route signs a
-- fresh link for a signed-in user who can see the run.
update public.report_runs
   set output_url = '/reports/runs/' || id || '/download'
 where output_url like '%/object/sign/%';
