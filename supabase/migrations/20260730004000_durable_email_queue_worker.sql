-- Durable queue claiming and delivery completion for the Vercel email worker.

alter table public.email_queue
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists processing_at timestamptz,
  add column if not exists provider_message_id text;

alter table public.email_queue
  drop constraint if exists email_queue_attempt_count_check;
alter table public.email_queue
  add constraint email_queue_attempt_count_check check (attempt_count between 0 and 5);

create index if not exists email_queue_delivery_due_idx
  on public.email_queue (next_attempt_at, created_at)
  where status in ('pending', 'failed') and attempt_count < 5;

create or replace function public.claim_email_queue(p_limit integer default 10)
returns setof public.email_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_limit < 1 or p_limit > 50 then raise exception 'Claim limit must be between 1 and 50'; end if;

  return query
  with due as (
    select id
    from public.email_queue
    where status in ('pending', 'failed')
      and attempt_count < 5
      and next_attempt_at <= now()
      and (processing_at is null or processing_at < now() - interval '10 minutes')
    order by next_attempt_at, created_at
    for update skip locked
    limit p_limit
  )
  update public.email_queue q
  set processing_at = now(), attempt_count = q.attempt_count + 1, status = 'pending', error_message = null
  from due
  where q.id = due.id
  returning q.*;
end;
$$;

create or replace function public.complete_email_delivery(p_email_id uuid, p_provider_message_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_message_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.email_queue
  set status = 'sent', sent_at = now(), processing_at = null,
      provider_message_id = nullif(left(trim(p_provider_message_id), 500), ''), error_message = null
  where id = p_email_id and status = 'pending' and processing_at is not null
  returning communication_message_id into v_message_id;
  if not found then return false; end if;

  if v_message_id is not null and not exists (
    select 1 from public.email_queue
    where communication_message_id = v_message_id and status <> 'sent'
  ) then
    update public.communication_messages
    set status = 'sent', sent_at = now(), error_message = null, updated_at = now()
    where id = v_message_id;
  end if;
  return true;
end;
$$;

create or replace function public.fail_email_delivery(p_email_id uuid, p_error text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt integer; v_message_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.email_queue
  set status = 'failed', processing_at = null,
      error_message = left(coalesce(nullif(trim(p_error), ''), 'Email provider error'), 2000),
      next_attempt_at = now() + case attempt_count
        when 1 then interval '1 minute'
        when 2 then interval '5 minutes'
        when 3 then interval '25 minutes'
        else interval '2 hours'
      end
  where id = p_email_id and status = 'pending' and processing_at is not null
  returning attempt_count, communication_message_id into v_attempt, v_message_id;
  if not found then return false; end if;

  if v_attempt >= 5 and v_message_id is not null then
    update public.communication_messages
    set status = 'failed', error_message = left(coalesce(nullif(trim(p_error), ''), 'Email provider error'), 2000), updated_at = now()
    where id = v_message_id;
  end if;
  return true;
end;
$$;

revoke all on function public.claim_email_queue(integer) from public, anon, authenticated;
revoke all on function public.complete_email_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_email_delivery(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_email_queue(integer) to service_role;
grant execute on function public.complete_email_delivery(uuid, text) to service_role;
grant execute on function public.fail_email_delivery(uuid, text) to service_role;
