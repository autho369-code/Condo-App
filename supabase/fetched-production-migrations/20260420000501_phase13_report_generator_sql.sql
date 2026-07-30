-- =============================================================================
-- Phase 13 — Report generator: storage bucket + SQL data functions (fixed)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('reports', 'reports', false, 50 * 1024 * 1024,
   array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/json']),
  ('data-exports', 'data-exports', false, 500 * 1024 * 1024,
   array['application/zip','application/json','text/csv'])
on conflict (id) do nothing;

create policy "reports_staff_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reports'
    and (
      public.is_platform_operator()
      or (split_part(name, '/', 1)::uuid = public.current_portfolio_id() and public.is_any_staff())
    )
  );

create policy "reports_service_role_write" on storage.objects
  for all to service_role
  using (bucket_id = 'reports')
  with check (bucket_id = 'reports');

create policy "data_exports_subject_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'data-exports'
    and (
      public.is_platform_operator()
      or (split_part(name, '/', 1)::uuid = public.current_portfolio_id() and public.is_full_access_staff())
    )
  );

create policy "data_exports_service_role_write" on storage.objects
  for all to service_role
  using (bucket_id = 'data-exports')
  with check (bucket_id = 'data-exports');

create or replace function public.report_data_delinquency(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
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
        left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
        left join public.owners o on o.id = occ.owner_id
       where a.portfolio_id = p_portfolio_id
         and ub.balance > 0
    ) r;
$$;

create or replace function public.report_data_homeowner_ledger(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  t_unit uuid := (p_params->>'unit_id')::uuid;
  t_from date := coalesce((p_params->>'from_date')::date, current_date - interval '1 year');
  t_to date := coalesce((p_params->>'to_date')::date, current_date);
begin
  return (
    with events as (
      select c.due_date as event_date, 'charge'::text as kind, c.description, c.amount, 0::numeric as payment
        from public.charges c
       where c.unit_id = t_unit and c.due_date between t_from and t_to
      union all
      select p.payment_date, 'payment'::text, coalesce(p.notes, p.method), 0, p.amount
        from public.payments p
       where p.unit_id = t_unit and p.payment_date between t_from and t_to
    )
    select coalesce(jsonb_agg(to_jsonb(e.*) order by e.event_date), '[]'::jsonb) from events e
  );
end;
$$;

create or replace function public.report_data_work_orders(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  f_from date := coalesce((p_params->>'from_date')::date, current_date - interval '90 days');
  f_to date := coalesce((p_params->>'to_date')::date, current_date);
  f_status text := p_params->>'status';
begin
  return (
    select coalesce(jsonb_agg(to_jsonb(r.*) order by r.created_at desc), '[]'::jsonb)
      from (
        select w.number, w.title, w.status::text, w.priority::text, w.category::text, w.trade::text,
               a.name as association, u.unit_number, v.name as vendor,
               w.scheduled_date, w.completed_date, w.created_at, w.assigned_to
          from public.work_orders w
          left join public.associations a on a.id = w.association_id
          left join public.units u on u.id = w.unit_id
          left join public.vendors v on v.id = w.vendor_id
         where a.portfolio_id = p_portfolio_id
           and w.created_at::date between f_from and f_to
           and w.archived_at is null
           and (f_status is null or w.status::text = f_status)
      ) r
  );
end;
$$;

create or replace function public.report_data_property_directory(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.association_name, r.unit_number), '[]'::jsonb)
    from (
      select a.name as association_name, b.name as building_name, b.address as building_address,
             u.unit_number, u.bedrooms, u.bathrooms, u.sqft,
             o.full_name as primary_owner, o.email as owner_email,
             u.parking_spaces, u.storage_number
        from public.associations a
        join public.buildings b on b.association_id = a.id
        join public.units u on u.building_id = b.id
        left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
        left join public.owners o on o.id = occ.owner_id
       where a.portfolio_id = p_portfolio_id
         and a.archived_at is null
         and b.archived_at is null
         and u.archived_at is null
    ) r;
$$;

create or replace function public.report_data_vendor_directory(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.name), '[]'::jsonb)
    from (
      select v.name, v.trade::text, v.vendor_type::text,
             v.address_street, v.address_city, v.address_state, v.address_zip,
             v.send_1099,
             vc.workers_comp_expiration, vc.general_liability_expiration,
             vc.contract_expiration
        from public.vendors v
        left join public.vendor_compliance vc on vc.vendor_id = v.id
       where v.portfolio_id = p_portfolio_id
         and v.archived_at is null
    ) r;
$$;

create or replace function public.report_data_open_work_orders(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
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
         and w.archived_at is null
         and w.status in ('new','assigned','scheduled','in_progress')
    ) r;
$$;

create or replace function public.report_data_violation_log(p_portfolio_id uuid, p_params jsonb default '{}')
returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.date_observed desc), '[]'::jsonb)
    from (
      select v.title, v.violation_type::text, v.status::text,
             a.name as association, u.unit_number,
             o.full_name as owner_name,
             v.date_observed, v.due_date, v.fine_amount, v.cured_at
        from public.violations v
        join public.associations a on a.id = v.association_id
        left join public.units u on u.id = v.unit_id
        left join public.owners o on o.id = v.owner_id
       where a.portfolio_id = p_portfolio_id
         and v.archived_at is null
    ) r;
$$;

create or replace function public.report_data_dispatch(
  p_portfolio_id uuid,
  p_slug text,
  p_params jsonb default '{}'
)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  case p_slug
    when 'delinquency'         then result := public.report_data_delinquency(p_portfolio_id, p_params);
    when 'homeowner_ledger'    then result := public.report_data_homeowner_ledger(p_portfolio_id, p_params);
    when 'work_order_report'   then result := public.report_data_work_orders(p_portfolio_id, p_params);
    when 'open_work_orders'    then result := public.report_data_open_work_orders(p_portfolio_id, p_params);
    when 'property_directory'  then result := public.report_data_property_directory(p_portfolio_id, p_params);
    when 'vendor_directory'    then result := public.report_data_vendor_directory(p_portfolio_id, p_params);
    when 'violation_log'       then result := public.report_data_violation_log(p_portfolio_id, p_params);
    else
      raise exception 'report slug "%" not implemented', p_slug;
  end case;
  return result;
end;
$$;

grant execute on function public.report_data_dispatch(uuid, text, jsonb) to service_role, authenticated;
;
