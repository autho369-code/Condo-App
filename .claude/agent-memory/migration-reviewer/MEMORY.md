# migration-reviewer memory

## Confirmed rules (Mirsad)
- DELETE/DROP SQL goes to Mirsad for the SQL editor; additive migrations Claude applies after merge.
- Only project `termxngysvotnfbzbgrv`; never staging or stellar-ops without asking.

## Checks that caught real bugs
- Migrations must pass `node scripts/check-supabase-migrations.mjs`.
- `payment_processor` enum value 'stripe' is LIVE (`app/api/stripe/webhook/route.ts:358` inserts payment_methods with processor 'stripe'; `select_payment_processor()` falls back to 'stripe', baseline :7794). Flag any migration that drops/recreates the enum without 'stripe' as breaking online payments, despite the old docs/TODO.md note calling it unused.

- Migration version must be a REAL UTC timestamp: `20261013240000` (hour 24) fails the checker as an invalid filename. After ...230000 use ...233000 or the next day's 000000. RECURRING (again 20261014240000_comms_followups, already applied live): if applied, check the live schema_migrations row first: apply_migration records its own real-time version (comms_followups is 20261013192146 live), so a file rename usually needs no history fix. 3rd time: 20261015240000_purchase_orders_resubmit (caller's brief didn't mention it; always run the checker first).
- In-place patches of trigger guards: `current_user` only works if the guard is NOT security definer (email_queue_guard_worker_columns isn't); check before accepting an auth.role() -> current_user swap.

## False alarms to skip
- The checker prints ~40 warnings on old, already-merged migrations even when it PASSES. Only warnings on in-scope files count. (Codex on PR #229.)
- `git show origin/main:<f> | diff - <f>` shows every line changed on Windows (CRLF checkout). Compare `git ls-tree` blob hashes or use `diff --strip-trailing-cr`.
- Get scope from `node scripts/review-scope.mjs supabase/migrations`, not a hand-written `git diff`: merge-base diffs keep squash-merged files, tip diffs pull in main-only changes. (Codex on PR #230.)

- `set plan_cache_mode = force_generic_plan` on invoker RPCs over RLS views is the house pattern (20261011110000 explains why); don't flag it. Only check a CREATE OR REPLACE keeps it.
- RETURNS TABLE names equal to view columns are fine in plpgsql if every reference is `alias.col`; only unqualified refs conflict.

## Top lessons (missed or wrong before)
- DELETE with no WHERE in a function body is a blocker (pg_safeupdate; #264 broke Bills/Journal uploads 2026-10-09).
- New company-data table needs the `operator_write_guard` statement trigger (#275 missed it, 2026-10-10).
- Before flagging an unrestricted UPDATE policy, grep ALL migrations for triggers on the table (`_000_self_service_guard`).
- INVOKER RPCs cannot call service_role-only GL helpers; a postgres-run compile/test does not catch EXECUTE gaps.
- Windowed measures (same window both sides, future-dated rows, multi-plan ownership, recheck stored statuses): see [measures-and-windows](measures-and-windows.md).
- Narrowing a permissive USING (true) policy: demand per-role before/after row counts; shared portfolio_id-NULL rows may rely on it (20261012010000).
- A tenure/scope cutoff helper that returns NULL for "no cutoff" also returns NULL when the caller has NO matching row; pair it with the same membership helper (rate_work_order 20261014090000:50 vs current_resident_unit_ids).
- A lock trigger that is BEFORE UPDATE only ("completed rows can't change") leaves INSERT-as-final-state and DELETE+reinsert open; check all three ops (20261014130000:121). Repair predicates on auth.role() IS NULL fail open; prefer also session_user <> 'authenticator'.
- A definer RPC that "reads for everyone, writes for editors" must gate the write with the SAME helper as the table UPDATE policy and re-check status after FOR UPDATE (20261014100000:67-72 does). Also ask: does the read path count the same rows as the page (date window vs status=current)?

- Narrowing a SELECT policy (e.g. exec sessions -> my_confidential_meeting_association_ids, 20261014140000): sweep DEFINER RPCs on the same rows; they bypass RLS. `can_view_association_row`/`manager_is_scoped()` is TRUE for staff with ZERO association_managers rows, so an unassigned assistant passes it (calculate_meeting_quorum).

- A BEFORE INSERT trigger that stamps author/role for "non-staff" callers also fires inside DEFINER RPCs run by non-staff (board): grep every `insert into public.<t>` in migrations. Found in 20261014190000 arch_msg_set_author (would relabel board_decide_architectural_request's 'board' rows); fixed before the PR: it now stamps only author_role='owner' rows.
- This agent has had no live DB tool (no Supabase MCP/psql/DB URL): give the caller read-only verification SQL instead of claiming live parity.

- A guard that recomputes a total from child rows must also fix the child rows' CLASS (type/sign) and forbid duplicates; recomputing amounts alone still lets a client mislabel or double a row (20261014170000 recon items). Treat every terminal status (void, cancelled) as terminal, not just 'completed'.
- Guards that pin a column back to OLD on UPDATE (`new.x := old.x`) must AUTHORIZE against OLD too. 20261014170000:510 checked the parent via new.reconciliation_id, then reset it, so naming an open recon unlocked a completed one's item (Codex P1 on #361; fix 20261014180000:32). Either look up by old.* on UPDATE/DELETE or raise if the key changes (app_guard_bank_reconciliation does the latter).
- A backfill/trigger that derives a column (fund_type from purpose) must not overwrite explicit values outside the derived set (insurance_proceeds/construction_escrow); restrict the UPDATE WHERE to null-or-derived values and ask for a pre-run count (20261014170000, Codex on #361).

- Column-freeze triggers keyed on `current_user in ('authenticated','anon')` are bypassed by every DEFINER writer (runs as owner): sweep `update/insert public.<t>` in ALL migrations + app `.from('<t>').update/insert` and confirm each definer is service_role-gated (auth.role() check + revoke/grant) and each app writer of frozen cols uses createServiceClient (20261014234500 sms_messages: clean).

- INVOKER triggers run their callees as the caller: every helper an invoker trigger calls needs EXECUTE for authenticated (first draft of 20261015010000 revoked them -> all staff sends broken; FIXED: key helpers granted :77-78, suppression moved to definer email_prepare_batch). Details in sql-pitfalls "Email suppression". RECURRING: 20261015090000:114 final guard was invoker + called `app_is_repair_session()` (revoked from authenticated) -> every API insert/update of architectural_requests would fail. Every house guard calling it is SECURITY DEFINER; grep `security definer` on each new guard.
- "Record is final" guards (BEFORE UPDATE raise when old.status decided) also block FK `ON DELETE SET NULL` updates (owner/unit/committee deletes) unless a repair session; list the table's SET NULL FKs.
- Worktree checkouts are CRLF (no .gitattributes). Multi-line anchors written as SQL literals carry \r if the file is applied from disk; normalizing only pg_get_functiondef is half the fix. Ask for `replace(anchor, chr(13), '')` or E'\n' anchors (precedent 20261015100000).

- Status labels keyed on a text marker (payments.reference 'Late fee removed'): the guard must freeze every column the label reads (reference AND method), plus a read-only count of pre-existing marker rows not written by the RPC.
- missed: #383 needed 5 Codex rounds (20261015150000-200000), one hole each: charge_id, reversed_at, payment DELETE, application DELETE, definer reallocate_payment. For a "derived label must stay true" guard, list up front EVERY row the label reads (parent, children, the labelled row itself) x {INSERT, UPDATE each read col, DELETE, FK cascade} x {direct RLS write, each authenticated-callable DEFINER that touches it}. Round 6 (20261015210000) froze the fee amount/charge_type only; trg_post_charge_to_gl reposts on ANY charges update, so a locked charge must also freeze gl_account_id, charge_category_id, due_date (GL account/date of the posting), not just amount.
- Text-patch migrations: run every multi-line anchor against the latest repo body with a node count script; a skipped comment line aborts the migration (20261015020000:56). See sql-pitfalls. (Fixed before apply: anchor, indexes, draft early-return, association_id, adjustment refused on any open reconciliation.)

- Replacing a per-row definer helper (association_local_date(pb.association_id,..)) with an inner JOIN to the parent changes semantics: rows with a NULL/hidden FK drop (payable_bills.association_id is nullable; 20261015030000 vendor_1099_totals), and the join now evaluates parent-only expressions (free-text timezone) for parents with no rows. Check nullability + RLS parity + caller's null handling.

- Revoking table DML from authenticated (20261015060000 journal_*): sweep latest bodies for invoker writers AND invoker `FOR UPDATE/SHARE` on the table (needs UPDATE priv), non-invoker updatable views over it, and later `grant ... on all tables` re-grants. FK cascades run as owner (safe). Node regex sweep over latest fn bodies works.

- Private-notes side tables (X_private): if the policy re-encodes the parent's scope instead of `staff check and exists(select 1 from parent where id=...)` (parent RLS applies inside), it drifts: 20261015080000:36-50 dropped the parent's association_id-NULL branch. Also check the side table's views keep column order (v_upcoming_expirations did).
- Removing an email-match access branch (current_board_association_ids, 20261015100000): a count=0 guard covers today only; check every FUTURE unlinked-seat path (owners/new inserts auth_user_id null; only signup/link_portal_user link by email).

- Search RPCs called as db.rpc(..).select().eq().range() (20261015110000 inspection_search): a SET clause blocks SRF inlining, so page filters/count run over the full match set; prefer OR-ed `i.x in (select ...)` sets over per-row EXISTS into tables with per-row policies (inspection_private).
- association_id NULL = "company-wide" (visible to every scoped manager) on signature_requests and similar: any create RPC taking a linked record must file under the record's association (Codex P1 #381, fix 20261015120000). A derived coalesce(p_x, v_derived) skips the checks done only on p_x (archived_at); ask for a read-only count of existing NULL-but-linked rows.

- A definer trigger that UPDATEs a guarded table still runs that table's BEFORE UPDATE guard with the CALLER's auth.uid(): a vendor/owner-fired cascade hits the non-staff branch (`new := old`, keep status only). 20261015170000 work_order_sync_request_triage sets service_requests.resolved_at, which service_request_guard_update reverts for vendors. Check the guard's pg_trigger_depth() carve-outs.
- Status backfills fire AFTER UPDATE triggers: service_requests -> completed fires dispatch_sr_webhook 'service_request.resolved' per row (customer webhooks). Ask for a pre-run count + whether historical rows should notify.
- sql -> plpgsql on SECURITY DEFINER helpers is NOT a speed change (never inlined either way; sql-pitfalls). What matters is that policies call them as `x in (select f())`; still flag bare per-row calls (20261015170000 final moved service_requests_resident_read/payment_plans_owner_read to rls_private id-set helpers).
- Child->parent status sync triggers (work_orders -> service_requests): walk EVERY transition: finish, cancel, archive, delete, move between parents, unarchive, cancelled->open. 20261015170000 final covers the first five + reopen-in-place; moving/unarchiving an open WO into a completed request leaves it completed (low); fixed by 20261015220000 (clean). Concurrency there is safe only because refresh_service_request_open_work_order (advisory lock) runs BEFORE both status branches; keep that order in any rewrite.
- Dropping a NOT NULL column default for a BEFORE INSERT trigger to fill: grep SQL-function inserts too (recurring WO generators omit created_on); safe unless a path runs with session_replication_role=replica.

- Widening "who gets a statement/notice" to past owners (period overlap, 20261016010000 generate_owner_statements): check the AMOUNTS are bounded to that owner's tenure too; unit-wide sums email the seller the buyer's total due (lib/rpcs/bulk-operations.ts sends total_due). Dropping a unit_id branch from a resident policy also drops co-owners when the generator writes one row per unit. Fix v2 capped at move_out_date-1 but only when status='past'; key tenure cutoffs on the DATE, not status (current rows can carry a future move_out_date).
- A new scope guard trigger on a write target (charges category scope, 20261016164000) must be checked against EVERY writer that PICKS the value by a looser rule: assess_late_fee / assess_association_interest / advance_violation choose categories by portfolio only (no association filter). Loops with no exception handler (post_unit_recurring_charges) abort the whole run on one bad legacy row; ask for a pre-run count of existing violators. Accepted fix: one trigger fn with tg_argv level ('company' on charges, 'association' on unit_recurring_charges) + the posting loop filters out mismatched rows.
- Overloaded RPCs with all-default tails (subscribe_unit_to_charge 6/7 args) are ambiguous unless callers pass the extra named arg; grep `.rpc('<fn>'` callers when defaults change.


- Widening a slug/name reserved list: existing rows aren't revalidated (no CHECK), but re-saving one hits the reserved raise before the `v_old = v_slug` early return; ask a count.
- Freeze guards on "final" records: confirm columns written AFTER finalize stay writable (year_end_packages.signature_request_id via link_year_end_signature; 20261016200000 correctly left it out). Delete guards using app_is_repair_session are safe for purge_rows (SQL editor: session_user postgres).
- A BEFORE DELETE guard on a child with parent ON DELETE CASCADE (gl_accounts <- associations/portfolios) also fires on parent deletes; a "has sub-accounts" check then blocks the whole cascade. OK only while no app/API path deletes the parent (grep `.from('<parent>')...delete`); 20261016200000 clean.

- Latest-body check: a node regex over all migrations for `create function` bodies misses text patches (pg_get_functiondef + replace, `pg_temp.patch_fn`); also grep the function name for `pg_get_functiondef('public.<fn>`.
- Server-only flag columns (email_queue.platform_mail, 20261016180000; clean): authenticated's table-wide INSERT grant covers new columns, so the invoker guard must force INSERT and pin UPDATE to OLD. Also grep DEFINER `insert into <t> select`/populate_record copies, and confirm app writers that set the flag use createServiceClient (else silently false).
- A migration dated before one already in the repo (180000 < 200000) is fine via apply_migration (records real time); only check the later file doesn't redefine the same functions.

- "Skip the board when within an approved parent amount" (bill on board-approved PO): verify the child cap guard (payable_bills_po_guard, FOR UPDATE on PO) and that the parent can't change after approval (save resets approval, cancel refused once po_billed > 0). Clean in 20261016220000.
- New table with an FK: check schema-foreign-keys.json too, not only schema-columns.json (20261016220000 counters refreshed columns only).

- Schedulers, local dates, pauses, recurring catch-up: see [schedulers-and-dates](schedulers-and-dates.md).
- Suggest/match RPCs: grep the page caller. feeds/page.tsx calls suggest_bank_transaction_payment per line via Promise.all (up to 50); per-call scans (plpgsql name matcher per occupancy, lockbox amount step over ALL association charges) x 50 (20261017010000). Ask for a batched or on-demand RPC.
- New side tables: house FKs to units/associations are `on delete cascade`; a bare `references` (NO ACTION) blocks unit/association purge (payment_sender_aliases 20261017010000:154-156). Still check operator_write_guard.
- Widening a CHECK by drop + re-add superset (payments_method_check) has precedent (20260930100000:12); not data-destructive, but under the literal "DROP goes to Mirsad" rule say so and let the caller decide.

- "Live body + change" CREATE OR REPLACE: grep the repo for the body's distinctive raise strings to spot live drift. validate_payment_accounts' charge_id/amount branch + trigger column list (charge_id, amount) exist live but in NO repo migration (20261017020000 brings the body in, not the trigger). No live DB tool: hand over pg_get_functiondef/pg_trigger SQL.
- payments.bank_account_id writers (2026-10-14): manual receipt/charges UI require bank.association_id = unit's (stricter than trigger); Stripe inserts no bank; lockbox needs unit in batch association (company-wide bank already fails); nothing UPDATEs bank_account_id/unit_id.

- `on conflict do nothing` against a unique index with a nullable column (uq_charge_categories_code incl. association_id) never fires for NULL rows; flag such seeds. Fix pattern: `where not exists` (20261025010000, clean). The twin trigger trg_seed_standard_charge_categories still has it (harmless: brand-new company only).

- Recipient-match holds (20261026010000 email_is_to_resident): owners.email / board_members.email can hold SEVERAL addresses (lib/calendar/reminder-delivery.ts:67,84 split them; queue rows carry no owner_id), so `lower(o.email) = to` misses; also board_members, tenancies.tenant_email. Suggest position() over the concatenated text. Check header comments against the body: its "3. health summary" step was never written.

- Association-scoped recipient holds (20261027010000 email_is_held): tenants.association_id is NULLABLE (units.building_id, board_members.association_id are NOT NULL); match tenants also via unit_id->buildings. Rows with owner_id null + free-text to_email in a held association are sent by design; say so.

- Narrowing a CHILD-row read policy (payment_applications cut to tenure, 20261031153000:24) while the parent stays visible (seller's still-open charges via resident_visible_charge_ids): invoker sum views (v_charge_balances -> v_unit_account_summary) then overstate balances. Sweep invoker views/RPCs that aggregate the child; parent and child visibility must match.

## Topic files
- [Review lessons](review-lessons.md) — more misses: definer->join swaps, DML revokes, side tables, status sync, tenure scope, scheduler holds, freeze guards, AutoPay late-fee holds
- [Schedulers and local dates](schedulers-and-dates.md) — association_local_date cost traps, suspension pauses, recurring catch-up, scheduled-report takeover
- [Measures and windows](measures-and-windows.md) — payment-plan style windowed measures: 5 Codex-caught lessons
- [SQL pitfalls](sql-pitfalls.md) — ACLs, inlining, regex/locale, re-runnability, checker false alarms, RLS hoist forms, revoke-unused-function checks, definer scope sweeps + twin drift, queue insert guards
- [Triggers and scope](triggers-and-scope.md) — trigger order on portfolios/associations/auth.users, association-scope patterns
- [Owners and vendors](owners-vendors.md) — association/login models, self-service guards, many-records-per-login checks
- [Purge and FKs](purge-and-fks.md) — cascade/NO ACTION maps, polymorphic tables, trigger re-enable pitfalls
- [Data writers](data-writers.md) — who writes token/company_name/imported_balances, receivables GL facts, GL map keys, payment reversal, bank recon writers, charge GL dating (charge_ledger_date), violation hearing clocks, meeting quorum record-vs-read, approval_requests status writers, bill payment-date rules
