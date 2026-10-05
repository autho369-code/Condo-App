-- Platform operators come in admin / support / readonly roles, but the RLS
-- write policies on the platform-control tables only asked
-- is_platform_operator() (any ACTIVE operator). A support or readonly operator
-- could therefore call PostgREST directly with their own session and:
--   * UPDATE their own platform_operators row to role = 'admin' (or INSERT a
--     new operator row for any auth user) — privilege escalation;
--   * change any company's plan, price, unit/seat limits (subscriptions);
--   * create, void or mark invoices paid (invoices);
--   * rewrite what the Piper phone receptionist tells callers.
-- The app already requires role = 'admin' for every one of these actions
-- (requirePlatformAdmin) and performs them with the service role, so writes
-- by an end-user session now need an active platform ADMIN as well. Every
-- operator keeps read access.
--
-- Idempotent and additive: ALTER POLICY on the existing policies plus guarded
-- CREATE POLICY for the operator read policies. Nothing is dropped.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('platform_operators',     'platform_operators_operator_all',     'platform_operators_operator_read'),
      ('subscriptions',          'subscriptions_platform_all',          'subscriptions_platform_read'),
      ('invoices',               'invoices_platform_all',               'invoices_platform_read'),
      ('receptionist_knowledge', 'receptionist_knowledge_operator_all', 'receptionist_knowledge_operator_read'),
      ('phone_messages',         'phone_messages_operator_all',         'phone_messages_operator_read'),
      ('feature_entitlements',   'feature_entitlements_platform_write', null)
    ) as v(tbl, write_policy, read_policy)
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t.tbl and policyname = t.write_policy
    ) then
      execute format(
        'alter policy %I on public.%I using (public.is_platform_operator() and public.is_platform_admin()) with check (public.is_platform_operator() and public.is_platform_admin())',
        t.write_policy, t.tbl
      );
    end if;

    if t.read_policy is not null and not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t.tbl and policyname = t.read_policy
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_platform_operator())',
        t.read_policy, t.tbl
      );
    end if;
  end loop;
end $$;

-- provision_portfolio / suspend_portfolio are SECURITY INVOKER RPCs that any
-- active operator (and, by default grant, anon) could execute. Require an
-- active platform admin, matching the app, and stop granting them to anon.
create or replace function public.provision_portfolio(
  p_company_name text,
  p_first_admin_email text,
  p_first_admin_name text default null::text,
  p_tier portfolio_tier default 'foundation'::portfolio_tier,
  p_seats integer default 5,
  p_trial_days integer default 14,
  p_allowed_email_domains text[] default null::text[]
)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  new_portfolio public.portfolios;
  new_subscription public.subscriptions;
  new_invitation public.user_invitations;
  president_role_id uuid;
begin
  if not (public.is_platform_operator() and public.is_platform_admin()) then
    raise exception 'provision_portfolio: platform administrator required';
  end if;

  insert into public.portfolios (
    company_name, tier, allowed_email_domains, created_by
  ) values (
    p_company_name, p_tier, coalesce(p_allowed_email_domains, '{}'), auth.uid()
  ) returning * into new_portfolio;

  insert into public.subscriptions (
    portfolio_id, tier, status, seats_included, trial_ends_at,
    billing_email, current_period_start
  ) values (
    new_portfolio.id, p_tier, 'trialing', p_seats,
    now() + make_interval(days => p_trial_days),
    p_first_admin_email,
    now()
  ) returning * into new_subscription;

  select id into president_role_id from public.user_roles
   where is_system and name = 'President' limit 1;

  insert into public.user_invitations (
    portfolio_id, email, hoa_role, role_id, invited_by,
    message, expires_at, metadata
  ) values (
    new_portfolio.id, lower(p_first_admin_email),
    'manager', president_role_id, auth.uid(),
    format('Welcome to %s — your management platform is ready.', p_company_name),
    now() + interval '30 days',
    jsonb_build_object('email_delivery', 'application')
  ) returning * into new_invitation;

  return jsonb_build_object(
    'portfolio_id', new_portfolio.id,
    'subscription_id', new_subscription.id,
    'invitation_id', new_invitation.id,
    'invitation_token', new_invitation.token,
    'invitation_expires_at', new_invitation.expires_at,
    'trial_ends_at', new_subscription.trial_ends_at
  );
end;
$function$;

create or replace function public.suspend_portfolio(p_portfolio_id uuid, p_reason text)
returns portfolios
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  updated public.portfolios;
begin
  if not (public.is_platform_operator() and public.is_platform_admin()) then
    raise exception 'suspend_portfolio: platform administrator required';
  end if;

  update public.portfolios
     set suspended_at = now(), suspension_reason = p_reason, updated_at = now()
   where id = p_portfolio_id
   returning * into updated;

  update public.subscriptions set status = 'paused', updated_at = now()
   where portfolio_id = p_portfolio_id;

  insert into public.permission_audit_log (
    actor_user_id, actor_portfolio_id, target_entity_type, target_entity_id,
    action, details
  ) values (
    auth.uid(), null, 'portfolio', p_portfolio_id,
    'suspended',
    jsonb_build_object('reason', p_reason)
  );
  return updated;
end;
$function$;

revoke execute on function public.provision_portfolio(text, text, text, portfolio_tier, integer, integer, text[]) from public, anon;
revoke execute on function public.suspend_portfolio(uuid, text) from public, anon;
grant execute on function public.provision_portfolio(text, text, text, portfolio_tier, integer, integer, text[]) to authenticated;
grant execute on function public.suspend_portfolio(uuid, text) to authenticated;
