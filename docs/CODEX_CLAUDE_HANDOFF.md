# Codex + Claude release handoff

Last updated: 2026-07-31 19:16 Pacific

This file is the shared operational checkpoint for the Portier369 release. Do
not rely on older chat summaries or the historical section of
`docs/PROJECT_STATUS.md`.

## Shared starting point

- Base commit: `c077d07c5ebea516a5456a8bc42cb87b01239b0f`
- Codex branch: `codex/portier369-stabilization`
- Draft PR: <https://github.com/autho369-code/Condo-App/pull/24>
- Exact preview: <https://condo-2um9axw74-aios2.vercel.app>
- GitHub CI, production build, TypeScript, lint, route checks, security scans,
  and 182 automated tests are green at the base commit.
- Staging project: `zalfkrtjeswvfmucicea`
- Production project: `termxngysvotnfbzbgrv`

## Ownership while both engineers are active

### Codex

- Production migration safety review and controlled application.
- Production deployment/merge decision and post-deploy read-only smoke tests.
- Provider readiness and release evidence.

### Claude

- Independently review architecture, product-history decisions, and the final
  release candidate through the bidirectional Claude MCP workflow.
- Return prioritized findings with exact evidence; do not mutate production,
  merge PR 24, or deploy.
- Codex must address or explicitly resolve every Claude finding and record the
  result in this handoff before merge.

## Database release checkpoint

- Production physical backups are completing daily; the latest verified backup
  was completed on 2026-07-31. PITR is not enabled.
- The schema-only production baseline `20260715040000` was compared with a fresh
  production schema dump and then marked applied in the migration ledger. Its SQL
  was not executed and no customer data was changed.
- The 31 reviewed forward migrations from `20260726000000` through
  `20260731011000` are applied in both staging and production.
- Production preflight found 0 plaintext AI keys, 0 custom AI endpoints,
  0 unsupported AI providers, and 0 cross-association AutoPay conflicts.
- Post-migration verification exposed legacy role-catalog drift. Migration
  `20260731012000` normalized the catalog, and Claude's independent review found
  that two roles were deliberately inactive rather than stale. Corrective
  migration `20260731013000` restored the documented condo-only boundary.
- Final role invariant is verified in staging and production: President,
  Accountant, Property Manager, and On-Site Manager are active system roles;
  Leasing Agent and Accounts Payable remain inactive.
- Both databases report no pending migrations. Production database lint passes
  at error level, and the CLI is relinked to staging.
- `AI_CREDENTIALS_ENCRYPTION_KEY` exists in the Vercel Production environment.
  Its value was not copied into this repository or logged.

## Release sequence

1. Commit and push the two role-catalog migrations, regression test, and this
   release evidence; confirm GitHub CI and the exact Vercel preview are green.
2. Complete the six-role browser regression against that exact preview.
3. Merge PR 24 only when database, application, and browser gates are green.
4. Deploy the approved commit to production and run read-only production smoke
   tests before declaring GO.

## Claude verification log

- 2026-07-31: Claude Fable independently reviewed the post-migration role fix.
  It confirmed the upsert was mechanically safe but found that activating
  Leasing Agent and Accounts Payable reversed a deliberate product decision in
  `supabase/legacy-migrations/rbac_fixes.sql`. Codex accepted the finding,
  added forward correction `20260731013000`, and verified the corrected 4-active
  / 2-inactive invariant in staging and production.
- Six-role browser regression against the next exact preview remains the final
  application release gate.

### 2026-07-31 — Six-role browser regression against the exact preview (Claude)

Method: signed in as each `codex_test.*` staging persona in a real browser
against <https://condo-2um9axw74-aios2.vercel.app> (staging DB
`zalfkrtjeswvfmucicea`), swept every nav module per role, and checked console
errors, network failures, and rendered data against the CODEX_TEST fixtures.

**Repairs (pushed to `claude/portier369-verification`, ready to cherry-pick):**

1. `95e6b76` — **/bank-accounts listed 0 accounts and every
   /bank-accounts/[id] returned 404** (all staff roles). The
   `associations(name)` embed from `bank_accounts` is ambiguous (PGRST201) now
   that `associations` carries operating/primary/reserve/stripe-settlement
   bank-account FKs — the query errored and both pages swallowed it.
   ⚠️ All four FK constraints already exist in PRODUCTION, so this is broken on
   portier369.com today, independent of the pending migrations. Fix pins the
   embed to `bank_accounts_association_id_fkey`; regression test added
   (`tests/banking/bank-account-embed.test.ts`). Verified the fixed query
   returns 3 accounts via authenticated REST against staging.
2. `d92fec1` — **Manager sidebar "Settings" was a dead link**: /settings now
   requires portfolio-admin access (9de96e0), so managers were silently bounced
   to /dashboard. The link is now hidden for staff without that access.
3. `ce2f2f7` — **/company-admin/associations rendered "0 of 0 associations"**:
   the nested `profiles` embed under `association_managers` has no FK path
   (user_id → auth.users), so PostgREST rejected the whole query (PGRST200).
   Manager names are now joined from the page's existing profiles fetch.
   Verified old query errors / new query returns data via authenticated REST.

**Verified healthy (no defect):** Manager — dashboard, associations directory +
detail tabs (units/board/budget), accounting hub, payables, receivables,
journal entries (debits=credits $26,350), GL accounts, budget-vs-actuals,
reports incl. live Balance Sheet (balanced, $16,650), work orders, violations,
vendors, owners, communication center, calendar, documents, command center.
Company admin — overview, managers, financials, performance, portfolio health,
insights, billing, audit logs, settings. Platform operator — overview,
intelligence, companies, users, system monitor, security center,
announcements. Board — dashboard, financials, delinquencies ($1,400/139d),
approvals, homeowners, compliance, reports. Owner — dashboard, ledger (matches
$1,400 fixture aging), how-to-pay (correct dormant-Stripe message), autopay,
my home, communications, documents. Vendor — dashboard, work orders, payments
(paid/void bills correct), compliance, profile, schedule. Negative routing:
vendor → /dashboard redirected to /vendor.

**Findings for Codex (not fixed by Claude, decide before GO):**

- `record_login_attempt` has no caller (comment says an Auth-hook edge function
  should call it), so `profiles.last_login_at` never updates and
  /platform-operator/users shows "Never logged in" for accounts that logged in
  minutes earlier. Wire the auth hook or update the login action.
- In-page links to /settings remain on manager-reachable pages
  (bills/new AI note, buildings/new ×2, onboard, send-email) and silently
  bounce non-admin staff to /dashboard.
- Login server action intermittently returns 503/does not submit on first
  attempt in the preview (Vercel deployment-protection edge behavior is a
  suspect); succeeded on retry every time. Worth one look before production
  smoke tests since production has no deployment protection layer.
- Staging persona passwords: Claude reset the `codex_test.*` passwords for
  browser access (not recorded here); rerunning `seed-staging-verification.mjs`
  resets them to `STAGING_TEST_PASSWORD` again, so runs collide — coordinate
  timing if both engineers verify simultaneously.

### 2026-08-01 — Independent review of the final release candidate (Claude)

Codex's Claude-MCP bridge could not spawn a reviewer (empty agent registry), so
this review ran directly from Claude's own session against
`origin/codex/portier369-stabilization` @ `a2be25c` (RC frozen per Codex).

**RELEASE-BLOCKING FINDING — production migration ledger is behind the RC.**
Verified read-only against both projects: production's ledger ends at
`20260731014000`; staging additionally has `20260731015000`
(board communications policy), `20260731030000` (v_unit_account_summary
association_name column), `20260801010000` (submit_vendor_invoice RPC),
`20260801011000` (vendor document types), `20260801020000` (owner violation
hearing requests). Concretely: `submit_vendor_invoice` exists in staging and
does NOT exist in production, and production's `communications_log` has no
`communications_board_read` policy. Deploying the RC now would break vendor
invoice/compliance submission, owner hearing requests, board communications,
and the manager Units page (view column missing → PostgREST rejects → zero
units, the exact bug 8790da2 fixed). The checkpoint line "Both databases
report no pending migrations" is stale and must not be used as GO evidence.
Codex must apply the five remaining migrations to production in its controlled
process before or with the deploy, then refresh the checkpoint.

**Verified sound (evidence-based):**

- Migrations `20260731012000`+`13000`: combined effect correct and idempotent;
  role invariant confirmed in PRODUCTION (President/Accountant/Property
  Manager/On-Site Manager active; Leasing Agent/Accounts Payable inactive).
- `20260731014000`: pg_cron drain removal is guarded (`to_regclass`), and the
  replacement Vercel cron exists (`vercel.json`: /api/email/process-queue every
  minute) with `requireCronSecret` on the route.
- `20260731015000` board visibility: RLS-simulated as the board persona in
  staging — `is_board_user()` true, sees exactly its association's 2
  communications rows; the restrictive `mgr_assoc_scope` policy passes for
  non-managers by design. Scoping correct.
- `20260731030000`: RLS-simulated as manager — v_unit_account_summary returns
  association_name + correct balances.
- `submit_vendor_invoice` RPC: derives portfolio/association from the
  authenticated vendor's own assigned work order, validates inputs, raises
  loudly — good pattern. `lib/rpcs/vendor-submissions.ts` re-checks
  `requireVendor()` inside every action and constrains storage paths.
- Cherry-picks `6014e09`/`e631e01`/`79eb95b` are byte-identical to Claude's
  browser-verified originals (`git diff` clean on all five files);
  `a12c8f3` is a correct follow-up (adds `modules` to the effect deps).

**Residual gate:** the six-role BROWSER pass against the RC preview
(condo-edvbttard-aios2.vercel.app / branch alias
condo-app-git-codex-portier369-stabilization-aios2.vercel.app) is blocked for
Claude — the Chrome bridge only has approval for the old c077d07 preview
domain, and each Vercel deployment mints a new subdomain. Everything above was
verified at the code/DB layer instead; my earlier in-browser pass covers the
three cherry-picked fixes byte-for-byte. To close the gate in-browser, either
approve the new domain for Claude's Chrome bridge or mint a fresh preview and
approve that. The handoff's "Exact preview" pointer (c077d07 deployment) is
stale either way.

