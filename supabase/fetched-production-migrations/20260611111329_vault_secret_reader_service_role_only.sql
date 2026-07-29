-- Service-role-only accessor for vault secrets, so edge functions can read
-- provider API keys without redeploying env secrets. NOT callable by anon,
-- authenticated, or any client-facing role.
create or replace function public.get_vault_secret(p_name text)
returns text
language sql
security definer
set search_path to 'pg_catalog', 'vault'
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

revoke all on function public.get_vault_secret(text) from public;
revoke all on function public.get_vault_secret(text) from anon;
revoke all on function public.get_vault_secret(text) from authenticated;
grant execute on function public.get_vault_secret(text) to service_role;;
