# Status

Back to [[Home]]. Updated 2026-10-07 (after #242).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Open: follow-up to #242 (Codex findings): `buildPortfolioSnapshot` admits
  company admins (requireWorkspaceStaff) and refuses any portfolio but the
  caller's own; `isAIConfigured()` (same decrypt check as the routes) drives
  "AI is on/off" on `/settings/ai` and `/assistant`. No migration.
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
1. Look for the next white-label / sign-in / data-exposure gap with the
   overseer agent (a zero-width-space-only company name still passes the DB
   check — only reachable by direct SQL). Also: other pages with one-click
   destructive actions without `PendingSubmit confirm`.
