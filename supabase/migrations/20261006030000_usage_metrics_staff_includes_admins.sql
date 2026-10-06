-- Usage metrics fixes for the new operator Usage Trends page:
--  * Staff counted only 'manager' profiles, so a company run by its company
--    admin showed 0 staff. Staff now means managers and company admins, the
--    same definition the operator Platform Intelligence page uses.
--  * Archived companies (all logins disabled) kept getting a row every night
--    and inflated the totals; companies created after the month don't get one.
--  * Re-running a closed month (the job does on the 1st-3rd) overwrote its
--    level counts (staff, owners, associations, doors) with today's numbers.
--    A closed month now only refreshes its activity counts; levels stay as
--    they were captured during the month.
-- Only the current month is refreshed here.

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
    0
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
    updated_at = now();
end;
$function$;

revoke execute on function public.aggregate_usage_metrics(integer, integer) from public, anon, authenticated;

select public.aggregate_usage_metrics(extract(year from now())::int, extract(month from now())::int);
