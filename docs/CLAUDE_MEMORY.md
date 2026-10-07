# Claude memory — Portier369 (read at the start of every session)

Cloud sessions start from a fresh clone and lose everything not committed.
This file is the memory. Update it before ending any session and commit it
with the work.

## Where things stand (2026-10-07)
- Design-system migration: done. All 219 pages in `docs/migration-checklist.md`
  checked; board and company-admin already use the shared Sidebar + light body.
- Claude build queue in `docs/TODO.md`: done except the resale/estoppel
  certificate (declined by Mirsad — build only if he asks).
- 2026-10-07: TODO cleanup #1 done — legacy `app/platform/*` catch-all page
  removed; `/platform` and `/platform/*` now permanently redirect to
  `/platform-operator` from `next.config.mjs`.
- docs/TODO.md still has open boxes — read it fully, never say "all done".
  2026-10-07: the "drop `'stripe'` from `payment_processor`" item was WITHDRAWN —
  the value is live (Stripe Connect webhook saves payment methods with it).
  Never drop it. E-signature and operator-analytics roadmap boxes ticked.
  Every remaining open box needs Mirsad (access, accounts, decisions).
  Lesson: verify a TODO item's premise in the code before building it.
- Other open items are blocked on Mirsad: test login + Supabase network access for
  cloud sessions, provider accounts (Twilio, Lob, Stripe Connect keys, Plaid),
  decisions (tenant portal, platform remittance, legal sign-off, pilot client).
- Mirsad's older memory lives on his Windows PC at
  `C:\Users\autho\.claude\projects\C--Users-autho-Portier369\memory\project-state.md`
  — not reachable from cloud sessions. Anything worth keeping from it should be
  pasted into this file.

## Shipped 2026-10-07 (session_014oDSoRCaVdCEGUtH1N3QYg)
- #229–#231: review agents in `.claude/agents/` (design, security, schema,
  migration, white-label) with committed self-learning memory in
  `.claude/agent-memory/<name>/MEMORY.md`; `/portier-review` runs them;
  `scripts/review-scope.mjs` gives each review its file list.
- #232: company links use the company's verified custom domain
  (`companyUrl` in `lib/tenant/host.ts`); hourly `/api/tenant/verify-domains`
  sets `portfolios.custom_domain_verified_at` (HMAC + fresh challenge + DNS
  must point at Vercel; trusted 3 h). Migration applied to termxngysvotnfbzbgrv.
- #233: generated PDF letters headed by the company, not "PORTIER369".
- #234: staff guides (Manager Runbook, Company Admin Guide) generated per
  company at `/manuals/*.pdf` from `lib/guides/content.ts`.

## Standing rules from Mirsad (keep following)
- White label: clients see their company name and domain; only "Powered by
  Portier369" / "Generated securely by Portier369" credits stay.
- **All sign-ins go through Portier369's own Supabase sign-in**: auth links
  (sign-in, reset, invites, callbacks) stay on `<slug>.portier369.com`, never
  a custom domain.
- Build for new clients; don't migrate or backfill the sample data.
- Open PRs, never merge. Post "clear to merge" on the PR only when CI is
  green, Codex found no issues and every thread is resolved; Mirsad merges
  after that. Run the matching review agents before opening a PR.
- SQL with delete/drop goes to Mirsad for the SQL editor; additive
  migrations Claude applies after merge (Supabase MCP, termxngysvotnfbzbgrv only).

## Small-business plugin connectors
- The small-business and customer-support plugins are installed on the account.
- In cloud sessions only Gmail, Google Calendar and Google Drive connect. The
  rest (QuickBooks, Stripe, HubSpot, Slack, Notion, DocuSign, Zapier, …) fail
  with a proxy 403: the cloud environment's network policy blocks their hosts.
  Fix is Mirsad's: environment settings → Network access (broader level or the
  hosts under Allowed domains), sign in at claude.ai/customize/connectors, then
  start a new session. Claude cannot authorize connectors for him.
- smb-onboard was started 2026-10-07 and stopped at Mirsad's request — no
  business profile saved yet.

## How Mirsad wants to work
- Stay on Portier369 unless he says otherwise.
- Check this file, `CLAUDE.md` and `docs/TODO.md` before answering "what's next".
- He has project review agents (`.claude/agents/`, run via `/portier-review`).
  Run the matching ones on EVERY change BEFORE committing — don't wait to be told.
