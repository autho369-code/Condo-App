## docs/brain/Shipped.md (lines 1-310)

Scope: lines 1-310 only. I checked the money, ledger, permission, isolation, payment and email claims against the latest migration that defines each function or policy, and against the app code. The report lists only the divergences.

- **Major: a buyer can still read the seller's payment history (payment_applications).**
  - Claim (line 61): "a buyer can't read the seller's paid charges or statements".
  - Evidence: `supabase/migrations/20261014000000_money_policies_without_nested_rls.sql:113-114`: `payment_apps_resident_read` USING `payment_id in (select rls_private.resident_payment_ids())`. `rls_private.resident_payment_ids()` (`:72-81`) returns every payment whose `unit_id` is in `current_resident_unit_ids()`, with no tenure or move-in cutoff. `20261014190000_owner_portal_fixes.sql:100` then made it `security definer`, so it is no longer limited by `payments_resident_read`. `20261016010000_ownership_fixes.sql:546-571` narrowed only `charges_resident_read` and `statements_resident_read`. It did not touch `payment_applications`.
  - Why it diverges: through the API, a buyer reads every `payment_applications` row of every payment ever made on the unit, including the seller's payments: `payment_id`, `charge_id`, `amount_applied`, `applied_at`, `applied_by` and `notes`. The charge rows are hidden, but the seller's payment amounts and dates are not. Line 176-177 ("a buyer's balance counts the seller's payments") needed the balance, which `resident_unit_balances()` already provides as a definer function. The raw application rows did not need to be exposed.
  - Severity: Major. This leaks the previous owner's payment data to the new owner. The data is financial but has no names or account numbers. Raise it to Blocker if seller payment privacy is treated as a hard rule.

- **Nit: a late Stripe "succeeded" event is guarded against refunds only, not against returned or canceled.**
  - Claim (line 180): "refunds can't be undone by a late Stripe message".
  - Evidence: `app/api/stripe/webhook/route.ts:637` calls `postLedgerPayment` before any status check. `:651-653` guards the status update only with `.not('status','in','("refunded","chargeback")')`. The checkout handler in the same file (`:546-549`, `:567`) treats `returned` and `canceled` as final too.
  - Why it diverges: the refund case holds. But a `payment_intent.succeeded` that arrives after an intent is `returned` or `canceled` flips it back to `succeeded`. It also re-runs the receipt email and the event log, because `wasSucceeded` is false. The two handlers protect different sets of statuses. No code path sets `returned` today (only the CHECK constraint allows it), so the practical impact is low.
  - Severity: Nit.

- **Nit: the migration check for "CREATE POLICY without a TO clause" is a text match.**
  - Claim (lines 295-296): "the migration check fails a new CREATE POLICY without a TO clause".
  - Evidence: `scripts/check-supabase-migrations.mjs:80-81,190-196`. It looks for `to\s+(authenticated|anon|service_role)` anywhere between `create policy` and the next `;`. That includes text in USING expressions and string literals.
  - Why it diverges: `ALTER POLICY ... TO public` is not checked. The enforcement in `20261012010000_policies_signed_in_only.sql` was a one-time sweep of the `public` schema only, so `storage.objects` policies were not covered by the "signed-in only" sweep. I did not find a current violation.
  - Severity: Nit.

- **Nit: the browser test count does not match the claim.**
  - Claim (line 15): "Playwright, 19 tests over receivables, late fees, check payments, violations/fines, payables/check runs and company isolation".
  - Evidence: `e2e/tests/01-receivables.spec.ts` through `04-isolation.spec.ts` contain 16 `test(` calls (5+4+4+3).
  - Why it diverges: the stated count is wrong, or some of those tests were removed later.
  - Severity: Nit.

- **Unverified: suspended-company hold, which is enforced only at the claim and cron functions.**
  - Claim (line 52): "a suspended company's email, texts, mail, webhooks, AutoPay, scheduled reports, management fees, late fees and automation flows are held".
  - What I checked: the latest definitions still hold suspended companies. `20261027010000_hold_resident_email_one_association.sql:133` (email), `20261016130000_admin_operator_fixes.sql` (sms, mail, webhooks, autopay, reports, mgmt fees, automation), and `20261016230000_inventory_reactivation_decisions.sql:223-226` (late fees).
  - Not checked: whether manual paths bypass the hold, for example "Generate now", a manual `run_management_fees`, or a manual late-fee run. The migration comment itself says manual management-fee runs are not held.

- **Unverified: confidential meetings and the staff update policy.**
  - Claim (line 195): "Executive sessions are hidden from staff not assigned to the association".
  - What I checked: SELECT is fixed (`20261014140000_executive_session_staff_visibility.sql:10-28`).
  - Not checked: `meetings_staff_update` and `meetings_staff_delete` (`20260803070000_secure_meeting_governance.sql:118-160`) use `can_edit_association_mvp` without the confidential-meeting set. Staff who can edit the association but are outside the confidential set may still be able to update or delete an executive session they cannot read. I did not confirm whether such a role exists.

No other drift found in the claims I checked:
- email 5,000/hour limit and created_at stamping
- platform_mail set by the server only
- sign-in link rows hidden
- payment and charge same-unit trigger
- seed_standard_charge_categories grants
- accounting_periods writes revoked, scoped-manager block and year-end reopen block
- undo reconciliation closed-month check
- lockbox, recurring JE and management_fees direct writes revoked (no app writers)
- PO-within-approval with a PO row lock
- payable_bills direct writes revoked
- insurance notes moved to a private table, and the view is security_invoker
- AutoPay "online payments off" enforced in the cron route
- 1099 pages finance-only
- report download through session RLS
- webhook SSRF IPv6 handling
- CSP nonce
- smoke workflow
- support_phone
