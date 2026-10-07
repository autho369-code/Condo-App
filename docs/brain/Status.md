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

## Also in #243 (pushed; after merge apply migrations 20261007070000 and
## 20261007080000 via MCP and read them back)
- About 45 one-click destructive buttons now confirm first (`PendingSubmit
  confirm`). Forms that already require a typed reason or a checkbox are
  unchanged.
- `hasVisibleText` is enforced on every company-name write. Migration
  20261007070000 adds the matching DB check. Plaid Link no longer falls back
  to the platform name.
- Security sweep of those actions:
  - Owner attachment delete is scoped to the owner's own storage path.
  - Meeting documents keep their stored file when RLS refuses the row delete.
  - About 15 writes that RLS can block without an error now fail loudly.
  - The association-record `back=` value is checked before redirecting.
  - Calendar reminder errors surface, and resident-portal audit entries
    carry `portfolio_id`.
  - Migration 20261007080000 adds the association scope check to the bill
    void, approve and submit RPCs.

## Next gaps (pick up here, top first)
1. Same security sweep for the *non-destructive* write actions: other
   SECURITY DEFINER RPCs that only check `can_manage_finance(portfolio_id)`
   and skip `can_view_association_row` (association-scoped managers),
   and writes that RLS can block without an error and that never check
   whether a row changed. On 2026-10-07 production had 25 such RPCs that
   authenticated users can execute. Association-tied ones to fix first:
   - bills and checks: create_payable_bill, record_bill_payment,
     record_check_run, void_payable_check, post_recurring_bills,
     archive_recurring_bill;
   - charges: bulk_create_charges, bulk_create_recurring_charges;
   - journal entries: post_manual_journal_entry, save_/archive_/
     post_recurring_journal_entr*;
   - other: record_bank_transfer, generate_owner_statements,
     mark_owner_statement_delivery, finalize_year_end_package,
     link_year_end_signature, update_record_note.
   Portfolio-level by design (leave as they are): initialize_accounting_year,
   set_accounting_period_status, set_gl_account_map,
   set_management_fee_schedule.
2. Optional: ask whether the remaining reason-required void/cancel forms
   should also confirm.
