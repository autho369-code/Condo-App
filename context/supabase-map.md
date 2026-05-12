# Supabase Map

This file tracks which Supabase tables are used, renamed, removed, or pending review.

No schema changes should be made from this file alone. It is an audit and approval map.

## Canonical Root

| Table | Status | Notes |
| --- | --- | --- |
| `associations` | Keep | Main HOA/condo association record. |
| `units` | Keep | Units belong to associations. |
| `owners` | Keep | Homeowners/owners connected to units and associations. |
| `occupancies` | Keep | Connects owners/homeowners to units and current/past status. |
| `vendors` | Keep | Vendor directory and vendor task workflows. |
| `email_queue` | Keep | Needed for homeowner email workflows. |
| `communication_messages` | Keep | Needed for communication history and outbound messages. |
| `documents` | Keep | Needed for forms, owner packets, vendor document requests, and generated documents. |
| `management_agreements` | Keep | Needed for owner/association management agreement workflows. |
| `vendor_compliance` | Keep | Needed for vendor documents and compliance tracking. |
| `bank_accounts` | Keep | Accounting bank-account directory and reconciliation workflows. |
| `bank_transfers` | Keep | Inter-account transfer workflow. |
| `gl_accounts` | Keep | Chart of accounts and accounting reports. |
| `journal_entries` | Keep | Journal-entry history and posting workflows. |
| `journal_lines` | Keep | Journal-entry detail rows and general-ledger reporting. |
| `payments` | Keep | Receipts and payment applications. |
| `charges` | Keep | Homeowner charges, credits, and receivable balances. |

## Needs Review

| Table/View | Suspected Issue | Proposed Direction | Approval |
| --- | --- | --- | --- |
| `property_groups` | Property terminology conflicts with Association-only direction. | Rename to `association_groups` or remove if unused. | Pending |
| `buildings` | May represent old property workflow. | Decide whether to keep as optional physical structure under Association. | Pending |
| `association_lease_template_settings` | Lease workflow excluded from Association setup. | Remove/deprecate after data dependency check. | Pending |
| `association_renewal_options` | Renewal workflow excluded from Association setup. | Remove/deprecate after data dependency check. | Pending |
| `report_data_property_directory` | Property terminology. | Rename/replace with association/unit directory report. | Pending |
| `financial_diagnostics` | Needed by reference screenshot but current backing table/view must be confirmed. | Keep or create a view only after schema audit. | Pending |
| `bank_reconciliations` | Needed for bank account and diagnostic screens, current schema must be confirmed. | Keep if present; otherwise map existing reconciliation source. | Pending |
| `bank_feed_connections` | Not present in generated Supabase types. | Treat external-provider connection as future integration; current UI uses `bank_accounts.auto_reconciliation`. | Pending |
| `gl_account_role_permissions` | Used by GL account permissions task. | Keep. | Confirmed |
| `recurring_journal_entries` | Needed by journal-entry screenshot, current schema must be confirmed. | Keep if present; otherwise mark future workflow. | Pending |
| `journal_entry_batches` | Needed by journal-entry batch upload screenshot, current schema must be confirmed. | Keep if present; otherwise mark future workflow. | Pending |

## Screen Wiring

| Screen | Tables | Status |
| --- | --- | --- |
| Associations Directory | `associations`, `units` | Context mapped, implementation pending review. |
| Homeowners Directory | `owners`, `occupancies`, `units`, `associations` | UI simplified to screenshot structure. |
| Owners Directory | `owners`, `management_agreements`, `documents` | UI simplified to screenshot structure; deeper actions pending. |
| Vendors Directory | `vendors`, `vendor_compliance`, `documents`, `payment_methods` | UI simplified to screenshot structure; deeper actions pending. |
| New Violation | `violations`, `associations`, `units`, `owners` | `/violations/new` writes draft violation records into Supabase. |
| Send Email Homeowners Modal | `owners`, `email_queue`, `communication_messages` | Captured, not implemented. |
| Move In Homeowner | `owners`, `occupancies`, `units`, `associations`, `documents` | Captured, terminology decision pending. |
| Accounting Receipts | `payments`, `payment_applications`, `charges`, `owners`, `units`, `associations`, `gl_accounts`, `bank_accounts` | Initial UI aligned; deeper actions pending. |
| Accounting Bank Accounts | `bank_accounts`, `associations`, `bank_reconciliations`, `bank_feed_connections` | Existing route wired; initial UI aligned. |
| Accounting Bank Transfers | `bank_transfers`, `bank_accounts`, `associations`, `journal_entries` | Existing route wired; initial UI aligned. |
| Accounting Journal Entries | `journal_entries`, `journal_lines`, `gl_accounts`, `associations`, `recurring_journal_entries`, `journal_entry_batches` | Existing route wired; initial UI aligned. |
| Accounting GL Accounts | `gl_accounts`, `gl_account_permissions`, `journal_lines` | Existing route wired; initial UI aligned. |
| Accounting Financial Diagnostics | `financial_diagnostics`, `gl_accounts`, `bank_accounts`, `bank_reconciliations`, `owners`, `charges`, `payments`, `associations` | Initial UI aligned; accounting diagnostic source pending review. |
| Homeowner Receipt | `payments`, `units`, `bank_accounts`, `gl_accounts` | `/payments/new` writes receipts into Supabase. |
| Homeowner Charge | `charges`, `charge_categories`, `units` | `/charges/new` writes through existing `post_ad_hoc_charge` RPC. |
| Bank Transfer | `bank_transfers`, `bank_accounts` | `/bank-transfers/new` writes transfers into Supabase. |
| New Journal Entry | `journal_entries`, `journal_lines`, `gl_accounts`, `associations` | `/journal-entries/new` writes balanced two-line entries into Supabase. |
| New GL Account | `gl_accounts`, `associations` | `/gl-accounts/new` writes chart accounts into Supabase. |
| GL Account Permissions | `gl_account_role_permissions`, `gl_accounts`, `user_roles` | `/gl-accounts/permissions` writes role-level GL permissions into Supabase. |
| Reactivate GL Account | `gl_accounts` | `/gl-accounts/reactivate` updates inactive GL accounts back to active. |
| New Bank Deposit | `payments`, `bank_accounts` | `/bank-accounts/deposits/new` assigns selected undeposited receipts to a bank account. |
| Bank Account Online Payments | `bank_accounts` | `/bank-accounts/online-payments` updates `payments_enabled`. |
| Link With Bank | `bank_accounts` | `/bank-accounts/link` updates `auto_reconciliation`; no provider connection table is currently confirmed. |
| Bank Reconciliation | `payments`, `payable_bills`, `bank_transfers`, `bank_accounts` | `/bank-accounts/reconcile` recalculates guardrails server-side and updates `last_reconciliation_date` only when balanced. |
| Apply Credits | `v_unapplied_credits`, `aged_receivables`, `payment_applications` | `/credits/apply` uses existing `apply_payment` RPC. |
| Charge Late Fees | `v_charge_balances`, `apply_late_fees` | `/charges/late-fees` previews past-due balances and runs the existing late-fee RPC. |
| Bulk Recurring Charges | `v_unit_charge_schedule`, `post_unit_recurring_charges` | `/charges/recurring/bulk` previews due schedules and runs the existing recurring-charge RPC. |
| Common Charge | `associations`, `units`, `charge_categories`, `charges` via `post_ad_hoc_charge` | `/charges/common/new` posts one ad-hoc charge per active unit in the selected association. |
| Lockbox | `lockbox_batches`, `lockbox_items`, `payments`, `bank_accounts`, `units`, `associations` | `/lockbox/new` writes lockbox batches/items and creates matched receipt payments when a unit is selected. |
| Recurring Journal Entries | `recurring_journal_entries`, `gl_accounts` | `/journal-entries/recurring/new` writes templates; list can run `generate_recurring_journal_entries`. |
| Journal Entry Batches | `journal_entry_batches` | `/journal-entries/batches/new` writes batch metadata. |
| Manually Post Journal Entries | `journal_entries` | `/journal-entries/post` updates selected draft entries to `posted = true` with `posted_at`. |

## Cleanup Rule

Before removing anything:

1. Find all UI/code references.
2. Check if the table has real data.
3. Confirm replacement table or workflow.
4. Create migration.
5. Verify app behavior.
6. Update this map.
