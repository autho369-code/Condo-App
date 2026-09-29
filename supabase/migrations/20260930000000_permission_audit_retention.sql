-- Permission audit log retention (decided by Mirsad 2026-09-30): keep the
-- history indefinitely. The old purge job (deleting entries older than 90
-- days) compared p.tier to 'max', which is not a portfolio_tier value, so it
-- failed daily from 2026-09-21 and never deleted anything. It is removed.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-audit-log-by-tier') then
    perform cron.unschedule('purge-audit-log-by-tier');
  end if;
end $$;
