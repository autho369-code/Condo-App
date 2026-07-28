-- Close cross-tenant gaps in queued report generation.
--
-- Production evidence (2026-07-28) showed that report_data_* SECURITY DEFINER
-- functions were executable by PUBLIC/anon/authenticated and that the owner
-- ledger helper accepted a unit UUID without proving portfolio ownership.
-- The UI also sends date_from/date_to while older bulk code sends
-- date_start/date_end; the original helper read only from_date/to_date.

create or replace function public.report_data_homeowner_ledger(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t_unit uuid;
  t_from date;
  t_to date;
begin
  begin
    t_unit := nullif(p_params->>'unit_id', '')::uuid;
    t_from := coalesce(
      nullif(p_params->>'date_from', '')::date,
      nullif(p_params->>'from_date', '')::date,
      nullif(p_params->>'date_start', '')::date,
      current_date - interval '1 year'
    );
    t_to := coalesce(
      nullif(p_params->>'date_to', '')::date,
      nullif(p_params->>'to_date', '')::date,
      nullif(p_params->>'date_end', '')::date,
      current_date
    );
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'invalid owner-ledger report parameters';
  end;

  if t_unit is null or not exists (
    select 1
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
    where u.id = t_unit
      and a.portfolio_id = p_portfolio_id
      and u.archived_at is null
      and b.archived_at is null
      and a.archived_at is null
  ) then
    raise exception 'unit is not accessible for this portfolio';
  end if;

  if t_from > t_to then
    raise exception 'report start date must not be after end date';
  end if;

  return (
    with events as (
      select c.due_date as event_date,
             'charge'::text as kind,
             c.description,
             c.amount,
             0::numeric as payment
      from public.charges c
      where c.unit_id = t_unit
        and c.due_date between t_from and t_to

      union all

      select p.payment_date,
             'payment'::text,
             coalesce(p.notes, p.method),
             0,
             p.amount
      from public.payments p
      where p.unit_id = t_unit
        and p.payment_date between t_from and t_to
    )
    select coalesce(jsonb_agg(to_jsonb(e.*) order by e.event_date), '[]'::jsonb)
    from events e
  );
end;
$function$;

revoke all on function public.report_data_homeowner_ledger(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.report_data_homeowner_ledger(uuid, jsonb)
  to service_role;

create or replace function public.bulk_queue_reports(
  p_association_ids uuid[],
  p_report_slugs text[],
  p_scope text default 'association'::text,
  p_date_start date default null::date,
  p_date_end date default null::date,
  p_output_format text default 'csv'::text
)
returns table(queued_count integer, run_ids uuid[])
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_assoc_id uuid;
  v_slug text;
  v_def_id uuid;
  v_created_by uuid := auth.uid();
  v_portfolio_id uuid;
  v_fmt public.report_format;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
begin
  if v_created_by is null then
    raise exception 'authentication required';
  end if;

  if not public.is_any_staff() then
    raise exception 'staff access required';
  end if;

  select p.portfolio_id
  into v_portfolio_id
  from public.profiles p
  where p.id = v_created_by;

  if v_portfolio_id is null or not public.can_access_portfolio(v_portfolio_id) then
    raise exception 'cannot determine an authorized portfolio';
  end if;

  if coalesce(cardinality(p_association_ids), 0) = 0
     or coalesce(cardinality(p_report_slugs), 0) = 0 then
    raise exception 'at least one association and report are required';
  end if;

  if exists (
    select 1
    from unnest(p_association_ids) requested(id)
    left join public.associations a on a.id = requested.id
    where a.id is null
       or a.portfolio_id <> v_portfolio_id
       or a.archived_at is not null
  ) then
    raise exception 'one or more associations are outside the authorized portfolio';
  end if;

  begin
    v_fmt := p_output_format::public.report_format;
  exception when invalid_text_representation then
    raise exception 'unsupported report output format';
  end;

  foreach v_assoc_id in array p_association_ids loop
    foreach v_slug in array p_report_slugs loop
      select id
      into v_def_id
      from public.report_definitions
      where slug = v_slug
        and active = true
        and (portfolio_id is null or portfolio_id = v_portfolio_id);

      if v_def_id is null then
        raise exception 'report slug "%" is not available for this portfolio', v_slug;
      end if;

      insert into public.report_runs (
        definition_id,
        portfolio_id,
        parameters,
        output_format,
        status,
        triggered_by
      ) values (
        v_def_id,
        v_portfolio_id,
        jsonb_build_object(
          'scope', p_scope,
          'association_id', v_assoc_id,
          'date_from', p_date_start,
          'date_to', p_date_end
        ),
        v_fmt,
        'queued',
        v_created_by
      )
      returning id into new_id;

      new_ids := array_append(new_ids, new_id);
      cnt := cnt + 1;
    end loop;
  end loop;

  return query select cnt, new_ids;
end;
$function$;

revoke all on function public.bulk_queue_reports(uuid[], text[], text, date, date, text)
  from public, anon;
grant execute on function public.bulk_queue_reports(uuid[], text[], text, date, date, text)
  to authenticated, service_role;

-- Re-assert the service-only boundary for every elevated report data helper.
do $block$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_catalog.left(p.proname, 12) = 'report_data_'
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated',
      v_function
    );
    execute pg_catalog.format(
      'grant execute on function %s to service_role',
      v_function
    );
  end loop;
end;
$block$;

