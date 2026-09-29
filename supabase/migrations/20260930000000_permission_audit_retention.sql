-- Permission audit log retention (decided by Mirsad 2026-09-29):
-- keep 2 years for every portfolio, 7 years for Enterprise.
-- The previous job compared p.tier to 'max', which is not a portfolio_tier
-- value, so it failed daily from 2026-09-21 and deleted nothing.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-audit-log-by-tier') then
    perform cron.unschedule('purge-audit-log-by-tier');
  end if;
end $$;

select cron.schedule('purge-audit-log-by-tier', '45 4 * * *', $job$
  delete from public.permission_audit_log pal
   where pal.at < now() - case
     when exists (
       select 1 from public.portfolios p
        where p.id = pal.actor_portfolio_id
          and p.tier = 'enterprise'::public.portfolio_tier
     ) then interval '7 years'
     else interval '2 years'
   end;
$job$);
