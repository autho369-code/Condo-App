-- Schedule email queue processing every 2 minutes
SELECT cron.schedule(
  'process-email-queue-every-2min',
  '*/2 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://termxngysvotnfbzbgrv.supabase.co/functions/v1/process-email-queue',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTAyMjQ0OSwiZXhwIjoyMDYwNTk4NDQ5fQ.NOjy4T-FWsC8EsFJR4CsajtxKk_gJpwAoHsdvV_RhsU", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
