-- Partner API usage by day. api_keys kept only a lifetime use_count and
-- last_used_at, so usage_metrics.api_calls was always 0 and nobody could see
-- when or how much a key was used. verify_api_key now also counts each
-- authenticated request per key per UTC day; the nightly usage job sums the
-- month into usage_metrics.api_calls (shown on the operator Usage Trends page)
-- and the Developer Hub shows each key's last-30-day calls.

create table if not exists public.api_key_usage_daily (
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  usage_date date not null,
  request_count bigint not null default 0,
  primary key (api_key_id, usage_date)
);

create index if not exists api_key_usage_daily_portfolio_date_idx
  on public.api_key_usage_daily (portfolio_id, usage_date);

alter table public.api_key_usage_daily enable row level security;

-- Read-only to the people who can already see the keys; only verify_api_key
-- (SECURITY DEFINER) writes.
create policy api_key_usage_daily_admin_read on public.api_key_usage_daily
  for select to authenticated using (public.can_admin_portfolio(portfolio_id));
create policy api_key_usage_daily_platform_read on public.api_key_usage_daily
  for select to authenticated using (public.is_platform_operator());

revoke all on public.api_key_usage_daily from anon, authenticated;
grant select on public.api_key_usage_daily to authenticated;

create or replace function public.verify_api_key(p_raw_key text)
returns table(portfolio_id uuid, key_id uuid, scopes text[])
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  k_hash text;
  k_row public.api_keys;
begin
  if p_raw_key is null or length(p_raw_key) < 16 then
    return;
  end if;

  k_hash := encode(extensions.digest(p_raw_key, 'sha256'), 'hex');

  select * into k_row
    from public.api_keys
   where key_hash = k_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
   limit 1;

  if not found then
    return;
  end if;

  update public.api_keys
     set last_used_at = now(), use_count = use_count + 1
   where id = k_row.id;

  -- Per-day count (UTC days, like the monthly usage job).
  insert into public.api_key_usage_daily (api_key_id, portfolio_id, usage_date, request_count)
  values (k_row.id, k_row.portfolio_id, (now() at time zone 'UTC')::date, 1)
  on conflict (api_key_id, usage_date)
  do update set request_count = public.api_key_usage_daily.request_count + 1;

  portfolio_id := k_row.portfolio_id;
  key_id := k_row.id;
  scopes := k_row.scopes;
  return next;
end;
$function$;

revoke execute on function public.verify_api_key(text) from public, anon, authenticated;

-- Same as 20261006030000, plus api_calls from the daily counts.
create or replace function public.aggregate_usage_metrics(p_year integer, p_month integer)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  period_start timestamptz := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  period_end timestamptz := period_start + interval '1 month';
  -- Level counts are a point-in-time picture: only the month in progress takes today's.
  month_open boolean := now() < period_end;
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
    coalesce((select count(*) from public.profiles where portfolio_id = p.id and hoa_role in ('manager', 'company_admin')), 0),
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
    coalesce((select sum(d.request_count) from public.api_key_usage_daily d
              where d.portfolio_id = p.id
                and d.usage_date >= period_start::date and d.usage_date < period_end::date), 0)
  from public.portfolios p
  where p.archived_at is null
    and p.created_at < period_end
  on conflict (portfolio_id, period_year, period_month) do update set
    staff_count = case when month_open then excluded.staff_count else public.usage_metrics.staff_count end,
    owner_count = case when month_open then excluded.owner_count else public.usage_metrics.owner_count end,
    association_count = case when month_open then excluded.association_count else public.usage_metrics.association_count end,
    unit_count = case when month_open then excluded.unit_count else public.usage_metrics.unit_count end,
    work_orders_created = excluded.work_orders_created,
    service_requests_created = excluded.service_requests_created,
    bills_posted = excluded.bills_posted,
    payments_received = excluded.payments_received,
    emails_sent = excluded.emails_sent,
    sms_sent = excluded.sms_sent,
    api_calls = excluded.api_calls,
    updated_at = now();
end;
$function$;

revoke execute on function public.aggregate_usage_metrics(integer, integer) from public, anon, authenticated;

select public.aggregate_usage_metrics(extract(year from now())::int, extract(month from now())::int);
