drop function if exists public.claim_automation_flow_run(uuid, text, uuid);

create function public.claim_automation_flow_run(p_flow_id uuid, p_subject_type text, p_subject_id uuid)
returns setof public.automation_flow_runs
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if nullif(trim(p_subject_type), '') is null then raise exception 'Subject type is required'; end if;
  return query
  insert into public.automation_flow_runs
    (flow_id, subject_type, subject_id, status, attempt_count, last_attempt_at)
  values (p_flow_id, left(trim(p_subject_type), 100), p_subject_id, 'failed', 1, now())
  on conflict (flow_id, subject_type, subject_id) do update
    set status = 'failed', attempt_count = public.automation_flow_runs.attempt_count + 1, last_attempt_at = now()
    where public.automation_flow_runs.status in ('failed', 'partial')
      and public.automation_flow_runs.attempt_count < 5
      and public.automation_flow_runs.last_attempt_at < now() - interval '10 minutes'
  returning *;
end;
$$;

revoke all on function public.claim_automation_flow_run(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_automation_flow_run(uuid, text, uuid) to service_role;
