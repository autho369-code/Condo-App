-- provision_portfolio's invitation fired queue_invitation_email (as a
-- "manager" invite, before the app upgrades it to company_admin), and the
-- platform action then queued its own welcome email: every new company admin
-- got two emails, the first with the wrong role. The only caller sends the
-- branded welcome email itself, so mark the row application-delivered.
CREATE OR REPLACE FUNCTION public.provision_portfolio(p_company_name text, p_first_admin_email text, p_first_admin_name text DEFAULT NULL::text, p_tier portfolio_tier DEFAULT 'foundation'::portfolio_tier, p_seats integer DEFAULT 5, p_trial_days integer DEFAULT 14, p_allowed_email_domains text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
