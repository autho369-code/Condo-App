# Status

Back to [[Home]]. Updated 2026-10-07 (after #244).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Open: next-gap sweep. Migration 20261007100000 filters
  `sync_owner_delinquency_cases` (upsert, conflict update, cured sweep) to the
  caller's associations (apply via MCP after merge and read it back). 30
  saves that RLS could silently skip now fail loudly (server actions, owner
  and vendor portals, letter/template editors); vendor ACH sets pending before
  saving bank details; property-group membership checks exact counts; site
  manager must be a manager of the company.
- #244 merged (f0da498); migration 20261007090000 applied and verified (16
  RPCs: 17 association checks plus the post_recurring_journal_entries refusal;
  grants unchanged).
- #243 merged (df91ada): AI follow-up, ~45 confirm-first destructive buttons,
  visible company names (`hasVisibleText` + DB check generated from it),
  security sweep. Migrations 20261007070000 and 20261007080000 applied and
  verified (constraint validated; bill RPCs scoped, grants unchanged).
- #242 merged (32bd9b5): AI routes accept company admins, `/settings/ai`
  opens for every workspace member (form for admins), `/assistant` shows
  "AI is off" up front, company-admin nav gets AI Assistant + AI Settings.
- **Mirsad to do:** Stellar has provider OpenAI / gpt-4o selected but **no
  API key saved** — enter a key at `/settings/ai` (company admin) to turn AI
  on. Decision pending: a platform `DEEPSEEK_API_KEY` exists in Vercel but is
  only used by `/api/piper`; companies currently must bring their own key.
- #241 merged (11ad690): `/settings` touch targets, confirms, no double
  submits. No migration.
- #240 merged (79e91ab); migration `20261007060000` applied and verified
  (`portfolios_company_name_visible` contains chr(160)).
- #239 merged (0e8f398); migrations `20261007040000` and `20261007050000`
  applied and verified. Production's older `portfolios_company_name_not_blank`
  has a plain space instead of NBSP — redundant now; dropping it is optional
  and Mirsad's call (DROP).
- #238 merged (b7ec661); migration `20261007030000` applied and verified.

## Next gaps (pick up here, top first)
1. Leftovers from the silent-save sweep (security review, low):
   `acknowledgeReminder` / `resendMaintenanceNotification` in
   `lib/rpcs/calendar.ts` return `{ error }` (no caller today; redirect if
   ever wired to a form). Maintenance "complete" writes history and the
   calendar event before the task update; its error says what was recorded.
   `update_record_note` (portfolio check only in the RPC) needs no change:
   the record_notes row trigger `enforce_row_association_scope`
   (20261004130000) already refuses association/unit/owner notes outside a
   scoped manager's associations; vendor notes are portfolio-level.
   Next: look for the next white-label / sign-in / data-exposure gap with
   the overseer.
2. Optional: ask whether the remaining reason-required void/cancel forms
   should also confirm.
