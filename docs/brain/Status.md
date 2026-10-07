# Status

Back to [[Home]]. Updated 2026-10-07 (after #243).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Open: finance RPCs association scope (migration 20261007090000; apply via
  MCP after merge and read the 16 definitions back). 16 SECURITY DEFINER
  RPCs: 15 now also require `can_view_association_row(<row's association>)`,
  post_recurring_journal_entries refuses scoped managers like
  post_recurring_bills. Real gaps closed: save_recurring_bill (update path
  now checks the existing row), archive_recurring_bill, advance_/hold/
  board-vote delinquency RPCs (no scope trigger on delinquency_cases),
  post_recurring_journal_entries; the rest add an earlier, clearer refusal
  over existing row triggers.
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
1. Writes that RLS can block without an error and never check whether a row
   changed (the #243 sweep fixed ~15 destructive ones; non-destructive
   update/insert actions remain). Also `update_record_note` (portfolio-level
   check only; notes on association records).
   Also `sync_owner_delinquency_cases(p_portfolio_id)`: portfolio-wide for
   scoped staff with no association trigger behind it; refuse scoped managers
   like post_recurring_* (low risk, cases come from open charges).
   (`record_delinquency_payment_plan_offer` is already scoped, 20261004130000.)
2. Optional: ask whether the remaining reason-required void/cancel forms
   should also confirm.
