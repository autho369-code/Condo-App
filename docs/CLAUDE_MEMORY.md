# Claude memory — Portier369 (the second brain)

The system (no step depends on Claude remembering):
- **Load:** `.claude/settings.json` SessionStart hook runs
  `scripts/brain/session-start.mjs` — prints this file, the latest 15 merges on
  main (live from git), this branch's state and every open box in
  `docs/TODO.md` into every new session.
- **Save:** Stop hook `scripts/brain/stop-guard.mjs` reminds Claude (once) when
  this session has committed work but this file is unchanged since the session
  started (baseline in `.claude/brain-baseline.json`, written at start).
- Cloud sessions start from a fresh clone and keep nothing else. **Update this
  file and commit it with the work** (shipped items, new rules, next gap).

## How Mirsad works — follow without being told
- He says **"go to next gap"** → pick the highest-value gap yourself and build
  it. Be fast and direct. **No options menus. Do not ask what to work on.**
- Stay on Portier369 unless he says otherwise.
- Before answering "what's next" or "what's done": read this file, `CLAUDE.md`
  and all of `docs/TODO.md`. Never say "all done" — TODO still has open boxes.
  Verify a TODO item's premise in the code before building it.
- Run the matching review agents (`.claude/agents/`, or `/portier-review`)
  on EVERY change BEFORE committing/opening a PR. Feed lessons from Codex, CI
  or Mirsad back into the agent's memory and commit it.
- Check chain before every push: `npm run typecheck`, `npm test` (also with
  `NEXT_PUBLIC_APEX_DOMAIN=example.test NEXT_PUBLIC_SITE_URL=http://localhost:3000`),
  `npm run lint`. Never push red.

## PR rules
- **Open PRs, never merge — Mirsad merges.** (Exception: he explicitly says
  "merge it" for that PR.)
- After opening: subscribe to PR activity, comment "@codex review", set a
  ~50-min `send_later` check-in. Drive it: CI green, Codex clean, every thread
  answered/resolved, re-request "@codex review" after each fix. Then post
  "✅ **Clear to merge.**" on the PR and tell him. Delete the check-in after.
- After a merge: `git fetch origin main`, confirm, then
  `git checkout -B <branch> origin/main && git push --force-with-lease`.
  If a PR merged before your last push, cherry-pick the missed commit into a
  follow-up PR.

## Standing product rules
- Supabase project `termxngysvotnfbzbgrv` only — never touch staging or
  stellar-ops without asking. Additive migrations: Claude applies after merge
  (Supabase MCP `apply_migration`). **SQL with DELETE/DROP → give it to Mirsad
  to run in the SQL editor.** (Use `create or replace trigger`, not drop.)
- White label everywhere: clients see their own company name and domain
  ("EACH CLIENT MUST HAVE ITS OWN DOMAIN"). Only "Powered by Portier369" /
  "Generated securely by Portier369" credits stay.
- **All sign-ins go through Portier369's own Supabase sign-in**: auth links
  (sign-in, reset, invites, callbacks) stay on `<slug>.portier369.com`, never a
  custom domain.
- Build for new clients; don't migrate or backfill the sample (Granville) data.
  "Don't bill anyone, this is just a sample."
- Owners, vendors and the board never see manager notes. Board portal is
  read-only. Owners/vendors change only what their portal offers, on their own
  records. Server actions re-check auth inside the action and fail loudly.
- Verify Supabase columns before writing queries; every link must resolve;
  shared design system only.

## Where things stand (2026-10-07)
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — build only
  if he asks). Remaining open boxes need Mirsad: test login + Supabase network
  access for cloud sessions, provider accounts (Twilio, Lob, Stripe Connect
  keys, Plaid), decisions (tenant portal, platform remittance, legal, pilot).
- `'stripe'` in the `payment_processor` enum is LIVE (Stripe Connect webhook
  saves payment methods with it). Never drop it — TODO item withdrawn.

## Shipped 2026-10-07
- #229–#231: review agents (design, security, schema, migration, white-label)
  with self-learning memory in `.claude/agent-memory/<name>/MEMORY.md`;
  `/portier-review`; `scripts/review-scope.mjs`.
- #232: company links use the verified custom domain (`companyUrl` in
  `lib/tenant/host.ts`; hourly `/api/tenant/verify-domains`).
- #233: generated PDF letters headed by the company. #234: staff guides
  generated per company at `/manuals/*.pdf` (`lib/guides/content.ts`).
- #235 / #237: this memory file. #236: `/platform/*` → `/platform-operator`
  permanent redirects in `next.config.mjs` (old catch-all page removed).

## Next gaps (pick up here)
1. **Settings → "Invite a staff member"** (`app/(app)/settings/page.tsx`
   `inviteStaff`) calls `invite_staff`; the email is queued by DB trigger
   `trg_queue_invitation_email` → `render_invitation_email`. Check that email:
   white-labeled, sign-in on `<slug>.portier369.com`, and it should link the
   Manager Runbook like `app/company-admin/managers/actions.ts` does.
2. `'Portier369'` fallback for the company name in `lib/tenant/resolve.ts`
   (lines ~55, ~74) and `middleware.ts` (`x-portfolio-name`). `company_name`
   is NOT NULL, so it only shows if the header is missing/garbled — use
   neutral wording, and don't set the header with a fake value (the manuals
   route relies on the header being absent).

## Sessions (where older context lives)
- `session_014oDSoRCaVdCEGUtH1N3QYg` "Portier369 setup and context" — the main
  build session (#229–#237). Its transcript holds the full history.
- `session_01Qxam3bJdrKVz5fkBpEHUsQ` — memory file, #236, the second-brain system
  (`scripts/brain/`, hooks in `.claude/settings.json`).
- Mirsad's older local memory: `C:\Users\autho\.claude\projects\C--Users-autho-Portier369\memory\project-state.md`
  on his PC (not reachable from the cloud — paste anything useful here).

## Small-business plugin connectors
- small-business + customer-support plugins are installed. In cloud sessions
  only Gmail, Google Calendar and Google Drive connect; the rest fail with a
  proxy 403 (environment network policy). Fix is Mirsad's: environment
  settings → Network access, sign in at claude.ai/customize/connectors, new
  session. smb-onboard was stopped at his request — no business profile saved.
