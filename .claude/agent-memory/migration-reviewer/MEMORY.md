# migration-reviewer memory

## Confirmed rules (Mirsad)
- DELETE/DROP SQL goes to Mirsad for the SQL editor; additive migrations Claude applies after merge.
- Only project `termxngysvotnfbzbgrv`; never staging or stellar-ops without asking.

## Checks that caught real bugs
- Migrations must pass `node scripts/check-supabase-migrations.mjs`.
- `payment_processor` enum value 'stripe' is LIVE (`app/api/stripe/webhook/route.ts:358` inserts payment_methods with processor 'stripe'; `select_payment_processor()` falls back to 'stripe', baseline :7794). Flag any migration that drops/recreates the enum without 'stripe' as breaking online payments, despite the old docs/TODO.md note calling it unused.

## False alarms to skip
- The checker prints ~40 warnings on old, already-merged migrations even when it PASSES. Only warnings on in-scope files count. (Codex on PR #229.)
- Get scope from `node scripts/review-scope.mjs supabase/migrations`, not a hand-written `git diff`: merge-base diffs keep squash-merged files, tip diffs pull in main-only changes. (Codex on PR #230.)

## Helpers worth checking
- Triggers on `public.portfolios` (same-timing fire alphabetically): BEFORE INSERT `portfolios_guard_domain_verification`, `trg_generate_portfolio_slug`; BEFORE UPDATE `portfolios_guard_domain_verification`, `portfolios_guard_platform_columns`, `trg_portfolios_updated`. Baseline triggers are in `20260715040000_production_schema_baseline.sql` (uppercase quoted `ON "public"."portfolios"`).
- `auth.uid() is null` = "service role" guards also pass for anon JWTs, SQL editor and pg_cron; OK only while no anon policy/definer RPC writes the table. Trigger-function EXECUTE is revoked automatically by the event trigger in `20261001031000_default_function_privileges.sql`, so no explicit revoke is needed.
- Live ACL of public security-definer functions comes from `20260726050000_security_definer_execution_boundary.sql` (~:534 list): revoke from public/anon/authenticated, grant service_role. `create or replace` keeps ACL/owner/comment, so a replacement needs no grants (but check the COMMENT still matches).
- Invitation emails: `queue_invitation_email` (20260731010000) skips rows with `metadata.email_delivery = 'application'`; `invite_staff` relies on the `hoa_role` default 'manager'. Email URLs: auth links use slug host (`tenantWorkspaceUrl`), never custom domain.
