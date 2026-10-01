-- Retire legacy pg_cron workers that duplicate the Vercel crons.
--
-- run-autopay-mandates-daily (09:00 UTC) ran public.run_autopay_mandates(),
-- which inserts a 'pending' payment_intents row that nothing sends to Stripe
-- and then advances autopay_mandates.next_run_date. The Stripe AutoPay cron
-- (/api/payments/autopay-run, 14:00 UTC) selects next_run_date <= today, so it
-- found nothing: AutoPay would never have charged anyone. (No mandates exist
-- yet, so nothing was affected.)
--
-- invoke-process-sms-queue, invoke-webhook-dispatcher and invoke-generate-report
-- call edge functions that read 'queued'/'pending' rows without claiming them,
-- racing the app workers (/api/sms/deliver, /api/webhooks/deliver,
-- /api/reports/run-scheduled + inline processing) that claim rows atomically:
-- texts and webhooks could be sent twice, and the edge report worker always
-- writes CSV, overwriting PDF/XLSX runs. The email edge worker was retired the
-- same way earlier.
do $$
declare
  j text;
begin
  foreach j in array array[
    'run-autopay-mandates-daily',
    'invoke-process-sms-queue',
    'invoke-webhook-dispatcher',
    'invoke-generate-report'
  ] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end $$;

-- Keep the legacy function from being run by hand: it can only do harm now.
revoke all on function public.run_autopay_mandates() from public, anon, authenticated;
