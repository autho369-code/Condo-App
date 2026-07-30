-- =============================================================================
-- Phase 9a — Security hardening
--   • MFA tracking (portfolio staff + platform operators)
--   • Portfolio-level email domain allowlist
--   • Login attempt log
--   • Session tracking
--   • Invitation auto-expiry via pg_cron
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MFA tracking + portfolio policy
-- -----------------------------------------------------------------------------
alter table public.platform_operators
  add column mfa_required boolean not null default true,
  add column mfa_enrolled_at timestamptz;

alter table public.profiles
  add column mfa_required boolean not null default false,
  add column mfa_enrolled_at timestamptz,
  add column last_login_at timestamptz,
  add column last_login_ip text;

alter table public.portfolios
  add column require_mfa_for_staff boolean not null default false,
  add column require_mfa_for_admins boolean not null default true,
  add column allowed_email_domains text[] not null default '{}',
  add column session_timeout_minutes integer not null default 60 check (session_timeout_minutes between 5 and 43200),
  add column password_min_length smallint not null default 12 check (password_min_length between 8 and 128),
  add column suspended_at timestamptz,
  add column suspension_reason text;
create index idx_portfolios_suspended on public.portfolios(suspended_at) where suspended_at is not null;

-- -----------------------------------------------------------------------------
-- 2. login_attempts
-- -----------------------------------------------------------------------------
create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  auth_user_id uuid references auth.users(id) on delete set null,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  ip_address text,
  user_agent text,
  success boolean not null,
  failure_reason text,
  mfa_used boolean not null default false,
  at timestamptz not null default now()
);
create index idx_login_attempts_email_at on public.login_attempts(lower(email), at desc);
create index idx_login_attempts_user_at on public.login_attempts(auth_user_id, at desc);
create index idx_login_attempts_ip_failed on public.login_attempts(ip_address, at desc) where not success;
create index idx_login_attempts_portfolio on public.login_attempts(portfolio_id, at desc);

alter table public.login_attempts enable row level security;
create policy login_attempts_platform_all on public.login_attempts
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy login_attempts_admin_own_portfolio on public.login_attempts
  for select to authenticated
  using (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id());
create policy login_attempts_self_read on public.login_attempts
  for select to authenticated using (auth_user_id = auth.uid());

comment on table public.login_attempts is 'Sign-in audit. Edge function or Auth hook inserts rows; used for rate-limiting detection and security analytics.';

-- -----------------------------------------------------------------------------
-- 3. user_sessions
-- -----------------------------------------------------------------------------
create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz,
  ended_at timestamptz,
  ended_reason text check (ended_reason in ('logout','timeout','revoked','expired','session_limit','password_change'))
);
create index idx_user_sessions_user on public.user_sessions(auth_user_id, started_at desc);
create index idx_user_sessions_active on public.user_sessions(auth_user_id) where ended_at is null;
create index idx_user_sessions_portfolio on public.user_sessions(portfolio_id, started_at desc);

alter table public.user_sessions enable row level security;
create policy user_sessions_platform_all on public.user_sessions
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy user_sessions_admin_own_portfolio on public.user_sessions
  for select to authenticated
  using (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id());
create policy user_sessions_self on public.user_sessions
  for all to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

comment on table public.user_sessions is 'Per-user session log with last_active + ended_reason. Populated by auth hook; revoked rows indicate forced logout.';

-- -----------------------------------------------------------------------------
-- 4. Email domain allowlist enforcement on invitations
-- -----------------------------------------------------------------------------
create or replace function public.validate_invitation_email_domain()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  domains text[];
  invitee_domain text;
begin
  select allowed_email_domains into domains
    from public.portfolios
   where id = new.portfolio_id;

  if domains is null or array_length(domains, 1) is null then
    return new;  -- no restriction
  end if;

  invitee_domain := lower(split_part(new.email, '@', 2));
  if invitee_domain = '' then
    raise exception 'invalid email: %', new.email;
  end if;

  if not (invitee_domain = any(domains)) then
    raise exception 'email domain % not in portfolio allowlist (%)', invitee_domain, array_to_string(domains, ', ');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_invitation_domain on public.user_invitations;
create trigger trg_validate_invitation_domain
  before insert on public.user_invitations
  for each row execute function public.validate_invitation_email_domain();

-- -----------------------------------------------------------------------------
-- 5. Portfolio suspension check on privilege changes
-- -----------------------------------------------------------------------------
create or replace function public.check_portfolio_not_suspended()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  is_suspended boolean;
begin
  if new.portfolio_id is not null then
    select suspended_at is not null into is_suspended
      from public.portfolios where id = new.portfolio_id;
    if is_suspended then
      raise exception 'portfolio % is suspended; no new user assignments allowed', new.portfolio_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_portfolio_suspended on public.profiles;
create trigger trg_check_portfolio_suspended
  before insert or update of portfolio_id on public.profiles
  for each row when (new.portfolio_id is not null)
  execute function public.check_portfolio_not_suspended();

-- -----------------------------------------------------------------------------
-- 6. Scheduled jobs: expire invitations + age out ended sessions
-- -----------------------------------------------------------------------------

-- Expire pending invitations past their expires_at (hourly)
select cron.schedule(
  'expire-pending-invitations',
  '0 * * * *',
  $$ update public.user_invitations
       set status = 'expired', updated_at = now()
     where status = 'pending' and expires_at < now(); $$
);

-- Expire sessions that haven't had activity beyond portfolio's session_timeout_minutes (every 15 minutes)
select cron.schedule(
  'expire-idle-sessions',
  '*/15 * * * *',
  $$
  update public.user_sessions s
     set ended_at = now(), ended_reason = 'timeout'
    from public.profiles p
    left join public.portfolios po on po.id = p.portfolio_id
   where s.ended_at is null
     and s.auth_user_id = p.id
     and s.last_active_at < now() - make_interval(mins => coalesce(po.session_timeout_minutes, 1440));
  $$
);

-- Purge login_attempts older than 180 days (nightly)
select cron.schedule(
  'purge-old-login-attempts',
  '17 3 * * *',
  $$ delete from public.login_attempts where at < now() - interval '180 days'; $$
);

-- -----------------------------------------------------------------------------
-- 7. Helper to record login attempts from the auth hook
-- -----------------------------------------------------------------------------
create or replace function public.record_login_attempt(
  p_email text,
  p_auth_user_id uuid,
  p_success boolean,
  p_ip_address text default null,
  p_user_agent text default null,
  p_failure_reason text default null,
  p_mfa_used boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  attempt_id uuid;
  user_portfolio uuid;
begin
  select portfolio_id into user_portfolio from public.profiles where id = p_auth_user_id;

  insert into public.login_attempts (
    email, auth_user_id, portfolio_id, ip_address, user_agent,
    success, failure_reason, mfa_used
  ) values (
    lower(p_email), p_auth_user_id, user_portfolio, p_ip_address, p_user_agent,
    p_success, p_failure_reason, p_mfa_used
  ) returning id into attempt_id;

  if p_success and p_auth_user_id is not null then
    update public.profiles
       set last_login_at = now(), last_login_ip = p_ip_address, updated_at = now()
     where id = p_auth_user_id;
  end if;

  return attempt_id;
end;
$$;

grant execute on function public.record_login_attempt(text, uuid, boolean, text, text, text, boolean) to service_role;

comment on function public.record_login_attempt(text, uuid, boolean, text, text, text, boolean) is 'Call from an Auth hook edge function on every sign-in attempt. Logs to login_attempts and updates profiles.last_login_* on success.';

-- -----------------------------------------------------------------------------
-- 8. Rate-limit helper: count recent failed attempts for a given email/IP
-- -----------------------------------------------------------------------------
create or replace function public.recent_failed_attempts(
  p_email text,
  p_window_minutes integer default 15
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::integer
    from public.login_attempts
   where lower(email) = lower(p_email)
     and not success
     and at > now() - make_interval(mins => p_window_minutes);
$$;

grant execute on function public.recent_failed_attempts(text, integer) to service_role, authenticated;
;
