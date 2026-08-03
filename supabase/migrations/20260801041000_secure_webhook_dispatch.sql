-- Webhook dispatch is an internal event-bus primitive. It accepts arbitrary
-- payload JSON, so authenticated browser clients must never invoke it directly.
-- Database triggers run as their SECURITY DEFINER owners; delivery workers use
-- service_role. Portfolio administrators manage endpoints, not dispatch calls.

revoke all on function public.dispatch_webhook(uuid, public.webhook_event, jsonb)
  from public, anon, authenticated;
grant execute on function public.dispatch_webhook(uuid, public.webhook_event, jsonb)
  to service_role;

revoke all on function public.verify_api_key(text)
  from public, anon, authenticated;
grant execute on function public.verify_api_key(text)
  to service_role;

comment on function public.dispatch_webhook(uuid, public.webhook_event, jsonb) is
  'Internal event dispatch. Callable only by service_role and database-owned trigger functions.';

insert into public.feature_entitlements (key, name, description, min_tier, category)
values
  ('api_keys', 'Portfolio API keys', 'Scoped read-only API access for approved integrations.', 'portfolio', 'integrations'),
  ('webhooks', 'Signed webhooks', 'Signed business-event delivery and health history.', 'enterprise', 'integrations')
on conflict (key) do nothing;
