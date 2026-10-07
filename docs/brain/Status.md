# Status

Back to [[Home]]. Updated 2026-10-07 (after #240).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- `/settings` team table + MFA rows use shared controls (40px touch targets);
  dead hidden `portfolio_id` input removed from the invite form. No migration.
- #240 merged (79e91ab); migration `20261007060000` applied and verified
  (`portfolios_company_name_visible` contains chr(160)).
- #239 merged (0e8f398); migrations `20261007040000` and `20261007050000`
  applied and verified. Production's older `portfolios_company_name_not_blank`
  has a plain space instead of NBSP — redundant now; dropping it is optional
  and Mirsad's call (DROP).
- #238 merged (b7ec661); migration `20261007030000` applied and verified.

## Next gaps (pick up here, top first)
1. `/settings` team table "Remove" deletes a staff member with no confirmation
   step — add a confirm (shared dialog/confirm pattern) before
   `removeStaffMember` runs.
2. Look for the next white-label / sign-in / data-exposure gap with the
   overseer agent (a zero-width-space-only company name still passes the DB
   check — only reachable by direct SQL).
