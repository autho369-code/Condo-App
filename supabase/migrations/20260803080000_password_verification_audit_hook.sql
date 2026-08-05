-- Audit password verification at the Supabase Auth boundary. Application-only
-- logging can be bypassed by calling GoTrue directly with the public key.

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid;
  v_valid boolean;
  v_email text;
  v_portfolio_id uuid;
begin
  v_user_id := (event->>'user_id')::uuid;
  v_valid := coalesce((event->>'valid')::boolean, false);

  select u.email
    into v_email
    from auth.users u
   where u.id = v_user_id;

  select p.portfolio_id
    into v_portfolio_id
    from public.profiles p
   where p.id = v_user_id;

  insert into public.login_attempts (
    email,
    auth_user_id,
    portfolio_id,
    success,
    failure_reason,
    mfa_used
  ) values (
    lower(v_email),
    v_user_id,
    v_portfolio_id,
    v_valid,
    case when v_valid then null else 'invalid_credentials' end,
    false
  );

  if v_valid then
    update public.profiles
       set last_login_at = now(), updated_at = now()
     where id = v_user_id;
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

alter function public.hook_password_verification_attempt(jsonb) owner to postgres;
revoke all on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;

comment on function public.hook_password_verification_attempt(jsonb) is
  'Supabase Auth password-verification hook. Records direct and application sign-in attempts and always returns continue.';

-- When the application sign-in action follows the Auth hook, enrich its recent
-- hook row with trusted edge context instead of writing a duplicate row.
create or replace function public.record_login_attempt(
  p_email text,
  p_auth_user_id uuid,
  p_success boolean,
  p_ip_address text default null,
  p_user_agent text default null,
  p_failure_reason text default null,
  p_mfa_used boolean default false
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  attempt_id uuid;
  user_portfolio uuid;
begin
  select portfolio_id into user_portfolio from public.profiles where id = p_auth_user_id;

  select la.id
    into attempt_id
    from public.login_attempts la
   where la.at >= now() - interval '30 seconds'
     and la.ip_address is null
     and la.success = p_success
     and (
       (p_auth_user_id is not null and la.auth_user_id = p_auth_user_id)
       or
       (p_auth_user_id is null and lower(la.email) = lower(p_email))
     )
   order by la.at desc
   limit 1
   for update skip locked;

  if attempt_id is not null then
    update public.login_attempts
       set ip_address = p_ip_address,
           user_agent = p_user_agent,
           failure_reason = coalesce(p_failure_reason, failure_reason),
           mfa_used = p_mfa_used
     where id = attempt_id;
  else
    insert into public.login_attempts (
      email, auth_user_id, portfolio_id, ip_address, user_agent,
      success, failure_reason, mfa_used
    ) values (
      lower(p_email), p_auth_user_id, user_portfolio, p_ip_address, p_user_agent,
      p_success, p_failure_reason, p_mfa_used
    ) returning id into attempt_id;
  end if;

  if p_success and p_auth_user_id is not null then
    update public.profiles
       set last_login_at = now(), last_login_ip = p_ip_address, updated_at = now()
     where id = p_auth_user_id;
  end if;

  return attempt_id;
end;
$$;

alter function public.record_login_attempt(text, uuid, boolean, text, text, text, boolean) owner to postgres;
revoke all on function public.record_login_attempt(text, uuid, boolean, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_login_attempt(text, uuid, boolean, text, text, text, boolean) to service_role;

comment on column public.platform_operators.mfa_required is
  'Legacy configuration field retained for compatibility. Portier369 policy requires MFA unconditionally for every platform operator because the role crosses tenant boundaries.';
