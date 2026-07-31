alter table public.automation_flow_runs
  add column if not exists attempt_count integer not null default 1,
  add column if not exists last_attempt_at timestamptz not null default now();

alter table public.automation_flow_runs drop constraint if exists automation_flow_runs_attempt_count_check;
alter table public.automation_flow_runs add constraint automation_flow_runs_attempt_count_check
  check (attempt_count between 1 and 5);

create or replace function public.claim_automation_flow_run(p_flow_id uuid, p_subject_type text, p_subject_id uuid)
returns public.automation_flow_runs
language plpgsql security definer set search_path = ''
as $$
declare v_run public.automation_flow_runs;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if nullif(trim(p_subject_type), '') is null then raise exception 'Subject type is required'; end if;
  insert into public.automation_flow_runs
    (flow_id, subject_type, subject_id, status, attempt_count, last_attempt_at)
  values (p_flow_id, left(trim(p_subject_type), 100), p_subject_id, 'failed', 1, now())
  on conflict (flow_id, subject_type, subject_id) do update
    set status = 'failed', attempt_count = public.automation_flow_runs.attempt_count + 1, last_attempt_at = now()
    where public.automation_flow_runs.status in ('failed', 'partial')
      and public.automation_flow_runs.attempt_count < 5
  returning * into v_run;
  return v_run;
end;
$$;

revoke all on function public.claim_automation_flow_run(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_automation_flow_run(uuid, text, uuid) to service_role;
