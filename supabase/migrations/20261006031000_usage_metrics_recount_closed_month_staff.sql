-- Closed months in usage_metrics were captured with the old managers-only
-- staff count (20261006030000 counts managers and company admins). Recount
-- them once under the new definition — staff accounts that existed by the end
-- of that month — so month-over-month staff changes on the operator Usage
-- Trends page compare like with like. Closed months are never recounted by the
-- nightly job, so this runs once.
update public.usage_metrics um
   set staff_count = (select count(*) from public.profiles pr
                       where pr.portfolio_id = um.portfolio_id
                         and pr.hoa_role in ('manager', 'company_admin')
                         and pr.created_at < make_timestamptz(um.period_year, um.period_month, 1, 0, 0, 0, 'UTC') + interval '1 month'),
       updated_at = now()
 where make_timestamptz(um.period_year, um.period_month, 1, 0, 0, 0, 'UTC') + interval '1 month' <= now();
