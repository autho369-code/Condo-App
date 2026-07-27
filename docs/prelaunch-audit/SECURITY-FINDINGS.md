# Security findings

## Blockers

1. Migration integrity is broken locally: 41 migration files do not use the required timestamp-name convention and duplicate timestamps exist. The linked database reports remote versions absent locally. Do **not** run `migration repair` blindly or push this history to production.
2. Payment safety depends on applying `20260726000000_atomic_stripe_ledger_posting.sql` and the related account-scope/autopay migrations together, then replaying duplicate webhook and retry scenarios in Stripe test mode.
3. Provider configuration has not been verified in every Vercel environment: `CRON_SECRET`, Stripe webhook keys, Plaid, Resend, AI credentials, and rate-limit secret are required gates.

## Controls present in source

- Rate-limit table/RPC and server helper.
- Association Stripe-account fields, uniqueness constraint, account-scoped payment methods, and webhook claim logic.
- Recent tenant/RLS and SECURITY DEFINER execution-boundary migrations.
- Cron bearer-secret helper.

## Required validation

Run authenticated RLS negative tests for each role and two associations; confirm service-role secrets never reach browser code; inspect provider webhooks for signature verification and idempotency; scan deployed environment configuration; and perform a backup/restore drill before customer onboarding.
