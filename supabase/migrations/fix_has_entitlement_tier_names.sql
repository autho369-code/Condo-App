-- REGRESSION FIX. The plan-tier rename (core/plus/max -> foundation/growth/
-- portfolio + enterprise) left has_entitlement() comparing the portfolio_tier
-- enum to the OLD labels ('core'/'plus'/'max'). Because those are no longer
-- valid enum values, every webhook-dispatching insert that calls has_entitlement
-- (e.g. the charge.created webhook on INSERT into charges) threw
-- "invalid input value for enum portfolio_tier: core" — silently breaking
-- charge creation (ad-hoc charges, dues, CSV opening-balance import, etc.).
-- Rewrite with the current tier ladder: foundation < growth < portfolio < enterprise.
-- Applied to remote DB 2026-06-22. (No other function references the old labels.)
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
