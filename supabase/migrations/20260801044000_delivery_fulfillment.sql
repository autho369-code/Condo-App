-- Durable provider queues. Workers are service-role only and fail closed when
-- their environment-level activation switch or credentials are absent.

alter table public.sms_messages
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

create table if not exists public.sms_consent_events (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  sms_opt_in_id uuid not null references public.sms_opt_ins(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  phone_number text not null,
  opted_in boolean not null,
  source text,
  notes text,
  actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_consent_events_portfolio
  on public.sms_consent_events(portfolio_id, created_at desc);

create or replace function public.guard_sms_consent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.entity_type not in ('owner', 'vendor') then
    raise exception 'live SMS consent is limited to owners and vendors';
  end if;
  if new.entity_type = 'owner' and not exists (
    select 1 from public.owners owner where owner.id = new.entity_id and owner.portfolio_id = new.portfolio_id
  ) then
    raise exception 'SMS owner consent must match the portfolio';
  end if;
  if new.entity_type = 'vendor' and not exists (
    select 1 from public.vendors vendor where vendor.id = new.entity_id and vendor.portfolio_id = new.portfolio_id
  ) then
    raise exception 'SMS vendor consent must match the portfolio';
  end if;
  if new.opted_in
     and (tg_op = 'INSERT' or not coalesce(old.opted_in, false))
     and char_length(btrim(coalesce(new.source, ''))) < 10 then
    raise exception 'documented SMS consent evidence is required';
  end if;
  return new;
end;
$$;

create or replace function public.audit_sms_consent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or new.opted_in is distinct from old.opted_in then
    insert into public.sms_consent_events (
      portfolio_id, sms_opt_in_id, entity_type, entity_id, phone_number,
      opted_in, source, notes, actor_user_id
    ) values (
      new.portfolio_id, new.id, new.entity_type, new.entity_id, new.phone_number,
      new.opted_in, new.source, new.notes, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sms_consent_guard on public.sms_opt_ins;
create trigger trg_sms_consent_guard
before insert or update of opted_in, entity_type, entity_id, phone_number, portfolio_id, source
on public.sms_opt_ins for each row execute function public.guard_sms_consent();
drop trigger if exists trg_sms_consent_audit on public.sms_opt_ins;
create trigger trg_sms_consent_audit
after insert or update of opted_in on public.sms_opt_ins
for each row execute function public.audit_sms_consent();

alter table public.sms_consent_events enable row level security;
create policy sms_consent_events_staff_read on public.sms_consent_events for select to authenticated
using (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()));
grant select on public.sms_consent_events to authenticated;
grant all on public.sms_consent_events to service_role;

create index if not exists idx_sms_messages_delivery_queue
  on public.sms_messages(next_attempt_at)
  where direction = 'outbound' and status in ('queued', 'failed');

create or replace function public.claim_sms_messages(p_limit integer default 20)
returns setof public.sms_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;

create or replace function public.complete_sms_delivery(p_message_id uuid, p_provider_message_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.sms_messages
  set status = 'sent', provider = 'twilio', provider_message_id = left(p_provider_message_id, 200),
      sent_at = now(), locked_at = null, error_code = null, error_message = null
  where id = p_message_id and direction = 'outbound';
end;
$$;

create or replace function public.fail_sms_delivery(p_message_id uuid, p_error_code text, p_error_message text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare current_attempts integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  select attempt_count into current_attempts from public.sms_messages where id = p_message_id for update;
  update public.sms_messages
  set status = 'failed', locked_at = null,
      error_code = left(coalesce(p_error_code, 'provider_error'), 100),
      error_message = left(coalesce(p_error_message, 'SMS delivery failed'), 1000),
      next_attempt_at = now() + make_interval(secs => least(power(3, greatest(current_attempts, 1))::integer * 60, 21600))
  where id = p_message_id and direction = 'outbound';
end;
$$;

create or replace function public.quarantine_sms_delivery(
  p_message_id uuid,
  p_provider_message_id text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.sms_messages
  set status = 'failed', locked_at = null,
      provider = case when p_provider_message_id is null then provider else 'twilio' end,
      provider_message_id = coalesce(left(p_provider_message_id, 200), provider_message_id),
      error_code = 'provider_outcome_unknown',
      error_message = left(coalesce(p_error_message, 'Provider outcome is unknown; manual review required'), 1000),
      next_attempt_at = 'infinity'::timestamptz
  where id = p_message_id and direction = 'outbound';
end;
$$;

create or replace function public.apply_twilio_sms_status(
  p_provider_message_id text,
  p_status public.sms_status,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.sms_messages message
  set status = p_status,
      delivered_at = case when p_status = 'delivered' then coalesce(message.delivered_at, now()) else message.delivered_at end,
      error_code = p_error_code,
      error_message = left(p_error_message, 1000),
      locked_at = null
  where message.provider = 'twilio'
    and message.provider_message_id = p_provider_message_id
    and (
      message.error_code = 'provider_outcome_unknown'
      or message.status = p_status
      or (case p_status when 'queued' then 1 when 'sent' then 2 when 'delivered' then 3 when 'failed' then 3 when 'undelivered' then 3 else 0 end)
         >
         (case message.status when 'queued' then 1 when 'sent' then 2 when 'delivered' then 3 when 'failed' then 3 when 'undelivered' then 3 else 0 end)
    );
end;
$$;

revoke all on function public.claim_sms_messages(integer) from public, anon, authenticated;
revoke all on function public.complete_sms_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_sms_delivery(uuid, text, text) from public, anon, authenticated;
revoke all on function public.quarantine_sms_delivery(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_twilio_sms_status(text, public.sms_status, text, text) from public, anon, authenticated;
grant execute on function public.claim_sms_messages(integer) to service_role;
grant execute on function public.complete_sms_delivery(uuid, text) to service_role;
grant execute on function public.fail_sms_delivery(uuid, text, text) to service_role;
grant execute on function public.quarantine_sms_delivery(uuid, text, text) to service_role;
grant execute on function public.apply_twilio_sms_status(text, public.sms_status, text, text) to service_role;

alter table public.webhook_deliveries add column if not exists locked_at timestamptz;

create or replace function public.claim_webhook_deliveries(p_limit integer default 20)
returns table (
  delivery_id uuid,
  endpoint_id uuid,
  endpoint_url text,
  signing_secret text,
  event_type public.webhook_event,
  payload jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;

create or replace function public.finish_webhook_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_response_code integer default null,
  p_response_body text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  perform public.mark_webhook_delivery(p_delivery_id, p_success, p_response_code, p_response_body, p_error_message);
  update public.webhook_deliveries set locked_at = null where id = p_delivery_id;
end;
$$;

revoke all on function public.claim_webhook_deliveries(integer) from public, anon, authenticated;
revoke all on function public.finish_webhook_delivery(uuid, boolean, integer, text, text) from public, anon, authenticated;
grant execute on function public.claim_webhook_deliveries(integer) to service_role;
grant execute on function public.finish_webhook_delivery(uuid, boolean, integer, text, text) to service_role;

create table if not exists public.physical_mail_deliveries (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  delinquency_case_id uuid references public.delinquency_cases(id) on delete set null,
  idempotency_key text not null unique,
  description text not null check (char_length(description) between 1 and 200),
  recipient_name text not null check (char_length(recipient_name) between 1 and 200),
  address_line1 text not null,
  address_line2 text,
  address_city text not null,
  address_state text not null,
  address_zip text not null,
  address_country text not null default 'US',
  content_html text not null check (char_length(content_html) between 1 and 200000),
  mail_class text not null default 'first_class' check (mail_class in ('first_class', 'standard')),
  color boolean not null default false,
  double_sided boolean not null default true,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'submitted', 'in_transit', 'delivered', 'returned', 'failed', 'cancelled')),
  provider text,
  provider_piece_id text,
  provider_url text,
  expected_delivery_date date,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_attempt_at timestamptz,
  last_status_at timestamptz,
  error_message text,
  submitted_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_physical_mail_queue on public.physical_mail_deliveries(next_attempt_at)
  where status in ('queued', 'failed');
create index if not exists idx_physical_mail_portfolio on public.physical_mail_deliveries(portfolio_id, created_at desc);

create or replace function public.enforce_physical_mail_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  case_portfolio uuid;
  case_association uuid;
  case_owner uuid;
begin
  if new.association_id is not null and not exists (
    select 1 from public.associations association
    where association.id = new.association_id and association.portfolio_id = new.portfolio_id
  ) then
    raise exception 'physical-mail association must belong to the same portfolio';
  end if;
  if new.owner_id is not null and not exists (
    select 1 from public.owners owner
    where owner.id = new.owner_id and owner.portfolio_id = new.portfolio_id
  ) then
    raise exception 'physical-mail owner must belong to the same portfolio';
  end if;
  if new.delinquency_case_id is not null then
    select portfolio_id, association_id, owner_id into case_portfolio, case_association, case_owner
    from public.delinquency_cases where id = new.delinquency_case_id;
    if case_portfolio is null
       or case_portfolio <> new.portfolio_id
       or new.association_id is distinct from case_association
       or new.owner_id is distinct from case_owner then
      raise exception 'physical mail must match its delinquency case scope';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_physical_mail_scope on public.physical_mail_deliveries;
create trigger trg_physical_mail_scope before insert or update of portfolio_id, association_id, owner_id, delinquency_case_id
on public.physical_mail_deliveries for each row execute function public.enforce_physical_mail_scope();

drop trigger if exists trg_physical_mail_updated on public.physical_mail_deliveries;
create trigger trg_physical_mail_updated before update on public.physical_mail_deliveries
for each row execute function public.touch_updated_at();

alter table public.physical_mail_deliveries enable row level security;
create policy physical_mail_staff_read on public.physical_mail_deliveries for select to authenticated
using (public.can_access_portfolio(portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()));
create policy physical_mail_staff_insert on public.physical_mail_deliveries for insert to authenticated
  with check (
    public.can_access_portfolio(portfolio_id)
    and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
    and created_by = auth.uid()
    and status = 'queued'
    and provider is null
    and provider_piece_id is null
    and delivered_at is null
    and attempt_count = 0
    and locked_at is null
  );

create or replace function public.guard_delinquency_legal_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'legal_review' and old.status is distinct from 'legal_review' then
    if not exists (
      select 1 from public.physical_mail_deliveries mail
      where mail.delinquency_case_id = new.id and mail.status = 'delivered'
    ) then
      raise exception 'Confirmed physical notice delivery is required before legal review';
    end if;
  end if;
  if new.status = 'approved_for_counsel' and old.status is distinct from 'approved_for_counsel' then
    if old.status <> 'legal_review'
       or not (public.can_admin_portfolio(new.portfolio_id) or public.is_platform_operator())
       or new.legal_reviewed_by is distinct from auth.uid()
       or char_length(btrim(coalesce(new.legal_review_note, ''))) < 20 then
      raise exception 'A documented human portfolio-admin legal review is required';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_delinquency_legal_transition on public.delinquency_cases;
create trigger trg_delinquency_legal_transition
before update of status on public.delinquency_cases
for each row execute function public.guard_delinquency_legal_transition();

create or replace function public.claim_physical_mail(p_limit integer default 10)
returns setof public.physical_mail_deliveries
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  with candidates as (
    select id from public.physical_mail_deliveries
    where status in ('queued', 'failed') and attempt_count < 6 and next_attempt_at <= now()
      and (locked_at is null or locked_at < now() - interval '10 minutes')
    order by next_attempt_at, created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.physical_mail_deliveries mail
  set status = 'processing', locked_at = now(), last_attempt_at = now(), attempt_count = attempt_count + 1
  from candidates where mail.id = candidates.id
  returning mail.*;
end;
$$;

create or replace function public.complete_physical_mail(
  p_id uuid,
  p_provider_piece_id text,
  p_provider_url text,
  p_expected_delivery_date date
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.physical_mail_deliveries
  set status = 'submitted', provider = 'lob', provider_piece_id = left(p_provider_piece_id, 200),
      provider_url = left(p_provider_url, 1000), expected_delivery_date = p_expected_delivery_date,
      submitted_at = now(), last_status_at = now(), locked_at = null, error_message = null
  where id = p_id;
end;
$$;

create or replace function public.fail_physical_mail(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare current_attempts integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  select attempt_count into current_attempts from public.physical_mail_deliveries where id = p_id for update;
  update public.physical_mail_deliveries
  set status = 'failed', locked_at = null, error_message = left(coalesce(p_error, 'Physical-mail submission failed'), 1000),
      next_attempt_at = now() + make_interval(secs => least(power(4, greatest(current_attempts, 1))::integer * 60, 43200))
  where id = p_id;
end;
$$;

revoke all on function public.claim_physical_mail(integer) from public, anon, authenticated;
revoke all on function public.complete_physical_mail(uuid, text, text, date) from public, anon, authenticated;
revoke all on function public.fail_physical_mail(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_physical_mail(integer) to service_role;
grant execute on function public.complete_physical_mail(uuid, text, text, date) to service_role;
grant execute on function public.fail_physical_mail(uuid, text) to service_role;
grant select, insert on public.physical_mail_deliveries to authenticated;
grant all on public.physical_mail_deliveries to service_role;
