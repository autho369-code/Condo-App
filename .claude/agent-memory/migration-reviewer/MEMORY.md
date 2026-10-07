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
- `user_invitations.token` writers (as of 20261007040000): column default (2x uuid sans dashes = 64 hex) and `generate_invite_token()` (hex of 32 bytes); no app insert/update sets `token`. A token CHECK is safe; re-grep `from('user_invitations')` and SQL `insert into public.user_invitations` for a `token` column if it changes.
- `add constraint` has no IF NOT EXISTS: flag as low (wrap in `do $$ if not exists (select 1 from pg_constraint where conname=...)`), not blocking. Example: 20261007040000:19.
- `portfolios.company_name` writers (as of 20261007050000): SQL `provision_portfolio` (20261005010001:80, untrimmed, app trims first), `update_company_profile` (20261001171941, rejects blank), legacy `invite_company_admin`/`platform_create_company` (baseline :4918/:5921, unused by app); app: `app/platform-operator/companies/actions.ts` (:87 create, :660 edit), `app/(app)/settings/branding/page.tsx`, `lib/rpcs/portfolio.ts`. All reject blank before writing.
- Whitespace CHECKs: `btrim(x)` strips only ASCII space, JS `.trim()` strips tabs/newlines/NBSP too, so `btrim(x) <> ''` is weaker than the app check (not stricter). Suggest `x ~ '[^[:space:]]'` as low, never blocking.

