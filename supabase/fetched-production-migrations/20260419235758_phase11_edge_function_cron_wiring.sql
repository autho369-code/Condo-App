-- =============================================================================
-- Phase 11 — Edge function cron wiring
-- invoke_edge_function() reads `project_url` and `service_role_key` from
-- Supabase Vault so the service key is never hardcoded in a migration or
-- cron definition. If either secret is missing the helper no-ops gracefully.
-- =============================================================================

create or replace function public.invoke_edge_function(
  fn_name text,
  body jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, vault, extensions
as $$
declare
  url_secret text;
  key_secret text;
  request_id bigint;
begin
  select decrypted_secret into url_secret from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into key_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if url_secret is null or key_secret is null then
    raise notice 'invoke_edge_function: vault secrets project_url and/or service_role_key not configured — skipping %', fn_name;
    return null;
  end if;

  select extensions.http_post(
    url := rtrim(url_secret, '/') || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || key_secret
    ),
    body := body
  ) into request_id;
  return request_id;
end;
$$;

comment on function public.invoke_edge_function(text, jsonb) is 'Posts to an edge function using URL + service key stored in Supabase Vault. Requires vault secrets named "project_url" (e.g. https://<ref>.supabase.co) and "service_role_key".';

-- Schedule webhook delivery every minute
select cron.schedule(
  'invoke-webhook-dispatcher',
  '* * * * *',
  $$ select public.invoke_edge_function('webhook-dispatcher'); $$
);

-- Drain email queue every 2 minutes
select cron.schedule(
  'invoke-process-email-queue',
  '*/2 * * * *',
  $$ select public.invoke_edge_function('process-email-queue'); $$
);

-- One-shot setup helper so the user can populate the secrets easily
create or replace function public.setup_edge_function_secrets(
  p_project_url text,
  p_service_role_key text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  existing_url_id uuid;
  existing_key_id uuid;
begin
  -- Refuse unless caller is a platform admin or running as service role
  if not (public.is_platform_operator() or current_user = 'service_role') then
    raise exception 'setup_edge_function_secrets: platform operator or service_role required';
  end if;

  select id into existing_url_id from vault.secrets where name = 'project_url';
  select id into existing_key_id from vault.secrets where name = 'service_role_key';

  if existing_url_id is null then
    perform vault.create_secret(p_project_url, 'project_url', 'Supabase project URL for edge function invocation');
  else
    perform vault.update_secret(existing_url_id, p_project_url);
  end if;

  if existing_key_id is null then
    perform vault.create_secret(p_service_role_key, 'service_role_key', 'Supabase service role key for edge function invocation');
  else
    perform vault.update_secret(existing_key_id, p_service_role_key);
  end if;

  return 'secrets configured';
end;
$$;

grant execute on function public.setup_edge_function_secrets(text, text) to service_role;
comment on function public.setup_edge_function_secrets(text, text) is 'One-shot setup for the edge function cron system. Call via service_role (e.g., from a one-time psql session or a Supabase SQL Editor query) to populate project_url and service_role_key Vault secrets.';
;
