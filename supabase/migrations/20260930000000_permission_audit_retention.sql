-- Permission audit log retention: keep INDEFINITELY (decided by Mirsad
-- 2026-09-29). The old purge job (which compared portfolios.tier to the
-- invalid value 'max' and failed daily from 2026-09-21, deleting nothing) is
-- removed and no purge job replaces it.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-audit-log-by-tier') then
    perform cron.unschedule('purge-audit-log-by-tier');
  end if;
end $$;
