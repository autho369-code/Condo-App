-- Trigger functions cannot be invoked directly, but authenticated platform
-- provisioning fires this trigger through provision_portfolio(). Preserve the
-- minimum runtime grant needed by that existing SECURITY INVOKER RPC.

revoke all on function public.generate_portfolio_slug() from anon;
grant execute on function public.generate_portfolio_slug() to authenticated, service_role;
