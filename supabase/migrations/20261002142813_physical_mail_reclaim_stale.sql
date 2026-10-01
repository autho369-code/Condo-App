-- claim_physical_mail set rows to 'processing' but only ever re-claimed
-- 'queued'/'failed' rows. A delivery run that timed out (10 letters x 15s
-- under a 60s function limit) left the rest of its batch in 'processing'
-- forever: collection letters silently never mailed. Stale 'processing' rows
-- (locked over 10 minutes ago) are now re-claimed; Lob's idempotency key
-- makes a re-submission safe.
create or replace function public.claim_physical_mail(p_limit integer default 10)
 returns setof public.physical_mail_deliveries
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  with candidates as (
    select id from public.physical_mail_deliveries
    where attempt_count < 6
      and (
        (status in ('queued', 'failed') and next_attempt_at <= now()
          and (locked_at is null or locked_at < now() - interval '10 minutes'))
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by next_attempt_at, created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.physical_mail_deliveries mail
  set status = 'processing', locked_at = now(), last_attempt_at = now(), attempt_count = attempt_count + 1
  from candidates where mail.id = candidates.id
  returning mail.*;
end;
$function$;
