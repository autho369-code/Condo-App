-- Remove obsolete RPC overloads that are not used by the application and whose
-- bodies no longer match the canonical schema. The current portfolio-scoped
-- invite_staff(uuid, ...) and invite_vendor(uuid, ...) functions remain.
drop function if exists public.confirm_owner_invitation(uuid);
drop function if exists public.invite_board_member(text, text, uuid, text);
drop function if exists public.invite_company_admin(text, text, text, uuid);
drop function if exists public.invite_owner(text, text, uuid, text);
drop function if exists public.invite_property_manager(text, text, uuid[]);
drop function if exists public.invite_staff(text, text, text);
drop function if exists public.invite_vendor(text, text, text);
drop function if exists public.list_company_invitations();
drop function if exists public.stage_owner_activation(uuid, text, text);
drop function if exists public.stage_owner_form(uuid, text, text, text);

create or replace function public.generate_invite_token()
returns text
language sql
set search_path = pg_catalog, public, extensions
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

revoke all on function public.generate_invite_token() from public, anon, authenticated;
grant execute on function public.generate_invite_token() to service_role;

create or replace function public.anonymize_owner(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.owners
     set full_name = 'Anonymized (' || left(id::text, 8) || ')',
         first_name = null,
         last_name = null,
         email = id::text || '@anonymized.local',
         phone = null,
         phone_numbers = '[]'::jsonb,
         emails = '[]'::jsonb,
         mailing_address = null,
         address_street = null,
         address_city = null,
         address_state = null,
         address_zip = null,
         notes = null,
         portal_activated = false,
         portal_login_last_at = null,
         auth_user_id = null,
         archived_at = coalesce(archived_at, now())
   where id = p_owner_id;
end;
$$;

revoke all on function public.anonymize_owner(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_owner(uuid) to service_role;

create or replace function public.aggregate_usage_metrics(p_year integer, p_month integer)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  period_start timestamptz := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  period_end timestamptz := period_start + interval '1 month';
begin
  insert into public.usage_metrics (
    portfolio_id, period_year, period_month,
    staff_count, owner_count, association_count, unit_count,
    work_orders_created, service_requests_created, bills_posted,
    payments_received, emails_sent, sms_sent, api_calls
  )
  select
    p.id,
    p_year,
    p_month,
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role = 'manager'), 0),
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role in ('owner', 'tenant')), 0),
    coalesce((select count(*) from public.associations where portfolio_id = p.id and archived_at is null), 0),
    coalesce((select count(*) from public.units u
              join public.buildings b on b.id = u.building_id
              join public.associations a on a.id = b.association_id
              where a.portfolio_id = p.id and u.archived_at is null), 0),
    coalesce((select count(*) from public.work_orders w
              where w.portfolio_id = p.id and w.created_at >= period_start and w.created_at < period_end), 0),
    coalesce((select count(*) from public.service_requests s
              where s.portfolio_id = p.id and s.created_at >= period_start and s.created_at < period_end), 0),
    coalesce((select count(*) from public.payable_bills b
              where b.portfolio_id = p.id and b.created_at >= period_start and b.created_at < period_end), 0),
    coalesce((select count(*) from public.payments pm
              join public.units u on u.id = pm.unit_id
              join public.buildings b on b.id = u.building_id
              join public.associations a on a.id = b.association_id
              where a.portfolio_id = p.id and pm.created_at >= period_start and pm.created_at < period_end), 0),
    coalesce((select count(*) from public.email_queue eq
              join public.associations a on a.id = eq.association_id
              where a.portfolio_id = p.id and eq.sent_at >= period_start and eq.sent_at < period_end), 0),
    coalesce((select count(*) from public.sms_messages sm
              join public.sms_conversations sc on sc.id = sm.conversation_id
              where sc.portfolio_id = p.id and sm.created_at >= period_start and sm.created_at < period_end), 0),
    0
  from public.portfolios p
  on conflict (portfolio_id, period_year, period_month) do update set
    staff_count = excluded.staff_count,
    owner_count = excluded.owner_count,
    association_count = excluded.association_count,
    unit_count = excluded.unit_count,
    work_orders_created = excluded.work_orders_created,
    service_requests_created = excluded.service_requests_created,
    bills_posted = excluded.bills_posted,
    payments_received = excluded.payments_received,
    emails_sent = excluded.emails_sent,
    sms_sent = excluded.sms_sent,
    updated_at = now();
end;
$$;

revoke all on function public.aggregate_usage_metrics(integer, integer) from public, anon, authenticated;
grant execute on function public.aggregate_usage_metrics(integer, integer) to service_role;

create or replace function public.run_autopay_mandates()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  m record;
  processed_count integer := 0;
  amount_cents integer;
  target_charge_id uuid;
begin
  for m in
    select am.*,
           coalesce(am.association_id, a.id) as resolved_association_id,
           coalesce(am.portfolio_id, a.portfolio_id) as resolved_portfolio_id
      from public.autopay_mandates am
      left join public.units u on u.id = am.unit_id
      left join public.buildings b on b.id = u.building_id
      left join public.associations a on a.id = b.association_id
     where am.status = 'active'
       and am.next_run_date <= current_date
       and (am.end_date is null or current_date <= am.end_date)
  loop
    if m.unit_id is null
       or m.resolved_association_id is null
       or m.resolved_portfolio_id is null then
      continue;
    end if;

    select c.id,
           round((c.amount - coalesce((select sum(p.amount) from public.payments p where p.charge_id = c.id), 0)) * 100)::integer
      into target_charge_id, amount_cents
      from public.charges c
     where c.unit_id = m.unit_id
       and c.charge_type = 'assessment'
       and (c.amount - coalesce((select sum(p.amount) from public.payments p where p.charge_id = c.id), 0)) > 0
     order by c.due_date
     limit 1;

    if amount_cents is not null
       and amount_cents > 0
       and amount_cents <= m.authorized_amount_max_cents then
      insert into public.payment_intents (
        portfolio_id, association_id, unit_id, owner_id,
        amount, method, processor, processor_account_id,
        breakdown, status, idempotency_key
      )
      select
        m.resolved_portfolio_id,
        m.resolved_association_id,
        m.unit_id,
        m.owner_id,
        (amount_cents / 100.0)::numeric(14, 2),
        'ach',
        pm.processor::text,
        pm.processor_account_id,
        jsonb_build_array(jsonb_build_object(
          'charge_id', target_charge_id,
          'amount_cents', amount_cents,
          'autopay_mandate_id', m.id,
          'payment_method_id', m.payment_method_id
        )),
        'pending',
        'autopay:' || m.id::text || ':' || target_charge_id::text || ':' || current_date::text
      from public.payment_methods pm
      where pm.id = m.payment_method_id
        and pm.portfolio_id = m.resolved_portfolio_id
        and pm.owner_id = m.owner_id
        and pm.archived_at is null;

      if found then
        update public.autopay_mandates
           set next_run_date = case frequency
                 when 'monthly' then (current_date + interval '1 month')::date
                 when 'quarterly' then (current_date + interval '3 months')::date
                 when 'annually' then (current_date + interval '1 year')::date
                 when 'on_charge_posted' then null
               end,
               last_run_at = now(),
               updated_at = now()
         where id = m.id;
        processed_count := processed_count + 1;
      end if;
    end if;
  end loop;

  return processed_count;
end;
$$;

revoke all on function public.run_autopay_mandates() from public, anon, authenticated;
grant execute on function public.run_autopay_mandates() to service_role;
