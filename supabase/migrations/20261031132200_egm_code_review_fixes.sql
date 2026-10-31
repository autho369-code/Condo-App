-- Fixes from the 2026-10-31 Elephant-Goldfish code review (five goldfish
-- reviewers on receivables, payables, access control, operations and the
-- first month; docs/reviews/2026-10-31-egm/code/). Each finding was checked
-- against the live definitions first; ones already fixed live were dropped.

-- 1. Two-step sign-in (MFA) for platform operators is enforced by the
--    database, not only by the app. A phished operator password used straight
--    against the API (no middleware) used to reach every company's data.
--    Now is_platform_operator() and is_platform_admin() are true only for a
--    session that finished the second step (aal2). Identity (me()) still
--    reports the operator so the app sends them to /mfa, where enrolling and
--    verifying go through Supabase Auth and need no data access. Every other
--    place that read platform_operators directly for access now uses these
--    (section 1b).
create or replace function public.is_platform_operator_identity()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select public.is_current_identity_enabled()
     and exists (
       select 1 from public.platform_operators po
       where po.auth_user_id = auth.uid()
         and po.active
     )
  ) s(x) limit 1);
end
$function$;
revoke execute on function public.is_platform_operator_identity() from public, anon;
grant execute on function public.is_platform_operator_identity() to authenticated, service_role;

create or replace function public.operator_session_verified()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  return coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
end
$function$;
revoke execute on function public.operator_session_verified() from public, anon;
grant execute on function public.operator_session_verified() to authenticated, service_role;

create or replace function public.is_platform_operator()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select public.is_platform_operator_identity()
     and public.operator_session_verified()
  ) s(x) limit 1);
end
$function$;

create or replace function public.is_platform_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select exists (
    select 1 from public.platform_operators po
    where po.auth_user_id = auth.uid() and po.active and po.role = 'admin'
  ) and public.operator_session_verified()
  ) s(x) limit 1);
end
$function$;

create or replace function public.me()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (
      select case
        when public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()
          then to_jsonb(po) - 'ai_api_key' - 'ai_api_key_ciphertext' - 'ai_endpoint'
        else jsonb_build_object(
          'id', po.id, 'company_name', po.company_name, 'slug', po.slug,
          'logo_url', po.logo_url, 'favicon_url', po.favicon_url, 'brand_color', po.brand_color,
          'brand_email', po.brand_email, 'website', po.website, 'public_website', po.public_website,
          'phone_number', po.phone_number, 'texting_phone_number', po.texting_phone_number,
          'support_email', po.support_email, 'support_phone', po.support_phone,
          'address_street', po.address_street, 'address_city', po.address_city,
          'address_state', po.address_state, 'address_zip', po.address_zip,
          'archived_at', po.archived_at, 'suspended_at', po.suspended_at)
      end
      from public.portfolios po
      where po.id = public.current_portfolio_id()
    ),
    'role_name', public.current_role_name(),
    -- Identity, not data access: an operator who has not finished the second
    -- sign-in step is still an operator, so the app sends them to /mfa.
    'is_platform_operator', public.is_platform_operator_identity(), 'platform_operator_role', (select po.role from public.platform_operators po where po.auth_user_id = auth.uid() and po.active limit 1),
    'is_company_admin', public.is_company_admin(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'is_tenant', public.is_tenant_user(),
    'owner_id', public.current_owner_id(),
    'owner_ids', array(select public.current_owner_ids()),
    'tenant_id', public.current_tenant_id(),
    'vendor_id', public.current_vendor_id(),
    'vendor_ids', array(select public.current_vendor_ids()),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids()),
    'tenant_association_ids', array(select public.current_tenant_association_ids()),
    'tenant_unit_ids', array(select public.current_tenant_unit_ids())
  )
  ) s(x) limit 1);
end
$function$;

-- 1b. The rest of the operator access paths go through the MFA-checked
--     helpers: three policies and the admin-only role change read
--     platform_operators directly; the report access checks run as the
--     requesting user (who signed in fully) and now say so.
alter policy marketing_leads_platform_read on public.marketing_leads
  using ((select public.is_platform_operator()));
alter policy marketing_leads_platform_write on public.marketing_leads
  using ((select public.is_platform_operator()))
  with check ((select public.is_platform_operator()));
alter policy operator_all_board_comments on public.board_comments
  using ((select public.is_platform_operator()));

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  v_def := replace(pg_get_functiondef('public.platform_set_profile_role(uuid, public.hoa_role)'::regprocedure), chr(13), '');
  v_old := '  if v_actor_email is null then';
  v_new := '  if v_actor_email is null or not public.is_platform_admin() then';
  if position('or not public.is_platform_admin()' in v_def) = 0 then
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'platform_set_profile_role: admin check not found exactly once';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  foreach v_old in array array['public.report_access_error_as(uuid, uuid, text, jsonb)', 'public.report_run_access_error(uuid)'] loop
    v_def := replace(pg_get_functiondef(v_old::regprocedure), chr(13), '');
    if position('''aal'', ''aal2''' in v_def) = 0 then
      if (length(v_def) - length(replace(v_def, '''role'', ''authenticated'')', ''))) / length('''role'', ''authenticated'')') <> 1 then
        raise exception '%: claims not found exactly once', v_old;
      end if;
      execute replace(v_def, '''role'', ''authenticated'')', '''role'', ''authenticated'', ''aal'', ''aal2'')');
    end if;
  end loop;
end
$$;

-- 2. Daily dues posting: one row that can't post (for example a company whose
--    chart of accounts has no receivable account yet) no longer rolls back
--    every company's dues. Each row posts on its own; a failed row keeps its
--    date, so it posts on the next run once fixed, and records why on the
--    schedule (last_error, last_error_at).
alter table public.unit_recurring_charges add column if not exists last_error text;
alter table public.unit_recurring_charges add column if not exists last_error_at timestamptz;

create or replace function public.post_unit_recurring_charges()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare row record; n integer := 0; new_charge_id uuid; next_due date;
begin
  for row in
    select urc.*, cc.name as category_name, cc.gl_account_id as category_gl,
           cc.charge_type as category_charge_type, cc.code as category_code
      from public.unit_recurring_charges urc
      join public.charge_categories cc on cc.id = urc.charge_category_id
      join public.units un on un.id = urc.unit_id
      join public.buildings b on b.id = un.building_id
      join public.associations a on a.id = b.association_id
     where urc.active and cc.active
       and un.archived_at is null
       -- Due by the association's own date (same rule as
       -- association_local_date, inlined: no per-row function call).
       and urc.next_post_date <= (now() at time zone coalesce(nullif(a.timezone, ''), 'America/Chicago'))::date
       -- A recurring charge whose category is not the association's (the
       -- category trigger refuses it) is skipped.
       and (cc.portfolio_id is null or cc.portfolio_id = a.portfolio_id)
       and (cc.association_id is null or cc.association_id = b.association_id)
       and (urc.end_date is null or urc.next_post_date <= urc.end_date)
  loop
    begin
      perform 1 from public.units where id = row.unit_id for update;
      perform 1 from public.unit_recurring_charges u
       where u.id = row.id and u.active and u.next_post_date = row.next_post_date
         and (u.end_date is null or u.next_post_date <= u.end_date)
         for update;
      if not found then
        continue;
      end if;

      insert into public.charges (
        unit_id, charge_category_id, charge_type, description,
        amount, due_date, gl_account_id, created_by
      ) values (
        row.unit_id, row.charge_category_id, row.category_charge_type,
        coalesce(row.memo, row.category_name),
        row.amount, row.next_post_date, row.category_gl, row.created_by
      ) returning id into new_charge_id;

      next_due := public.recurring_next_date(row.next_post_date, row.frequency::text, 1,
        extract(day from coalesce(row.start_date, row.next_post_date))::integer);

      update public.unit_recurring_charges
         set next_post_date = next_due, last_posted_at = now(), updated_at = now(),
             last_error = null, last_error_at = null
       where id = row.id;
      n := n + 1;
    exception when others then
      update public.unit_recurring_charges
         set last_error = left(sqlerrm, 1000), last_error_at = now()
       where id = row.id;
    end;
  end loop;
  return n;
end;
$function$;

--    A row that couldn't post stays visible: a check five minutes after the
--    posting job fails (and so appears in the daily health alert and the
--    System Monitor) while any schedule has an error from today.
create or replace function public.check_recurring_charge_failures()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_count integer; v_sample text;
begin
  select count(*), min(left(last_error, 200)) into v_count, v_sample
    from public.unit_recurring_charges
   where active and last_error_at > now() - interval '20 hours';
  if v_count > 0 then
    raise exception '% recurring charge(s) could not post today, e.g.: %', v_count, v_sample;
  end if;
end;
$function$;
revoke execute on function public.check_recurring_charge_failures() from public, anon, authenticated;

select cron.schedule('check-recurring-charge-failures-daily', '5 11 * * *',
  $cron$ select public.check_recurring_charge_failures(); $cron$);

-- 3. A payment intent stays in its own company: its association is the
--    company's and its unit is in that association (a finance user could
--    write one naming another company's unit, which held that unit's late
--    fees and AutoPay, or credited Stripe money to the wrong unit).
create or replace function public.payment_intent_same_company()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.association_id is not null and not exists (
       select 1 from public.associations a
        where a.id = new.association_id and a.portfolio_id = new.portfolio_id) then
    raise exception 'That association is not in this company' using errcode = '42501';
  end if;
  if new.unit_id is not null and not exists (
       select 1 from public.units u join public.buildings b on b.id = u.building_id
        where u.id = new.unit_id and b.association_id = new.association_id) then
    raise exception 'That unit is not in this association' using errcode = '42501';
  end if;
  return new;
end
$function$;
revoke execute on function public.payment_intent_same_company() from public, anon, authenticated;

create or replace trigger payment_intents_same_company
  before insert or update of portfolio_id, association_id, unit_id on public.payment_intents
  for each row execute function public.payment_intent_same_company();

-- 4. A payment recorded against one charge applies only up to that charge's
--    open balance; the rest stays as the owner's credit (it used to apply in
--    full, so an overpayment vanished from credits).
create or replace function public.auto_apply_new_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_open numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('unit-apply:' || new.unit_id::text, 0));
  if new.charge_id is not null then
    select greatest(c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa
                                          where pa.charge_id = c.id), 0), 0)
      into v_open
      from public.charges c
     where c.id = new.charge_id;
    if coalesce(v_open, 0) > 0 then
      insert into public.payment_applications (payment_id, charge_id, amount_applied, applied_by, application_method)
      values (new.id, new.charge_id, least(new.amount, v_open), new.created_by, 'auto_specific')
      on conflict do nothing;
    end if;
  else
    perform public.apply_payment(new.id, 'association_policy');
  end if;
  return new;
end;
$function$;

-- 5. Texts: a message Twilio accepted and later reported failed is not sent
--    again (only a send that never reached Twilio is retried), and texts to
--    residents of a held association wait, like their email.
create or replace function public.claim_sms_messages(p_limit integer default 20)
returns setof public.sms_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  with candidates as (
    select id from public.sms_messages
    where direction = 'outbound'
      and (status = 'queued' or (status = 'failed' and provider_message_id is null))
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
        -- Not for a suspended company (waits until reactivated).
        join public.portfolios pf
          on pf.id = conversation.portfolio_id
         and pf.suspended_at is null
        where conversation.id = sms_messages.conversation_id
          -- Held residents' texts wait, as their email does (vendors aren't
          -- residents).
          and (conversation.with_entity_type is distinct from 'owner'
               or not public.email_is_held(conversation.association_id, conversation.with_entity_id, ''))
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

--    Letters to residents of a held association wait too.
create or replace function public.claim_physical_mail(p_limit integer default 10)
returns setof public.physical_mail_deliveries
language plpgsql
security definer
set search_path = pg_catalog, public
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
      -- A suspended company's letters wait until it is reactivated.
      and not exists (
        select 1 from public.portfolios pf
         where pf.id = physical_mail_deliveries.portfolio_id and pf.suspended_at is not null)
      and not public.email_is_held(physical_mail_deliveries.association_id, physical_mail_deliveries.owner_id, '')
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

-- 6. An email whose attempts ran out while it was being sent (the sending run
--    errored or was killed after claiming it) is marked failed instead of
--    staying "pending" forever. The email worker calls this each run.
create or replace function public.fail_exhausted_email_queue()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  with gone as (
    update public.email_queue
       set status = 'failed', processing_at = null,
           error_message = coalesce(error_message, 'Gave up after 5 attempts')
     where status = 'pending'
       and attempt_count >= 5
       and processing_at is not null
       and processing_at < now() - interval '10 minutes'
    returning communication_message_id
  ), msgs as (
    update public.communication_messages m
       set status = 'failed', error_message = coalesce(m.error_message, 'Gave up after 5 attempts'), updated_at = now()
      from gone
     where m.id = gone.communication_message_id
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$function$;
revoke execute on function public.fail_exhausted_email_queue() from public, anon, authenticated;
grant execute on function public.fail_exhausted_email_queue() to service_role;

-- 7. A draft journal entry posted from Journal Entries records when it was
--    posted, like every other posting path.
create or replace function public.draft_journal_entry_action(p_entry_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entry public.journal_entries;
  v_linked integer;
begin
  if p_action not in ('post', 'delete') then
    raise exception 'Unknown action';
  end if;
  select * into v_entry from public.journal_entries where id = p_entry_id for update;
  if not found or not public.can_manage_finance(v_entry.portfolio_id) then
    raise exception 'That draft was not found';
  end if;
  if v_entry.posted then
    raise exception 'That entry is already posted';
  end if;
  if exists (
    select 1 from public.journal_lines jl
     where jl.entry_id = p_entry_id
       and not public.can_view_association_row(jl.association_id)
  ) then
    raise exception 'This draft includes an association you do not manage';
  end if;

  if p_action = 'post' then
    update public.journal_entries set posted = true, posted_at = coalesce(posted_at, now()) where id = p_entry_id;
    if v_entry.source_type = 'bank_transfer' and v_entry.source_id is not null then
      update public.bank_transfers
         set journal_entry_id = p_entry_id
       where id = v_entry.source_id
         and portfolio_id = v_entry.portfolio_id
         and journal_entry_id is null
         and voided_at is null;
      get diagnostics v_linked = row_count;
      if v_linked = 0 then
        raise exception 'The bank transfer for this draft was not found, is already posted, or is void';
      end if;
    end if;
  else
    delete from public.journal_entries where id = p_entry_id;
  end if;
end $function$;
