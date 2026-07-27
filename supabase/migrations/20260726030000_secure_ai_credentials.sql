-- Portfolio AI credentials must never be persisted or returned as plaintext.
-- The application encrypts API keys with AES-256-GCM before writing this field.
alter table public.portfolios
  add column if not exists ai_api_key_ciphertext text;

comment on column public.portfolios.ai_api_key_ciphertext is
  'Application-encrypted BYO AI credential (AES-256-GCM envelope); never plaintext.';

-- Existing plaintext keys cannot be safely converted without the deployment
-- encryption key. Fail closed and require an authorized portfolio admin to
-- re-enter the key after deployment.
update public.portfolios
set ai_api_key = null,
    ai_endpoint = null,
    ai_provider = case
      when ai_provider in ('openai', 'deepseek', 'anthropic') then ai_provider
      else null
    end,
    ai_model = case
      when ai_provider in ('openai', 'deepseek', 'anthropic') then ai_model
      else null
    end
where ai_api_key is not null
   or ai_endpoint is not null
   or ai_provider not in ('openai', 'deepseek', 'anthropic');

create or replace function public.reject_plaintext_ai_credentials()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public'
as $$
begin
  if new.ai_api_key is not null then
    raise exception 'plaintext AI credentials are disabled';
  end if;
  if new.ai_endpoint is not null then
    raise exception 'tenant-controlled AI endpoints are disabled';
  end if;
  if new.ai_provider is not null
     and new.ai_provider not in ('openai', 'deepseek', 'anthropic') then
    raise exception 'unsupported AI provider';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolios_reject_plaintext_ai_credentials on public.portfolios;
create trigger portfolios_reject_plaintext_ai_credentials
before insert or update
on public.portfolios
for each row execute function public.reject_plaintext_ai_credentials();

-- This function is a trigger implementation, never a client-callable RPC.
revoke all on function public.reject_plaintext_ai_credentials() from public, anon, authenticated;
grant execute on function public.reject_plaintext_ai_credentials() to service_role;
