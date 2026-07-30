
-- The plan-tier rename (core/plus/max -> foundation/growth/portfolio + enterprise)
-- left has_entitlement() comparing the portfolio_tier enum to the OLD labels,
-- which threw "invalid input value for enum portfolio_tier: core" on every
-- webhook-dispatching insert (e.g. charge.created) — breaking charge creation.
-- Rewrite with the current tier ladder. Applied to remote DB 2026-06-22.
CREATE OR REPLACE FUNCTION public.has_entitlement(p_portfolio_id uuid, p_feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (
    select 1
      from public.portfolios p
      join public.feature_entitlements fe on true
     where p.id = p_portfolio_id
       and fe.key = p_feature_key
       and case
             when fe.min_tier = 'foundation' then true
             when fe.min_tier = 'growth' then p.tier in ('growth','portfolio','enterprise')
             when fe.min_tier = 'portfolio' then p.tier in ('portfolio','enterprise')
             when fe.min_tier = 'enterprise' then p.tier = 'enterprise'
           end
       and p.suspended_at is null
  );
$function$;
;
