-- Company admin / platform operator deep check (2026-10-16).
--
-- 1. Company settings belong to the company admin. portfolios_admin_update
--    let full-access MANAGERS write the company row directly (MFA rules, AI
--    provider and key, invitation domain allowlist, invitation sender
--    settings, fees), while company admins matched no update policy at all:
--    /settings and /settings/branding (company-admin pages that write with
--    the signed-in session) always ended in "your account cannot edit this
--    company". The policy now names the company admin's own company. Managers
--    keep update_company_profile / update_company_logo (definer RPCs).
-- 2. The management-fee run markers are written by the scheduler only, so a
--    direct write can't make a month bill again.
-- 3. Staff roles (user_roles) are the company admin's: full-access managers
--    could rename or add the company's roles, which decides who else gets
--    full or finance access.
-- 4. A suspended company stops: queued email (except the platform's own mail
--    to the company, e.g. its invoice), texts, physical mail, webhooks,
--    AutoPay charges, scheduled reports, scheduled management fees and
--    automatic late fees wait until it is reactivated. Nothing is dropped:
--    rows stay queued and run after reactivation.
-- 5. More platform host names are reserved as company addresses (mail
--    autodiscovery, sign-in and service names).
--
-- Every function body below is the live body (pg_get_functiondef,
-- 2026-10-16) with only the marked change.

-- 1. ------------------------------------------------------------------------
alter policy portfolios_admin_update on public.portfolios
  using (coalesce(id = (select public.my_admin_portfolio()), false))
  with check (coalesce(id = (select public.my_admin_portfolio()), false));

-- 2. ------------------------------------------------------------------------
create or replace function public.portfolios_guard_platform_columns()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- Written only by the management-fee scheduler and set_management_fee_schedule
  -- (definer functions run as their owner); never directly by a signed-in user.
  if current_user in ('authenticated', 'anon')
     and (new.management_fee_auto_last_month is distinct from old.management_fee_auto_last_month
          or new.management_fee_auto_last_run is distinct from old.management_fee_auto_last_run) then
    raise exception 'The management fee schedule records its own runs.' using errcode = '42501';
  end if;
  if auth.uid() is null or (public.is_platform_operator() and public.is_platform_admin()) then
    return new;
  end if;
  if new.tier is distinct from old.tier
     or new.entitlements is distinct from old.entitlements
     or new.archived_at is distinct from old.archived_at
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason
     or new.slug is distinct from old.slug
     or new.custom_domain is distinct from old.custom_domain
     or new.created_by is distinct from old.created_by then
    raise exception 'Plan, status and account identity can only be changed by platform support';
  end if;
  return new;
end $function$;

-- 3. ------------------------------------------------------------------------
alter policy user_roles_admin_all on public.user_roles
  using ((select public.is_platform_operator())
         or coalesce(portfolio_id = (select public.my_admin_portfolio()), false))
  with check ((select public.is_platform_operator())
              or coalesce(portfolio_id = (select public.my_admin_portfolio()), false));

-- 4. ------------------------------------------------------------------------
create or replace function public.claim_email_queue_snapshot(p_limit integer default 10)
 returns setof email_queue
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_limit < 1 or p_limit > 50 then raise exception 'Claim limit must be between 1 and 50'; end if;

  return query
  with due as (
    select id
    from public.email_queue
    where status in ('pending', 'failed')
      and attempt_count < 5
      and suppressed_at is null
      and next_attempt_at <= now()
      and (processing_at is null or processing_at < now() - interval '10 minutes')
      -- Changed: a suspended company's mail waits until it is reactivated; the
      -- platform's own mail to the company (sender name Portier369...) still goes.
      and not exists (
        select 1 from public.portfolios pf
         where pf.id = email_queue.portfolio_id
           and pf.suspended_at is not null
           and lower(btrim(coalesce(email_queue.from_name, ''))) not like 'portier369%')
    order by holds_auth_link desc, next_attempt_at, created_at
    for update skip locked
    limit p_limit
  )
  update public.email_queue q
  set processing_at = now(), attempt_count = q.attempt_count + 1, snapshot_claims = q.snapshot_claims + 1,
      status = 'pending', error_message = null
  from due
  where q.id = due.id
  returning q.*;
end;
$function$;

create or replace function public.claim_sms_messages(p_limit integer default 20)
 returns setof sms_messages
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  with candidates as (
    select id from public.sms_messages
    where direction = 'outbound'
      and status in ('queued', 'failed')
      and attempt_count < 8
      and next_attempt_at <= now()
      and (locked_at is null or locked_at < now() - interval '5 minutes')
      and exists (
        select 1
        from public.sms_conversations conversation
        join public.sms_opt_ins consent
          on consent.portfolio_id = conversation.portfolio_id
         and consent.phone_number = sms_messages.to_number
         and consent.opted_in
        -- Changed: not for a suspended company (waits until reactivated).
        join public.portfolios pf
          on pf.id = conversation.portfolio_id
         and pf.suspended_at is null
        where conversation.id = sms_messages.conversation_id
      )
    order by next_attempt_at, created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.sms_messages message
  set locked_at = now(), last_attempt_at = now(), attempt_count = attempt_count + 1
  from candidates where message.id = candidates.id
  returning message.*;
end;
$function$;

create or replace function public.claim_physical_mail(p_limit integer default 10)
 returns setof physical_mail_deliveries
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  with candidates as (
    select id from public.physical_mail_deliveries
    where attempt_count < 6
      and (
        (status in ('queued', 'failed') and next_attempt_at <= now()
          and (locked_at is null or locked_at < now() - interval '10 minutes'))
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
      -- Changed: a suspended company's letters wait until it is reactivated.
      and not exists (
        select 1 from public.portfolios pf
         where pf.id = physical_mail_deliveries.portfolio_id and pf.suspended_at is not null)
    order by next_attempt_at, created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.physical_mail_deliveries mail
  set status = 'processing', locked_at = now(), last_attempt_at = now(), attempt_count = attempt_count + 1
  from candidates where mail.id = candidates.id
  returning mail.*;
end;
$function$;

create or replace function public.claim_webhook_deliveries(p_limit integer default 20)
 returns table(delivery_id uuid, endpoint_id uuid, endpoint_url text, signing_secret text, event_type webhook_event, payload jsonb, attempts integer)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  with candidates as (
    select delivery.id
    from public.webhook_deliveries delivery
    join public.webhook_endpoints endpoint on endpoint.id = delivery.endpoint_id
    where delivery.status in ('pending', 'retrying')
      and delivery.next_attempt_at <= now()
      and (delivery.locked_at is null or delivery.locked_at < now() - interval '5 minutes')
      and endpoint.active
      and (endpoint.disabled_until is null or endpoint.disabled_until < now())
      -- Changed: a suspended company's events wait until it is reactivated.
      and not exists (
        select 1 from public.portfolios pf
         where pf.id = endpoint.portfolio_id and pf.suspended_at is not null)
    order by delivery.next_attempt_at, delivery.created_at
    for update of delivery skip locked
    limit least(greatest(p_limit, 1), 100)
  ), claimed as (
    update public.webhook_deliveries delivery
    set locked_at = now()
    from candidates where delivery.id = candidates.id
    returning delivery.*
  )
  select claimed.id, endpoint.id, endpoint.url, endpoint.signing_secret,
         claimed.event_type, claimed.payload, claimed.attempts
  from claimed join public.webhook_endpoints endpoint on endpoint.id = claimed.endpoint_id;
end;
$function$;

create or replace function public.claim_stripe_autopay_run(p_mandate_id uuid, p_scheduled_for date)
 returns table(run_id uuid, idempotency_key text)
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_mandate public.autopay_mandates%rowtype;
  v_method public.payment_methods%rowtype;
  v_association public.associations%rowtype;
  v_run public.stripe_autopay_runs%rowtype;
  v_run_id uuid := gen_random_uuid();
begin
  select * into v_mandate
  from public.autopay_mandates
  where id = p_mandate_id
  for update;

  if not found
     or v_mandate.status::text <> 'active'
     or v_mandate.next_run_date is distinct from p_scheduled_for
     or p_scheduled_for > current_date then
    return;
  end if;

  -- Changed: no AutoPay charge while the company is suspended (the run is not
  -- claimed and the mandate keeps its date, so it runs after reactivation).
  if exists (select 1 from public.portfolios pf
              where pf.id = v_mandate.portfolio_id and pf.suspended_at is not null) then
    return;
  end if;

  select * into v_method from public.payment_methods where id = v_mandate.payment_method_id;
  select * into v_association from public.associations where id = v_mandate.association_id;

  if v_method.id is null
     or v_association.id is null
     or v_method.owner_id is distinct from v_mandate.owner_id
     or v_method.portfolio_id is distinct from v_mandate.portfolio_id
     or v_method.association_id is distinct from v_mandate.association_id
     or v_method.processor::text <> 'stripe'
     or v_method.processor_account_id is distinct from v_association.stripe_account_id
     or not coalesce(v_association.stripe_charges_enabled, false)
     or not coalesce(v_association.stripe_payouts_enabled, false)
     or v_association.stripe_deauthorized_at is not null then
    raise exception 'AutoPay mandate is not bound to a payment-ready association Stripe account';
  end if;

  insert into public.stripe_autopay_runs(
    id, mandate_id, scheduled_for, processor_account_id, idempotency_key
  ) values (
    v_run_id,
    p_mandate_id,
    p_scheduled_for,
    v_association.stripe_account_id,
    'autopay-run-' || v_run_id::text
  )
  on conflict (mandate_id, scheduled_for) do nothing
  returning * into v_run;

  if found then
    run_id := v_run.id;
    idempotency_key := v_run.idempotency_key;
    return next;
    return;
  end if;

  update public.stripe_autopay_runs
  set status = 'claimed',
      attempts = attempts + 1,
      claimed_at = now(),
      updated_at = now(),
      failure_reason = null
  where mandate_id = p_mandate_id
    and scheduled_for = p_scheduled_for
    and attempts < 3
    and (
      (status = 'claimed' and claimed_at < now() - interval '10 minutes')
      or (status = 'intent_created' and updated_at < now() - interval '10 minutes')
      or (status = 'failed' and processor_payment_intent_id is null)
    )
  returning * into v_run;

  if found then
    run_id := v_run.id;
    idempotency_key := v_run.idempotency_key;
    return next;
  end if;
end;
$function$;

create or replace function public.enqueue_scheduled_reports()
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  row record;
  n integer := 0;
begin
  for row in
    select sr.* from public.scheduled_reports sr
     where sr.active and sr.archived_at is null
       and (sr.next_run_at is null or sr.next_run_at <= now())
       -- Changed: not for a suspended company (runs once after reactivation).
       and not exists (select 1 from public.portfolios pf
                        where pf.id = sr.portfolio_id and pf.suspended_at is not null)
  loop
    insert into public.report_runs (
      portfolio_id, definition_id, saved_report_id, scheduled_report_id,
      status, parameters, output_format, triggered_by
    ) values (
      row.portfolio_id, row.definition_id, row.saved_report_id, row.id,
      'queued', row.parameters, row.output_format, coalesce(row.run_as, row.created_by)
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

create or replace function public.run_scheduled_management_fees(p_today date default current_date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
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
       -- Changed: not for a suspended company.
       and suspended_at is null
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
end $function$;

create or replace function public.cron_assess_late_fees()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  a record;
  c record;
  v_fee uuid;
  v_assoc_count integer := 0;
  v_candidates integer := 0;
  v_assessed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_details text[] := '{}';
begin
  for a in
    select x.id, x.name, coalesce(x.late_fee_grace_days, 0) as grace, public.association_local_date(x.id) as today
      from public.associations x
     where x.late_fee_enabled and coalesce(x.late_fee_amount, 0) > 0 and x.archived_at is null
       -- Changed: no automatic late fees while the company is suspended (its
       -- owners can't sign in to pay and AutoPay is paused).
       and not exists (select 1 from public.portfolios pf
                        where pf.id = x.portfolio_id and pf.suspended_at is not null)
     order by x.name
  loop
    v_assoc_count := v_assoc_count + 1;
    for c in
      select ch.id
        from public.charges ch
        join public.units u on u.id = ch.unit_id
        join public.buildings b on b.id = u.building_id
       where b.association_id = a.id
         and ch.charge_type = 'assessment'
         and ch.due_date + a.grace < a.today
         and not exists (select 1 from public.late_fee_assessments l where l.charge_id = ch.id)
         and ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0) > 0.005
       order by ch.due_date, ch.id
    loop
      v_candidates := v_candidates + 1;
      begin
        v_fee := public.assess_late_fee(c.id);
        if v_fee is not null then v_assessed := v_assessed + 1; else v_skipped := v_skipped + 1; end if;
      exception when others then
        v_failed := v_failed + 1;
        if cardinality(v_details) < 50 then
          v_details := v_details || (a.name || ' charge ' || c.id || ': ' || sqlerrm);
        end if;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'associations', v_assoc_count, 'candidates', v_candidates, 'assessed', v_assessed,
    'skipped', v_skipped, 'failed', v_failed, 'details', to_jsonb(v_details));
end;
$function$;

-- 5. ------------------------------------------------------------------------
create or replace function public.reserved_portfolio_slug(p_slug text)
 returns boolean
 language sql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
  select p_slug = any (array['www', 'app', 'api', 'admin', 'assets', 'help', 'mail', 'status',
                             'support', 'staging', 'preview', 'portier369',
                             -- Added: mail autodiscovery and mail hosts, sign-in
                             -- and platform service names.
                             'autodiscover', 'autoconfig', 'webmail', 'smtp', 'imap', 'pop', 'mx',
                             'email', 'ns1', 'ns2', 'login', 'auth', 'sso', 'oauth', 'account',
                             'accounts', 'secure', 'security', 'billing', 'platform', 'operator',
                             'dashboard', 'portal', 'docs', 'blog', 'cdn', 'static', 'media',
                             'webhooks', 'dev', 'test', 'demo']);
$function$;
