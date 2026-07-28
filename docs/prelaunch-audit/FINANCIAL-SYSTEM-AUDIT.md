# Financial system audit

## Current conclusion

The owner receivable subledger ties for the production sample, and every existing journal batch is balanced. Portier369 is **not yet accounting-certified or ready for live payment processing** because receipts do not create transaction-level general-ledger entries, Stripe is not configured for either association, bank-feed/reconciliation tables contain no exercised production data, and the full staging workflow has not been replayed.

All database evidence below was obtained with read-only queries. No production records, payments, notifications, or provider events were created.

## Production tie-outs observed on 2026-07-28

| Area | Records | Amount | Result |
| --- | ---: | ---: | --- |
| Charges | 36 | $10,650.00 | Source population |
| Payments | 24 | $8,400.00 | Ties to applications |
| Payment applications | 24 | $8,400.00 | Ties exactly to payments |
| Open receivables | 12 | $2,250.00 | Charges minus applications ties exactly |
| Assessment journal batch | 1 entry / 2 lines | $10,500.00 debit and credit | Balanced |
| Payment journal batch | 1 entry / 2 lines | $8,400.00 debit and credit | Balanced in aggregate |
| Bill journal batch | 1 entry / 3 lines | $2,050.00 debit and credit | Balanced |
| Transfer journal batch | 1 entry / 2 lines | $3,000.00 debit and credit | Balanced |

The sampled report totals also balanced: Trial Balance debit/credit $23,950.00; Balance Sheet assets and liabilities plus equity $13,500.00; Income Statement net income $11,450.00; A/R Aging $2,250.00.

## Ledger model and confirmed gap

Manager-recorded receipts insert into `payments`. The `trg_auto_apply_payment` path allocates the receipt into `payment_applications`, which updates `v_charge_balances`, `unit_balances`, and aging. Stripe success follows the same subledger path through `post_stripe_ledger_payment`.

The online-payment migration explicitly says that v1 creates no additional journal entry. Therefore a new manual or Stripe receipt can update the owner balance without creating a corresponding transaction-level cash/clearing and A/R journal entry. The one production payment journal is an aggregate $8,400 batch and its `source_id` does not link to any of the 24 payment IDs. This is internally balanced but does not prove per-payment traceability, reversal handling, cash attribution, or audit completeness.

Required accounting decision: approve and implement either (a) Dr Cash / Cr A/R when an offline receipt is recorded and Dr Clearing / Cr A/R then Dr Cash / Cr Clearing for Stripe settlement, or (b) another accountant-approved control-account design. The posting must be atomic, idempotent, association-scoped, reversible, and tied to the source payment/provider event.

## Provider and reconciliation state

- Associations: 2 active.
- Stripe connected accounts: 0; charges enabled: 0; details submitted: 0.
- Stripe payment intents: 0; provider intents: 0.
- Plaid items: 0; bank transactions: 0; bank reconciliations: 0.
- Online payment, payout attribution, bank-feed matching, exception handling, reversal, refund, and duplicate webhook behavior are therefore code-present but not operationally proven.
- Each association must complete its own Stripe Connect onboarding; one shared platform merchant account is not an acceptable substitute for the stated operating model.

## Report remediation in the audit branch

- Trial Balance and Balance Sheet read posted journal lines through the report's as-of date.
- Financial reports include shared accounts plus the selected association's accounts, not other associations' accounts.
- Normal-balance and section classification is centralized and unit-tested.
- Export output is serialized as CSV, JSON, or a real PDF; unsupported configured formats are rejected.
- The legacy `homeowner_vehicle_info` URL maps to the canonical owner vehicle report.

## Mandatory staging certification

Replay opening balances, assessment, special assessment, late fee, credit, partial/overpayment, offline receipt, test-mode ACH/card, failed payment, reversal/refund, bill approval/payment, transfer, unmatched/partially matched/reconciled bank transactions, and duplicate/concurrent webhooks. For every transaction verify source record, applications, journal entry and lines, owner balance, association cash/clearing, provider event, reconciliation state, audit record, UI, export, and rollback behavior.
