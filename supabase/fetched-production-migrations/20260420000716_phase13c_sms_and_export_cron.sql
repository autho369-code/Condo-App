-- Schedule the new processors
select cron.schedule(
  'invoke-process-sms-queue',
  '*/2 * * * *',
  $$ select public.invoke_edge_function('process-sms-queue'); $$
);

select cron.schedule(
  'invoke-data-export-builder',
  '*/5 * * * *',
  $$ select public.invoke_edge_function('data-export-builder'); $$
);

-- Convenience RPC: authenticated users request a data export
create or replace function public.request_data_export(
  p_portfolio_id uuid,
  p_scope public.export_scope default 'portfolio_full',
  p_format text default 'json'
)
returns public.data_export_requests
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  row public.data_export_requests;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'request_data_export: portfolio admin required';
  end if;
  if not public.has_entitlement(p_portfolio_id, 'data_export') then
    raise exception 'request_data_export: data_export entitlement required (upgrade to Max tier)';
  end if;

  insert into public.data_export_requests (
    portfolio_id, scope, format, requested_by
  ) values (
    p_portfolio_id, p_scope, p_format, auth.uid()
  ) returning * into row;
  return row;
end;
$$;

grant execute on function public.request_data_export(uuid, public.export_scope, text) to authenticated;
;
