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
  Claude-doable next: drop the unused `'stripe'` `payment_processor` enum value
  (write the migration; Mirsad runs the SQL) and tick the stale e-signature and
  operator-analytics roadmap boxes (both already built).
- Other open items are blocked on Mirsad: test login + Supabase network access for
  cloud sessions, provider accounts (Twilio, Lob, Stripe Connect keys, Plaid),
  decisions (tenant portal, platform remittance, legal sign-off, pilot client).
- Mirsad's older memory lives on his Windows PC at
  `C:\Users\autho\.claude\projects\C--Users-autho-Portier369\memory\project-state.md`
  — not reachable from cloud sessions. Anything worth keeping from it should be
  pasted into this file.

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
