-- owners.portal_login_last_at was never written, so the company Owners page
-- listed every activated owner as "never logged in". Stamp it alongside
-- profiles.last_login_at on each successful sign-in, and backfill it from
-- auth.users.last_sign_in_at.
create or replace function public.record_login_attempt(p_email text, p_auth_user_id uuid, p_success boolean, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_failure_reason text DEFAULT NULL::text, p_mfa_used boolean DEFAULT false)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
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
    update public.owners
       set portal_login_last_at = now()
     where auth_user_id = p_auth_user_id
       and archived_at is null;
  end if;

  return attempt_id;
end;
$function$;

update public.owners o
   set portal_login_last_at = u.last_sign_in_at
  from auth.users u
 where u.id = o.auth_user_id
   and u.last_sign_in_at is not null
   and (o.portal_login_last_at is null or o.portal_login_last_at < u.last_sign_in_at);
