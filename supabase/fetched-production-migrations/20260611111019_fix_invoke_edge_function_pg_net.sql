-- invoke_edge_function previously called extensions.http_post(), which does not
-- exist (pg_net exposes net.http_post). Every cron-driven edge function
-- invocation has been erroring as a result. Switch to net.http_post.
create or replace function public.invoke_edge_function(fn_name text, body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'vault', 'extensions', 'net'
as $function$
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

  select net.http_post(
    url := rtrim(url_secret, '/') || '/functions/v1/' || fn_name,
    body := body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || key_secret
    ),
    timeout_milliseconds := 30000
  ) into request_id;
  return request_id;
end;
$function$;;
