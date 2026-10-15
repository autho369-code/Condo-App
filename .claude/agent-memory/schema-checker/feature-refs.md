# Feature quick refs (schema facts per migration/area)

Facts verified during past reviews. Re-verify against snapshots/migrations before relying on them.

## Public token pages
- `signature_signers.token_hash` and `document_request_links.token_hash` are UNIQUE (`.maybeSingle()` safe); `hashSigningToken` hex is lowercase, matching RPCs' `lower(p_token_hash)`. `vendor_request_session` jsonb includes `portfolio_id`. Company lookup helpers: `lib/tenant/token-company.ts` (2026-10-08).

## Portfolios embeds
- `portfolios` reads go through `portfolios_staff_read` (is_any_staff/is_company_admin AND id = current_portfolio_id()) or `portfolios_platform_read`; `portfolios_admin_own` disabled. Embed via `associations.portfolio_id` fine for staff (2026-10-08).

## Enum/status
- `occupancies.status` enum `occupancy_status` ('current','future',...); `tenants.status` CHECK active/ended; `tenants.archived_at` exists. `document_templates.portfolio_id` NOT NULL.
- `violation_status`: open, notice_sent, hearing_pending, cured, fined, closed. `payment_intents.status`: pending/processing/succeeded/failed/canceled/returned/refunded/chargeback. `amenity_reservations.status`: pending/approved/denied/cancelled. `parking_assignments.status` active/ended.
- `sms_status`: queued/sent/delivered/failed/read/undelivered (NO 'received'); `sms_direction` inbound/outbound.
- `gl_account_type` expense-like: expense, cost_of_goods_sold, other_expense. `approval_request_status` pending/approved/rejected/cancelled; `approval_decisions.decision` approve/reject/abstain.
- `service_request_status` open/completed/cancelled/waiting; `service_request_source` resident/internal/recurring. `report_run_status` queued/running/succeeded/failed/cancelled; `report_delivery_channel` email/portal/webhook/download_only.
- AppFolio import enums: work_order_status/priority/category, gl_account_type, gl_fund_account, vendor_payment_type (check/echeck/ach/online), recurring_frequency.

## Cross-company FK
- `associations.property_group_id` same-company enforced by trigger `associations_property_group_same_company` (20261008030000) plus app check.

## RPC returns
- `post_ad_hoc_charge` returns a `charges` row; `charge_back_work_order` bare uuid; `bulk_create_charges`/`bulk_create_recurring_charges` return TABLE (array of one row); `subscribe_unit_to_charge` returns `unit_recurring_charges` row. `import_opening_balance(p_unit_id,p_charge_category_id,p_amount,p_description,p_as_of)`. `rpt_prm` returns aid/df/dt/cmp.
- `import_journal_entry_batch(p_name, p_rows jsonb)`: body in 20260930122000, patched by 123000/132000/20261009090000. Row keys row/entry/date/association/gl/debit/credit/memo.
- `email_queue.idempotency_key` full unique index (upsert onConflict ok). `calendar_event_reminders.calendar_event_id`, `remind_at`.

## Owners / vendors
- owners.association_id NOT NULL (20261009010000): every insert/upsert sets it; `idx_owners_auth_user` not unique, so `.eq('auth_user_id').maybeSingle()` needs `.order().limit(1)`.
- vendors CHECK `vendors_association_or_management_company`; trigger derives portfolio_id. vendors/associations embeds unambiguous.
- owner_portal_logins mirrors vendor_portal_logins; auth.users FKs are not in schema-foreign-keys.json (by design). Portal reads use `.in('owner_id', me.owner_ids)`; `submit_owner_message` has 3- and 4-arg overloads.
- Removed late fee = payments row via `post_homeowner_credit` with reference 'Late fee removed' (`isLateFeeRemoval` needs `reference`). `receivable_payments_ledger.owner_id` = unit_owners owner on payment_date.

## Payables / calendar / SMS / email
- RPCs `set_payable_bill_expense_account(p_bill_id,p_gl_account_id)`, `record_approval_decision(p_request_id,p_decision,p_note)`.
- Residents read events via `resident_calendar_events(p_association_ids,p_from,p_to,p_limit)`; `resident_unit_balances()`; parking via `portal_parking_assignments()`.
- `sms_messages` AFTER INSERT trigger already updates the conversation; `provider_message_id` partial UNIQUE.
- Email suppression (20261015010000): email_queue.mail_class/suppressed_at; email_suppressions UNIQUE (portfolio_id,email,reason); filter by portfolio_id too. email_queue user-insert guard rules on from_name/reply_to/owner_id.
- `user_invitations.token` column revoked: reads/filters must use the service client.

## Banking
- bank_reconciliations undone_at/undone_by/undo_reason; `undo_bank_reconciliation(p_reconciliation_id,p_reason)`.
- Zelle (20261017010000): bank_transactions.original_description/payer_name/payment_reason (service-role writes only), associations.zelle_recipient/_name (finance-only guard), table payment_sender_aliases. RPCs `suggest_bank_transaction_payment(p_id)` -> table(unit_id,unit_label,owner_name,confidence,reason); `receive_bank_transaction_as_payment(p_id,p_unit_id,p_remember_sender)`. bank_transactions.match_method has no CHECK; bank_transactions.plaid_item_id stores plaid_items.id (2026-10-14 clean).

## Reports / fiscal / suspension
- `associations.fiscal_year_start`, `portfolios.fiscal_year_start_month` smallint 1-12. Report files: bucket `reports`, path `<portfolio_id>/<run_id>.<output_format>`.
- `portfolios.suspended_at` gates claim/cron functions; `email_queue.portfolio_id` nullable. `my_admin_portfolio()` from 20261011010000.
- Work orders: `service_requests.number` TEXT; `gl_accounts.number` INTEGER.
