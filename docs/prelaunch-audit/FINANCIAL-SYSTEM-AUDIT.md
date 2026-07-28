# Financial system audit

Status: active audit. This document separates demonstrated behavior from code presence. The read-only production sample below is evidence for core statement arithmetic only; it is not an accounting certification.

## Verified statement evidence

- Trial Balance: $23,950 debit and $23,950 credit.
- Balance Sheet: $13,500 assets and $13,500 liabilities plus equity.
- Income Statement: $11,450 net income.
- A/R Aging: $2,250 for the sampled association; $0 for a second association, supporting association scoping in that sample.
- GitHub CI passes the accounting/report unit suite and production build.

## Ledger model

The application uses journal entries and journal-entry lines for general-ledger reporting, with charges, payments, bills, bank transactions, reconciliation records, payment intents, provider events, and report runs as operational/source records. The audit branch centralizes normal-balance and statement classification logic.

Verified by unit/static evidence:

- Trial Balance and Balance Sheet read posted entries through the report **as-of** date.
- Reports include shared accounts plus the selected association’s accounts and exclude other associations’ accounts.
- Requested export formats are validated; CSV, JSON, and real PDF bytes are serialized distinctly.
- Cross-association Stripe account identifiers and exact USD cents are checked by invariant helpers and passing tests.

Still requiring seeded transaction tracing:

- source-to-journal atomicity;
- control-account tie-out for A/R and A/P;
- retained earnings and period close behavior;
- reversal and refund entries;
- multi-unit allocation and overpayments;
- bank-feed clearing and reconciliation;
- immutable audit evidence.

## Assessment and owner-ledger workflow

UI, actions, tables, and RPC types exist for assessments, charges, receipts, credits, late fees, and owner ledgers. This is **PARTIALLY WORKING** until staging proves regular/special assessment generation, partial payments, credits, late fees, multi-unit allocation, reversals, and the resulting owner balance and GL entries in one repeatable scenario.

## Stripe workflow

The intended architecture is one Stripe Connect account per association, not one shared merchant account.

The audit branch verifies and hardens:

- association-scoped Connect onboarding and status;
- charges and payouts must both be enabled before the association is considered active;
- connected-account ID validation;
- cross-association account rejection;
- test/live mode mismatch fails closed;
- stable idempotency keys for Checkout and AutoPay;
- duplicate-event/provider identifier constraints in the forward migrations;
- webhook signature verification and payload size limit.

Status: **CONFIGURATION REQUIRED** and **NOT TESTED end to end**. Required proof is a test-mode connected account for two associations, Checkout and ACH/card fixtures, signed duplicate webhook replay, payment/ledger tie-out, payout attribution, refund/failure handling, and cross-association rejection.

## Plaid and reconciliation

Plaid link/feed and reconciliation code exists, including a protected background reconciliation route. Status: **NOT TESTED end to end**. Required proof is sandbox link, sync/retry, unmatched/partial/full matches, duplicate feed item handling, payout-to-bank matching, and exception-queue evidence.

## Report implementation truth

The report catalog exposes 119 report definitions. Static and UI inspection found 18 live implementations. The remaining queued path calls the database RPC `report_data_dispatch`.

`report_data_dispatch` appears in generated database types and runtime code but is absent from the local migration directory. Therefore queued/scheduled report execution is **BROKEN or NOT REPRODUCIBLE** from source until the exact remote SQL definition is recovered or a reviewed forward migration implements every catalog slug.

No report should be removed to mask this gap. Each definition must receive:

1. a scoped, permission-safe data implementation;
2. deterministic fixture totals;
3. UI/CSV/JSON/PDF parity checks;
4. empty/error/large-data checks;
5. a scheduled-run test where scheduling is offered.

## Clearing accounts and trust considerations

The code cannot decide the legal/accounting policy for custodial funds. Before enabling real payments, the business must approve merchant-of-record, association-owned connected accounts, operating/reserve treatment, clearing accounts, refunds/chargebacks, escheat/unapplied cash, and trust-account requirements with qualified accounting/legal review.

## Prelaunch financial acceptance test

Create a reversible staging association containing opening balances, regular and special assessments, partial and excess receipts, late fee, credit, vendor bill/payment, transfer, failed/reversed payment, Stripe test payment, unmatched/partial/full bank matches, and a period-close scenario. For each source transaction record the database mutation, journal lines, owner balance, association cash, bank-feed effect, reconciliation status, audit event, UI result, export result, and rollback/error behavior.
