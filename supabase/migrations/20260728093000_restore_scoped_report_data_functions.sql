
-- Restore the queued-report data functions that exist in production but were
-- absent from source control. Production definitions were recovered read-only
-- with pg_get_functiondef on 2026-07-28. This forward migration also honors
-- the association_id supplied by association-scoped report runs.

create or replace function public.report_data_delinquency(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.balance desc), '[]'::jsonb)
  from (
    select a.name as association_name,
           u.unit_number,
           o.full_name as homeowner,
           o.email as homeowner_email,
           ub.balance,
           du.oldest_due as oldest_due_date,
           (current_date - du.oldest_due) as days_past_due
    from public.unit_balances ub
    join public.units u on u.id = ub.unit_id
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
    left join lateral (
      select min(c.due_date) as oldest_due
      from public.charges c
      where c.unit_id = ub.unit_id and c.due_date < current_date
      group by c.unit_id
    ) du on true
    left join public.occupancies occ
      on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
    left join public.owners o on o.id = occ.owner_id
    where a.portfolio_id = p_portfolio_id
      and (nullif(p_params->>'association_id', '') is null
           or a.id = (p_params->>'association_id')::uuid)
      and ub.balance > 0
  ) r;
$function$;

create or replace function public.report_data_open_work_orders(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.priority desc, r.created_at), '[]'::jsonb)
  from (
    select w.number, w.title, w.status::text, w.priority::text,
           a.name as association, u.unit_number, v.name as vendor,
           w.scheduled_date, w.created_at,
           (current_date - w.created_at::date) as age_days
    from public.work_orders w
    join public.associations a on a.id = w.association_id
    left join public.units u on u.id = w.unit_id
    left join public.vendors v on v.id = w.vendor_id
    where a.portfolio_id = p_portfolio_id
      and (nullif(p_params->>'association_id', '') is null
           or a.id = (p_params->>'association_id')::uuid)
      and w.archived_at is null
      and w.status in ('new', 'assigned', 'scheduled', 'in_progress')
  ) r;
$function$;

create or replace function public.report_data_property_directory(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association_name, r.unit_number), '[]'::jsonb)
  from (
    select a.name as association_name, b.name as building_name,
           b.address as building_address, u.unit_number, u.bedrooms,
           u.bathrooms, u.sqft, o.full_name as primary_owner,
           o.email as owner_email, u.parking_spaces, u.storage_number
    from public.associations a
    join public.buildings b on b.association_id = a.id
    join public.units u on u.building_id = b.id
    left join public.occupancies occ
      on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
    left join public.owners o on o.id = occ.owner_id
    where a.portfolio_id = p_portfolio_id
      and (nullif(p_params->>'association_id', '') is null
           or a.id = (p_params->>'association_id')::uuid)
      and a.archived_at is null
      and b.archived_at is null
      and u.archived_at is null
  ) r;
$function$;

create or replace function public.report_data_vendor_1099(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select public.assemble_vendor_1099_data(
    p_portfolio_id,
    coalesce((p_params->>'tax_year')::integer,
             extract(year from (now() - interval '1 year'))::integer)
  );
$function$;

create or replace function public.report_data_vendor_directory(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.name), '[]'::jsonb)
  from (
    select v.name, v.trade::text, v.vendor_type::text,
           v.address_street, v.address_city, v.address_state, v.address_zip,
           v.send_1099, vc.workers_comp_expiration,
           vc.general_liability_expiration, vc.contract_expiration
    from public.vendors v
    left join public.vendor_compliance vc on vc.vendor_id = v.id
    where v.portfolio_id = p_portfolio_id
      and v.archived_at is null
  ) r;
$function$;

create or replace function public.report_data_violation_log(
  p_portfolio_id uuid,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.date_observed desc), '[]'::jsonb)
  from (
    select v.title, v.violation_type::text, v.status::text,
           a.name as association, u.unit_number, o.full_name as owner_name,
           v.date_observed, v.due_date, v.fine_amount, v.cured_at
    from public.violations v
    join public.associations a on a.id = v.association_id
    left join public.units u on u.id = v.unit_id
    left join public.owners o on o.id = v.owner_id
    where a.portfolio_id = p_portfolio_id
      and (nullif(p_params->>'association_id', '') is null
           or a.id = (p_params->>'association_id')::uuid)
      and v.archived_at is null
  ) r;
$function$;

create or replace function public.report_data_work_orders(
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
  f_from date;
  f_to date;
  f_status text := nullif(p_params->>'status', '');
  f_association uuid;
begin
  begin
    f_from := coalesce(
      nullif(p_params->>'date_from', '')::date,
      nullif(p_params->>'from_date', '')::date,
      nullif(p_params->>'date_start', '')::date,
      current_date - interval '90 days'
    );
    f_to := coalesce(
      nullif(p_params->>'date_to', '')::date,
      nullif(p_params->>'to_date', '')::date,
      nullif(p_params->>'date_end', '')::date,
      current_date
    );
    f_association := nullif(p_params->>'association_id', '')::uuid;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'invalid work-order report parameters';
  end;

  if f_from > f_to then
    raise exception 'report start date must not be after end date';
  end if;

  if f_association is not null and not exists (
    select 1 from public.associations a
    where a.id = f_association
      and a.portfolio_id = p_portfolio_id
      and a.archived_at is null
  ) then
    raise exception 'association is not accessible for this portfolio';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(r.*) order by r.created_at desc), '[]'::jsonb)
    from (
      select w.number, w.title, w.status::text, w.priority::text,
             w.category::text, w.trade::text, a.name as association,
             u.unit_number, v.name as vendor, w.scheduled_date,
             w.completed_date, w.created_at, w.assigned_to
      from public.work_orders w
      join public.associations a on a.id = w.association_id
      left join public.units u on u.id = w.unit_id
      left join public.vendors v on v.id = w.vendor_id
      where a.portfolio_id = p_portfolio_id
        and (f_association is null or a.id = f_association)
        and w.created_at::date between f_from and f_to
        and w.archived_at is null
        and (f_status is null or w.status::text = f_status)
    ) r
  );
end;
$function$;

create or replace function public.report_data_dispatch(
  p_portfolio_id uuid,
  p_slug text,
  p_params jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  case p_slug
    when 'delinquency' then return public.report_data_delinquency(p_portfolio_id, p_params);
    when 'homeowner_ledger' then return public.report_data_homeowner_ledger(p_portfolio_id, p_params);
    when 'work_order_report' then return public.report_data_work_orders(p_portfolio_id, p_params);
    when 'open_work_orders' then return public.report_data_open_work_orders(p_portfolio_id, p_params);
    when 'property_directory' then return public.report_data_property_directory(p_portfolio_id, p_params);
    when 'vendor_directory' then return public.report_data_vendor_directory(p_portfolio_id, p_params);
    when 'violation_log' then return public.report_data_violation_log(p_portfolio_id, p_params);
    when 'vendor_1099_detail' then return public.report_data_vendor_1099(p_portfolio_id, p_params);
    when 'vendor_1099_summary' then return public.report_data_vendor_1099(p_portfolio_id, p_params);
    else raise exception 'report slug "%" not implemented', p_slug;
  end case;
end;
$function$;

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
