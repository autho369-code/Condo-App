-- Defense in depth: these internal tables already have no grants for anon/authenticated,
-- but the Supabase advisor flags them because RLS was off. Enable RLS (no policies = deny all
-- for API roles). service_role and SECURITY DEFINER functions owned by postgres are unaffected.
alter table public.api_rate_limits enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.payment_processor_adjustments enable row level security;
