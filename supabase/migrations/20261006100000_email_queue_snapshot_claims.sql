-- Tell retries of the sender-domain worker apart from rows attempted by the
-- worker that came before it. claim_email_queue_snapshot is used only by the
-- current worker (which records sender_address before sending); it also counts
-- its own claims. A row whose attempt_count exceeds snapshot_claims was
-- attempted by the earlier worker, which always sent from the platform
-- address, so a retry of it must keep that address. A row claimed only by the
-- current worker with no recorded sender (a crash before it was recorded)
-- chooses its sender afresh. claim_email_queue stays for the earlier worker
-- during the deploy. Additive only.

alter table public.email_queue add column if not exists snapshot_claims integer not null default 0;

create or replace function public.claim_email_queue_snapshot(p_limit integer default 10)
returns setof public.email_queue
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_limit < 1 or p_limit > 50 then raise exception 'Claim limit must be between 1 and 50'; end if;

  return query
  with due as (
    select id
    from public.email_queue
    where status in ('pending', 'failed')
      and attempt_count < 5
      and next_attempt_at <= now()
      and (processing_at is null or processing_at < now() - interval '10 minutes')
    order by next_attempt_at, created_at
    for update skip locked
    limit p_limit
  )
  update public.email_queue q
  set processing_at = now(), attempt_count = q.attempt_count + 1, snapshot_claims = q.snapshot_claims + 1,
      status = 'pending', error_message = null
  from due
  where q.id = due.id
  returning q.*;
end;
$function$;

revoke all on function public.claim_email_queue_snapshot(integer) from public, anon, authenticated;
grant execute on function public.claim_email_queue_snapshot(integer) to service_role;
