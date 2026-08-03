-- Atomic staff intake for owner- and tenant-submitted service requests.
-- Prevents duplicate work orders when two managers triage the same request.
create or replace function public.triage_service_request_to_work_order(
  p_service_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $function$
declare
  v_request public.service_requests%rowtype;
  v_work_order_id uuid;
  v_requestor text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_service_request_id is null then
    raise exception 'Service request is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_service_request_id::text, 0));

  select * into v_request
  from public.service_requests sr
  where sr.id = p_service_request_id
    and sr.archived_at is null
  for update;

  if not found then
    raise exception 'Service request not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_request.portfolio_id)
      and public.can_access_association(v_request.association_id)
    )
  ) then
    raise exception 'Not authorized for this service request' using errcode = '42501';
  end if;

  select wo.id into v_work_order_id
  from public.work_orders wo
  where wo.service_request_id = v_request.id
    and wo.archived_at is null
  order by wo.created_at, wo.id
  limit 1;
  if v_work_order_id is not null then
    return v_work_order_id;
  end if;

  if v_request.status in ('completed', 'cancelled') then
    raise exception 'Only open service requests can be triaged' using errcode = '23514';
  end if;

  v_requestor := case when v_request.tenant_id is not null then 'Resident portal' else 'Owner portal' end;

  insert into public.work_orders (
    portfolio_id,
    association_id,
    unit_id,
    service_request_id,
    title,
    issue,
    description,
    category,
    priority,
    requested_by,
    status,
    created_by
  ) values (
    v_request.portfolio_id,
    v_request.association_id,
    v_request.unit_id,
    v_request.id,
    left(regexp_replace(v_request.description, E'[\\n\\r]+', ' ', 'g'), 80),
    v_request.description,
    v_request.description,
    'other',
    v_request.priority::text::public.work_order_priority,
    v_requestor,
    'new',
    auth.uid()
  ) returning id into v_work_order_id;

  insert into public.work_order_updates (
    work_order_id,
    note,
    new_status,
    created_by
  ) values (
    v_work_order_id,
    'Created from service request ' || coalesce(v_request.number, left(v_request.id::text, 8)),
    'new',
    auth.uid()
  );

  update public.service_requests
  set status = 'waiting', updated_at = now()
  where id = v_request.id;

  return v_work_order_id;
end;
$function$;

alter function public.triage_service_request_to_work_order(uuid) owner to postgres;
revoke all on function public.triage_service_request_to_work_order(uuid) from public, anon;
grant execute on function public.triage_service_request_to_work_order(uuid) to authenticated, service_role;
