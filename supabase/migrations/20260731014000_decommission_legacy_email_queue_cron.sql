-- Vercel's /api/email/process-queue route is the only supported email_queue
-- drain. The legacy Supabase Edge Function worker does not participate in the
-- durable claim/idempotency protocol and could otherwise double-send mail.
do $$
declare
  v_job record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for v_job in
    select jobid
    from cron.job
    where jobname = 'invoke-process-email-queue'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end
$$;
