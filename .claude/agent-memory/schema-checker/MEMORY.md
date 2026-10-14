# schema-checker memory

## Recurring mistakes
- Tables/columns that never existed: `bills`, `budgets`, `bank_accounts.balance`, `work_orders.owner_id`.
- Embeds need a real foreign key: `created_by(full_name)` on `service_requests` fails (not an FK to a public table).

## How coverage works
- `npm run check:columns` parses selects with the TypeScript parser, resolves constants (incl. imports) and same-file parameters.
- Unreadable selects go in `supabase/unchecked-selects.json` with a reason; each needs its own covering test.

## Hand checks
- `.update()` payloads often use conditional spreads `...(cond ? { col: v } : {})` (e.g. lib/rpcs/portfolio.ts updatePortfolioPolicy): check the keys inside spreads too.
- For CHECK-constraint migrations, confirm the column's nullability in the baseline (`20260715040000_production_schema_baseline.sql`); a CHECK on a nullable column lets NULL through.

## RLS read-back (`.update(...).eq(...).select('id')` "not saved" checks)
- Adding `.select()` adds no new RLS constraint when the update already has a column filter (`.eq('id')`): Postgres applies SELECT USING to the existing row (filtered) and the new row (error) once a WHERE clause reads the table. An empty result means the row was not updated; that is a real failure, not a false alarm. Still compare SELECT and UPDATE policies, because a narrower SELECT already blocked writes silently. Example: meeting_action_items select needs can_access_confidential_meeting_mvp, update needs can_edit_association_mvp (2026-10-07 silent-save sweep).
- Find policies by grepping the baseline (`"public"."<t>"` quoted form) and later migrations (`public.<t>`, `alter policy`, and DO-loop `format(... %I)` arrays such as operator_writes_need_admin and staff_association_in_company, which are restrictive write-only policies).

## Nullability and sender checks
- Nullability: read the `CREATE TABLE` block in the baseline (no `NOT NULL` = nullable), then grep migrations for `alter column <col>` / `set not null`; `lib/types/database.ts` Insert types (`col?: T | null`) confirm it fast.
- `email_queue.from_name = null` is the white-label path: `app/api/email/process-queue/route.ts` fills the company name/sender when `portfolio_id` is set and `from_name` is blank (e.g. app/api/stripe/webhook/route.ts:81, 2026-10-07).
- When a `select('*')` is narrowed to explicit columns, compare against the consumer's TS interface and every `r.<field>` it reads (e.g. house_rules in app/(public)/report-violation/page.tsx vs report-violation-form.tsx `HouseRule`).

## Public token pages
- Token lookups: `signature_signers.token_hash` and `document_request_links.token_hash` are UNIQUE (so `.maybeSingle()` is safe); hex digest from `hashSigningToken` is lowercase, matching the RPCs' `lower(p_token_hash)`. `vendor_request_session` jsonb includes `portfolio_id` (20260929220000). Company lookup helpers live in `lib/tenant/token-company.ts` (2026-10-08, all clean).

## Portfolios embeds
- `portfolios` has no column-level grants (baseline GRANT ALL to authenticated); reads go through `portfolios_staff_read` (is_any_staff/is_company_admin AND id = current_portfolio_id()) or `portfolios_platform_read`. `portfolios_admin_own` is disabled (USING false). Embed via `associations.portfolio_id` FK is fine for staff (2026-10-08, profile page slug/custom_domain embed clean).

## Optimistic-lock filters (compare-and-set updates)
- `.eq('<timestamptz col>', valueReadBack)` round-trips: PostgREST returns full microsecond ISO with `+00:00`, and postgrest-js uses `URL.searchParams.append`, so `+` is encoded as %2B. Null previous values need `.is(col, null)`. A nullable CHECK status needs `.or('status.is.null,status.neq.X')`. Check for BEFORE UPDATE triggers that rewrite the guarded column (maintenance_tasks has only `move_private_fields` on notes). Example: app/(app)/maintenance/page.tsx completeTask (2026-10-08, clean).

## Enum/status quick refs
- `occupancies.status` is enum `occupancy_status` ('current','future',...); `tenants.status` CHECK ('active','ended'); `tenants.archived_at` exists. `occupancies.association_id` -> associations FK (embed `associations(portfolio_id)` ok). `document_templates.portfolio_id` NOT NULL. (2026-10-08, occupancy-actions recipient-company change clean.)

## Cross-company FK checks
- `associations.property_group_id` -> property_groups FK accepts any company's group; app checks `property_groups.select('id').eq('id').eq('portfolio_id')` (read policy `property_groups_staff_read` = can_access_portfolio) and migration 20261008030000 adds trigger `associations_property_group_same_company` (errcode 23503). No new columns. (2026-10-08, associations/new + lib/rpcs/entities.ts createBuilding clean.)

## Idempotency / RPC return quick refs
- `email_queue.idempotency_key` has a full (non-partial) unique index `email_queue_idempotency_key_unique` (20260730003000), so `.upsert(..., { onConflict: 'idempotency_key' })` works. `form_submissions` cols: token, kind, result_id (uuid), created_by, created_at.
- RPC returns: `post_ad_hoc_charge` returns a `charges` row (use `.id`); `charge_back_work_order` returns a bare uuid. `calendar_event_reminders` links via `calendar_event_id` (not event_id), times in `remind_at`. (2026-10-08 diff vs dbf551c4, all clean.)

## Type mismatches the column check cannot see
- `gl_accounts.number` is INTEGER (1000-9999 CHECK): PostgREST returns a JS number, so a Map keyed by the CSV string never matches, and a non-digit value (e.g. "6371.01") in `.in('number', …)` fails the whole query with 22P02. Example: app/(app)/owners/import/appfolio/vendor-actions.ts:106-113,141 (2026-10-08).
- AppFolio import quick refs (2026-10-08, clean): enums work_order_status/priority/category, gl_account_type, gl_fund_account, vendor_payment_type (check/echeck/ach/online), recurring_frequency; `import_opening_balance(p_unit_id,p_charge_category_id,p_amount,p_description,p_as_of)` writes imported_balances.memo = p_description; `rpt_prm` returns aid/df/dt/cmp.

## owners.association_id (20261009010000, NOT NULL)
- Every owners insert/upsert must set `association_id` (trigger raises 23502 otherwise and derives portfolio_id). Find writers with `grep from('owners')...insert` plus `upsert('owners'` in scripts and `insert into public.owners` in supabase/tests; `tests/database/owners-belong-to-association.test.ts` scans payloads. Occupancies trigger refuses an owner of another association. `idx_owners_auth_user` is no longer unique: any `.eq('auth_user_id').maybeSingle()` on owners needs `.order().limit(1)` (forgot-password fixed 2026-10-09). `lib/types/database.ts` owners types lacked association_id then (callers use `as any`).

## vendors.association_id / is_management_company (20261009020000)
- CHECK `vendors_association_or_management_company`: association vendor needs association_id; management company has none. Trigger `trg_vendors_set_portfolio_from_association` derives portfolio_id, so inserts may omit it (seed-real/seed-comprehensive do). `tests/database/vendors-belong-to-association.test.ts` scans insert payloads.
- `vendors(...)`/`associations(name)` embeds are unambiguous: only one direct FK, and tables with both vendor_id and association_id FKs (work_orders, payable_bills, ...) have `id` PKs, so PostgREST does not treat them as many-to-many junctions. (2026-10-09, clean.)

## owner_portal_logins (20261009050000)
- Mirrors vendor_portal_logins: cols auth_user_id, invitation_id, linked_at, owner_id (PK), portfolio_id, revoked_at; auth_user_id FK -> auth.users is NOT in schema-foreign-keys.json (snapshot lists public FKs only, by design). Owner invites carry `association_id` + `metadata.owner_id`; revoke filters use `.or('metadata->>owner_id.eq.X,metadata->>owner_id.is.null')` (metadata is jsonb, valid). (2026-10-09, clean.)

## Owner login part 2: me.owner_ids (20261009060000)
- Portal reads moved from `.eq('owner_id', me.owner_id)` to `.in('owner_id', me.owner_ids)`; writes use the record holding the unit (`ownerRecordForUnit` in lib/portal/own-units.ts, occupancies owner_id/unit_id/status/created_at). `submit_owner_message` has a 4-arg overload `(p_subject,p_body,p_idempotency_key,p_owner_id)`; the 3-arg one delegates via current_owner_id(). All columns used in the RPC body exist (communications_log.idempotency_key, email_queue.communication_log_id, portfolios.support_email, profiles.disabled_at). (2026-10-09, clean.)

## CSV import RPCs (import_journal_entry_batch / import_bills)
- `import_journal_entry_batch(p_name text, p_rows jsonb)`: full body in 20260930122000_csv_imports_review_fixes.sql; later migrations patch it by string replace (123000 csv_money/csv_date, 132000 can_manage_association, 20261009090000 truncate). Row keys: row, entry, date, association (uuid or name), gl (uuid or number text), debit, credit, memo. Returns {ok, errors[<=50], error_count} or {ok, batch_id, entries, total}. `csv_gl_id` filters `g.active` and prefers the association's own account. `gl_accounts.active` is NOT NULL default true. Callers: lib/rpcs/imports.ts, previous-system/gl-actions.ts postOpeningBalancesFromTrialBalance (2026-10-10, clean).

## Set-returning RPCs + paging
- `db.rpc('fn').select('cols').order('col').range(a,b)` is valid PostgREST (select/order/limit/offset apply to `returns table(...)`/setof results); check:columns does not cover rpc selects, so compare against the `returns table` list by hand. Example: app/(app)/projects/page.tsx capital_project_spend_totals (2026-10-10, clean).
- Same check for `fetchAllRows(() => db.rpc(...).order('<unique out col>'))`: compare the caller's row mapping to the `returns table` list and confirm every caller passes the args (e.g. lib/banking/reconciliation.ts bank_reconcilable_lines needs `bank.id`; both bank-reconciliation routes select it). (2026-10-13, clean.)
- jsonb-returning RPCs (e.g. `receivables_page_totals`, 20261011100000): check:columns cannot see them; match every `jsonb_build_object` key and nested `to_jsonb(t)` field against what the page reads, and diff the old per-view queries' filters (e.g. `reversed_at is null`) against the function body (2026-10-10, clean).
- On Windows, check:columns may print "can't check statically" + "no longer in the code" pairs for the same entry (backslash vs slash path in unchecked-selects.json): a path-separator artifact, not a schema problem.

## Column-level revokes (user_invitations.token, 20261014220000 §6e)
- A revoked column breaks user-client `select('*')`, `.insert().select()` returning it, AND `.eq('<col>')` filters (WHERE needs SELECT on the column). All token reads/filters use `createServiceClient()` (invite, accept-invitation, lib/auth/actions.ts, owner-invitation callers pass svc); `v_pending_invitations` is invoker and omits token. Re-grep `from('user_invitations')` + check the client per call (2026-10-13, clean).
- email_queue user-insert guard (`email_queue_insert_problem`): from_name must equal company/association name, reply_to = support_email / caller's JWT email / verified domain, owner_id must be the owner addressed (owners.email or `emails` jsonb). Check these when a diff touches queue rows.

## Linked-record scope helper
- `checkLinkedRecords` (lib/security/association-scope.ts) validates building/unit/vendor/owner ids vs association (unit via `buildings!inner(association_id)`); `calendar_events.unit_id` has no FK in the snapshot, so this app check is the only guard (2026-10-12, calendar/new UnitSelect clean).

## Paging / count refs
- `fetchAllRows` (lib/supabase/fetch-all.ts) pages with `.range()`; each builder must end its order with a unique column (`.order('id')` tiebreak). `!inner` embed filters (`.eq('building.association_id')`) and `{ count: 'exact', head: true }` with `.in/.eq/.gte` are valid with range/limit; two-level `unit:units!inner(building:buildings!inner(association_id))` + `.eq('unit.building.association_id')` is fine (occupancies/tenants each have one FK to units and owners). `unit_balances` and `v_charge_balances` are one row per unit/charge, so `.order('unit_id')`/charge_id is a unique tiebreak. `violation_status` enum: open, notice_sent, hearing_pending, cured, fined, closed (2026-10-12, silent-row-cap clean).

## Payables / approvals quick refs (20261014150000)
- `gl_account_type` expense-like values: expense, cost_of_goods_sold, other_expense. `approval_request_status`: pending/approved/rejected/cancelled; `approval_decisions.decision` CHECK approve/reject/abstain, UNIQUE (approval_request_id, decided_by). `board_approval_settings.sends_bills_to_board` CHECK never/always/over_threshold. New RPCs `set_payable_bill_expense_account(p_bill_id,p_gl_account_id)`, `record_approval_decision(p_request_id,p_decision text,p_note)`; a trigger blocks approval_requests -> 'approved' unless `app.approval_decision`='on'. `fetchAllRows` returns `{rows, truncated, error: string|null}` (error is already a string). (2026-10-13, clean.)

## Resident calendar / balances RPCs (20261014190000)
- Residents read events via `resident_calendar_events(p_association_ids,p_from,p_to,p_limit)` (direct calendar_events resident/tenant policies set USING false); it keeps association and company-wide (`association_id is null`) events as the old policies did, and shows unit events only from the resident's start date. `resident_unit_balances()` returns unit_id/balance for all current_resident_unit_ids (filter to the page's unitIds). `calendar_events.title/location` are text, event_type enum `event_type`. Board ARC/WO message inserts were already disabled (20261005111000), so ARC author triggers forcing 'owner' don't regress the board. (2026-10-13, clean.)

## Enum values in insert payloads (check:columns cannot see them)
- `sms_status` enum is queued/sent/delivered/failed/read/undelivered: there is NO 'received' (lib/sms/inbound-reply.ts insert, 2026-10-13). `sms_direction` inbound/outbound. Always grep `AS ENUM` in the baseline + `add value` in migrations for every literal status a payload writes.
- `sms_messages` AFTER INSERT trigger `sync_sms_conversation_on_message` already bumps last_message_at/preview/unread_count; a manual conversation update after insert is redundant and races.
- SMS refs: sms_messages.from_number/to_number text NOT NULL (no CHECK); `provider_message_id` partial UNIQUE (20261014233000) so update-by-sid `.maybeSingle()` is safe; sms_conversations.our_phone_number nullable, no unique; only BEFORE UPDATE touch_updated_at triggers (2026-10-13, sms-sender-routing clean).

## Email suppression (20261015010000)
- email_queue.mail_class ('required'/'optional', NOT NULL) + suppressed_at; tables email_suppressions (UNIQUE portfolio_id,email,reason; reason unsubscribed/bounced/complained), email_suppression_events, email_unsubscribe_links (PK queue_id, no user grants: service client only). Service-role RPCs: email_prepare_batch(p_ids) returns id/suppressed/unsubscribe_token/unsubscribe_url, email_unsubscribe_session(p_token) jsonb, email_set_unsubscribed(p_token,p_unsubscribed,p_source), email_suppress_from_event(p_provider_message_id,p_reason,p_detail); authenticated clear_email_bounce(p_suppression_id). Reads of email_suppressions by email alone should also filter portfolio_id (operators see every company). (2026-10-13, clean.) (The email page now filters the bounce lookup by the email's company.)

## Bank reconciliation undo (20261015020000)
- bank_reconciliations gained undone_at/undone_by/undo_reason (snapshot updated); status CHECK in_progress/completed/void. RPC `undo_bank_reconciliation(p_reconciliation_id uuid, p_reason text)` returns void, reason >= 10 chars. Patched `set_accounting_period_status` locals: period_row, start_date, end_date. lib/types/database.ts lacks the new cols (page uses `any`). (2026-10-13, clean.)

## RPC returning `setof <table>` + embeds
- `db.rpc('fn', args, { count: 'exact' }).select('..., assoc(name), vendors:fk_col(name)')` works when the function `returns setof public.<table>`: PostgREST uses that table's FKs for embeds, and filters/order/range apply. Verify the embeds against the base table's FKs. Example: inspection_search (20261015110000) on app/(app)/inspections/page.tsx:86. `inspections.inspection_type` is text (ilike ok). `amenity_reservations.status` CHECK: pending/approved/denied/cancelled. (2026-10-14, clean.)

## Owner portal quick refs (2026-10-14, owner-portal-fixes clean)
- Removed late fee = payments row via `post_homeowner_credit` (method 'credit'), then reference set to 'Late fee removed' (20261015040000/050000); app helper `isLateFeeRemoval` in lib/portal/ledger-rows.ts needs `reference` selected. `payment_intents.status` CHECK: pending/processing/succeeded/failed/canceled (one l)/returned/refunded/chargeback. `occupancies.allow_online_payments` exists. payments, violations, work_orders each have ONE FK to units (embeds unambiguous); `v_charge_balances` has no FK (load unit names separately).
## Ownership windows (20261016010000, 2026-10-14 clean)
- Owner detail page builds `.or('and(unit_id.eq.U,due_date.gte.X,due_date.lt.Y),...')` (lib/owners/ownership-window.ts): check:columns cannot see `.or()` strings, so check those columns by hand. `receivable_payments_ledger.owner_id` = unit_owners owner on payment_date (falls back to occupancies), end_date inclusive. `parking_assignments.status` CHECK active/ended.
## Reports quick refs (20261016100000, 2026-10-14 clean)
- Fiscal year: `associations.fiscal_year_start` and `portfolios.fiscal_year_start_month` are smallint 1-12 NOT NULL. Report files: bucket `reports`, path `<portfolio_id>/<run_id>.<output_format>`; storage policy `reports_staff_read` parses exactly that. Enums: report_run_status queued/running/succeeded/failed/cancelled; report_delivery_channel email/portal/webhook/download_only; `scheduled_reports.delivery_targets` jsonb. Fast multi-table column check: a node one-liner over schema-columns.json (top-level `{table: [cols]}`).
## Anchor-patch migrations (string replace of pg_get_functiondef)
- Verify each anchor against the LATEST prior definition (grep the anchor text across migrations; it may live inside an earlier patch's `$n$` string, e.g. rate_work_order's `wo.created_at::date >= ...current_resident_unit_since` from 20261014090000:51). `create or replace` must keep the return type (current_resident_unit_ids setof uuid, resident_unit_tenure table(unit_id,since)).
- Work-order refs: `service_requests.number` is TEXT (ilike ok; gl_accounts.number is integer); `service_request_status` enum open/completed/cancelled/waiting; `association_local_date(uuid, timestamptz)`; `current_vendor_ids()` setof uuid; RPC `vendor_work_order_permission_to_enter(p_work_order_id)` returns boolean (20261015170000, 2026-10-14 clean).
- `service_requests.source` is enum `service_request_source` resident/internal/recurring; nightly `generate_recurring_work_orders` (20261005051000) writes source 'recurring' and WO status 'assigned' when vendor set. work_orders -> service_requests has one FK (service_request_id). (2026-10-14, notify-recurring clean.)
## Write revokes (20261016200000 gl_close_fixes, 2026-10-14 clean)
- Before accepting a `revoke insert, update, delete` on a table, grep `'<table>'` across app/lib/scripts for direct writes (multi-line builders too); lockbox_batches/items, recurring_journal_entries, management_fees were select-only. `gl_account_map_scope_key` is an expression index matching `on conflict (portfolio_id, coalesce(association_id,'0..0'::uuid), map_key)`; `app_is_repair_session()` lives in 20261014130000.
