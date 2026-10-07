# Status

Back to [[Home]]. Updated 2026-10-07 (after #239).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Follow-up to #239 (this branch): `/settings` save feedback (part 3 of #239,
  pushed after #239 was merged) + migration
  `20261007060000_portfolio_company_name_visible_nbsp.sql`. **After Mirsad
  merges: apply it with `apply_migration` and verify
  `portfolios_company_name_visible` contains chr(160).**
- #239 merged (0e8f398); migrations `20261007040000` and `20261007050000`
  applied and verified (token CHECK + trigger, brand-color CHECK,
  `html_escape` escapes quotes). Note: production's
  `portfolios_company_name_not_blank` got a plain space instead of NBSP
  through the MCP; the follow-up fixes that. Dropping the old constraint is
  optional and Mirsad's call (DROP).
- #238 merged (b7ec661); migration `20261007030000` applied and verified.

## Next gaps (pick up here, top first)
1. `/settings` team table (`app/(app)/settings/page.tsx`, role select and
   Apply / Send reset link / Remove buttons): hand-built 32px controls — use
   the shared `Select`/`Button` so they meet the 40px touch target at 375px.
2. Look for the next white-label / sign-in / data-exposure gap with the
   overseer agent (a zero-width-space-only company name still passes the DB
   check — only reachable by direct SQL).
