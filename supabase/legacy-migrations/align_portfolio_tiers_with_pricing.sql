-- Align the portfolio_tier enum with the public pricing offer
-- (portier369.com/pricing): Foundation / Growth / Portfolio / Enterprise.
-- RENAME VALUE keeps each value's OID, so existing rows + column defaults remap
-- automatically and no dependent objects break. 'enterprise' is new.
-- Applied to remote DB 2026-06-15.
alter type public.portfolio_tier rename value 'core' to 'foundation';
alter type public.portfolio_tier rename value 'plus' to 'growth';
alter type public.portfolio_tier rename value 'max' to 'portfolio';
alter type public.portfolio_tier add value if not exists 'enterprise';

alter table public.portfolios alter column tier set default 'foundation';
alter table public.subscriptions alter column tier set default 'foundation';

-- provision_portfolio's p_tier default referenced the old 'core' value; repoint
-- to 'foundation' (body otherwise unchanged).
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
  if not public.is_platform_operator() then
    raise exception 'provision_portfolio: platform operator required';
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
    message, expires_at
  ) values (
    new_portfolio.id, lower(p_first_admin_email),
    'manager', president_role_id, auth.uid(),
    format('Welcome to %s — your management platform is ready.', p_company_name),
    now() + interval '30 days'
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
