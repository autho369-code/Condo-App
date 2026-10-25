# Status

Back to [[Home]]. Updated 2026-10-25 (#279-#406 merged; #407 and #408 merged 2026-10-25; open: charge-category seed fix; next: Stripe TEST-mode checkout and AutoPay run once Mirsad sets test keys; waiting on Mirsad: NSF fee income GL constraint SQL, Auth connection pool %, Stellar support phone).

## Open PR
- claude/charge-category-seed-once: standard charge categories added once per company (20261025065558 live).

## Merged 2026-10-25
- #407 Grok review doc: what was verified vs taken from records; what takes weeks.
- #408 (merged 2026-10-25) claude/e2e-browser-tests: first browser end-to-end tests (Playwright), 19 passing: receivables (overdue dues -> late fee once -> check payment -> owner ledger), violations (notices -> hearing gate -> board upholds -> $50 fine on ledger/GL/owner), payables (bill -> approval accrues A/P -> check run #1001 -> no double pay), isolation (another company sees nothing; forged charge refused by the server); GL balance checked after every step. Runs on a local Supabase in Docker built from production's schema dump (e2e/supabase, port 55321; no production data or access) and in GitHub CI (.github/workflows/e2e.yml). Found while building: seed_standard_charge_categories duplicates when called twice (company-wide categories have association_id null, which never conflicts in uq_charge_categories_code); only the new-company trigger calls it, so no live impact.

## Merged 2026-10-24
- #405 (8c20962d) claude/grok-review-followup: Grok's outside review saved and checked point by point (docs/reviews/2026-10-24-grok-review.md; most points came from the stale 2026-08-01 root audits, now bannered HISTORICAL). Adds platform_health_summary (20261024010000 LIVE as 20261024224135 + 20261024224633 failure-time fix + 20261024230049 partial automations, both after Codex P2s; dry-run rolled back on production first, read back: definer, pinned path, anon no execute), System Monitor scheduled-job failures, daily operator alert email /api/platform/health-alert (14:30 UTC, only when something failed), 7 dark buttons -> shared Button. Security: Next.js 15.5.26 -> 15.5.28 (new advisories 2026-10: image-optimizer RCE with SVG, SSG/ISR cache poisoning, server-action DoS), DOMPurify 3.4.17, follow-redirects 1.16.1 (CI npm audit failed on them). The check found 12 pg_cron runs that failed unnoticed 2026-09-30..10-10 ("job startup timeout", the CPU episode).

## Merged 2026-10-14 (late)
- #404 portfolio_id indexes on email_suppression_events / email_unsubscribe_links (20261017030000).
- #401-#403 vault and TODO: #400 recorded; Mirsad's numbered "do these first" list.

## Merged 2026-10-14
- #400 Zelle owner payments (20261014193445 + 20261014195036): bank-feed credits received as owner payments with a suggested unit (remembered sender, memo unit number, owner name, amount; staff confirm); association Zelle recipient; owner "Pay by Zelle" panel. Automatic import waits on the live Plaid bank feed.
- #397 decisions 1-7: PO bills within a board-approved PO skip the board, vendor emailed on approval, recurring POs current period only, project committed vs spent, automatic PO numbers, POs finance-only (20261014181833 + 20261014182846). All 10 decisions done; nothing left for Claude until Mirsad sets Stripe test keys.
- #396 decisions 8-10: inventory for company admins, work order # within the company, late fees held for due AutoPay after reactivation and for money in flight (20261014181309).
- #395 platform mail flag (20261014172807).
- #393 (merged 2026-10-14) claude/reports-deep-check: deep check of reports, scheduled reports and dashboards. 20261016100000 LIVE as 20261014123933 (author dry-run on production, rolled back; read back). Fixed: people-data reports (users, permissions, login audit) limited to full-access staff/company admins; scheduled report emails only to active staff who can see the report, link requires sign-in (no 30-day public links; 15 stored links rewritten); downloads re-check access; schedules whose user lost access pause once; A/R aging matches the Receivables page (credits); fund reports tie out per fund (interfund line); association-local as-of dates; fiscal-year net income. Reviewers: security, schema, migration (twice), design (twice), white-label.
- #391 (merged 2026-10-14) claude/setup-records-deep-check: deep check of setup records (associations, units, owners,
  charges, parking, keys, letters, reminders, calendar, reserves). 20261016164000 LIVE as
  20261014122819, 20261016164100 LIVE as 20261014122901 (author dry-run on production,
  rolled back; read back). Fixed: duplicate bulk charges on double click; bulk charges to
  non-current units or other associations' categories; recurring re-run reposting a period;
  UTC instead of association dates; category scope not enforced in the database; posting to
  archived units; subscribe_unit_to_charge callable signed out; owner ACH/tax rows plantable
  by another company; Stripe Connect fields and payment settings writable by any staff;
  cascading hard deletes of units/buildings/associations; board seats, lock boxes and
  calendar reminders crossing associations; owners reading parking staff notes and prior
  owners' history; automation/calendar emails to former owners. Reviewers: security, schema,
  design, white-label, migration (two passes).
- #392 (merged 2026-10-14) claude/admin-operator-deep-check: deep check of company admin, platform operator, settings and AI assistants. 20261016130000 LIVE as 20261014123525 (author dry-run on production, rolled back; read back). Fixed: company settings writable only by the company admin (managers had direct write to MFA/AI/fees; admins couldn't save settings); staff roles editable only by the company admin/operator; a suspended company's email, texts, mail, webhooks, AutoPay, scheduled reports, scheduled management fees, late fees and automation flows are held (not dropped) until reactivation; platform mail still goes out; webhook SSRF via IPv6 forms closed; fee-run markers, fee defaults and custom_domain_verified_at frozen for direct writes; vendor AI assistant scoped to its company; AI routes no longer return raw errors; operator audit failures reported; more reserved company addresses. Open for Mirsad: late fee vs AutoPay order on reactivation day. Reviewers: security, migration (twice), schema, white-label.
- #390 (merged 2026-10-14) claude/gl-close-deep-check: deep check of the general ledger, period and
  year-end close, management fees, loans, credit cards and bank lockbox.
  20261016200000 LIVE as 20261014121412 (agent dry-run on production,
  rolled back, before/after; read back: table writes revoked, delete guard,
  helper revoked, owner agreements policy false). Fixed: double posting via
  direct writes to lockbox/fee ledger/recurring templates (writes revoked);
  recurring JE once per date; lockbox posts to the unit's current owner and
  only the batch's association; used GL accounts can't be re-typed, moved or
  deleted; scoped managers can't change the company-wide GL map or fee
  defaults; finalized year-end frozen; owners can't read management
  agreements; scoped managers can't make an agreement company-wide or sign
  one outside their associations; local dates; lockbox page reads >1,000.
  Reviewers: migration, security, schema, design (agent + main session).
- #388 (merged 2026-10-14) claude/ownership-fixes (sale and move-out, from a deep check of the
  change-homeowner flow). Migration 20261016010000_ownership_fixes.sql
  LIVE as 20261014102121 (final file dry-run rolled back on production by the
  main session first: future sale refused; Sept owner statements to seller
  and buyer; Aug monthly statement to the seller, Sept to the buyer; read
  back: trigger, both policies, transfer check):
  - Codex P1: a buyer can't read the seller's sale-month statement; the
    shared-unit branch admits only current co-owners' statements
    (20261016020000 LIVE as 20261014112304; dry-run: buyer sees the
    co-owner's October statement, not the seller's October or September).
  - Codex: a co-owner whose move-out date has arrived stops sharing
    statements even before the nightly job (20261016030000 LIVE as
    20261014112904); the owner page's YTD figures count every ownership
    period, so a former owner who sold this year still shows their months.
  - A sale can't be recorded before it closes: change_unit_homeowner and
    transfer_unit_ownership refuse a transfer date after the association's
    local today; the action checks it before creating a buyer record; the
    form's date has max = association today (a future date used to end the
    seller at once, make the buyer current and cancel AutoPay early).
  - Statements go to the owner(s) of record in the period:
    generate_owner_statements makes one per owner whose occupancy overlaps
    it (a sale month gives both seller and buyer one);
    generate_monthly_statements one per unit (primary owner when several
    overlap; a seller is no longer primary). A seller's statement for the
    sale period is as of their last day (no buyer charges or payments).
  - Ending an owner occupancy (sale, move-out, nightly job, import) ends
    their parking assignments on that unit, stops the assignment's linked
    parking charge (active false, end date) and archives their pets on it
    (trigger end_owner_unit_items_when_occupancy_ends; dues and other
    recurring charges untouched; nothing deleted).
  - Residents: charges_resident_read admits a charge dated in the owner's
    ownership or still open (rls_private.resident_visible_charge_ids, one
    id set per query); statements_resident_read the owner's own statements
    plus their current unit's from their move-in month
    (rls_private.resident_visible_statement_ids; co-owners keep them).
  - Owner page: payment history, last payment, YTD charges, payments,
    returns and monthly statements bounded to the owner's move-in/move-out
    per unit (lib/owners/ownership-window.ts); not by the ledger's owner_id,
    which names one owner per payment and would hide a co-owner's.
  - Accepted, for the PR body: when a co-owner takes over the unit, the
    departing co-owner's parking also ends; reopening an ended occupancy
    doesn't restore parking or pets; the buyer can still read applications
    on the seller's paid charges (pre-existing, keeps balances right); an
    open balance at the sale shows on both the seller's final statement and
    the buyer's.
  - Association-local dates: endOccupancy move-out, changeHomeowner default
    and form, end_occupancies_past_move_out, sync_unit_owners_from_occupancy.
  - Dry-run rolled back on production (unit 303 sold 2026-10-01 to an
    owner with a portal login): before - future sale accepted (seller past,
    buyer current at once), seller's parking/charge/pet left active, Sep
    statements went to the buyer, buyer saw the seller's paid charge and
    statement (10 charges). After - future sale refused; parking ended
    2026-10-01, charge stopped, pet archived; Sep statements to the seller;
    buyer sees 9 charges (paid seller charge hidden, open one kept, balance
    unchanged 969.59) and not the seller's statement; move-out and nightly
    job end the items on the local day. Timing with 2,000 extra units and
    20,000 charges: owner ledger 4.3 -> 3.2 ms, owner charges 8.0 -> 6.2 ms,
    account summary 17.3 -> 9.1 ms, manager unchanged (8.7 ms). Second
    dry-run after review fixes (sale 2026-10-10, October batch): before -
    only the buyer got a statement (924.59) and the buyer saw the seller's
    August statement; after - seller 899.59 (leaves out the buyer's 25.00
    charge of 10-12), buyer 924.59, seller's August statement hidden.
  - Reviewers: overseer at start; migration (medium: seller statement
    totals included the buyer's activity -> cut at the seller's last day, by
    move-out date not status; co-owners lost unit statements -> id set),
    security (low: ledger owner_id hid co-owners' payments -> ownership
    window; invalid calendar dates -> checked), schema (clean),
    design (hint wording fixed), white-label (clean). Migration and
    security re-ran on the fixes: clean. Note: the sale month's monthly
    statement is visible to the buyer if it was filed under the seller
    (unlikely; the seller is no longer primary).
- #387 (merged 2026-10-14) claude/po-projects-deep-check: deep check of purchase orders, projects,
  inventory and fixed assets (rolled back at 5,000 rows, every role; all
  lists under 45 ms). 20261015230000 LIVE as 20261014092828 (dry-run rolled
  back on production first; read back; guard re-checked live, rolled back):
  - A PO sent to the board could never be approved (board portal is
    read-only, no form recorded the decision): the PO page now records the
    board's decision like the bill page (record_approval_decision).
  - A bill from a PO carries the PO's work order, so it counts toward the
    capital project's spend (was always 0).
  - Board routing is decided when the PO is submitted, by today's rules.
  - Signed-in users can't change, re-point or delete an approval request
    directly, edit its notes once decided, or add board votes.
  - A fixed asset can't move away from a reserve component that links it;
    an asset with no association can't be linked.
  - Editing a PO keeps its work order; PO dates use the association's day.
  - Codex: an auto-approved resubmission drops its old rejected request
    (20261015233000 LIVE as 20261014094012; dry-run rolled back first).
  - Codex: a decided request's title, description, due date, attachments
    and requester are frozen too (20261015234500 LIVE as 20261014094714).
    Codex's FK concern checked: deleting a vendor with a decided request
    still works (FK SET NULL runs as the table owner).
  - Codex: linking a reserve component share-locks the asset, so a
    concurrent asset move serializes (20261015235000 LIVE as 20261014095415).
  - Codex: signed-in users can't update or delete board vote rows either
    (20261015235500 LIVE as 20261014100016; platform operator: 0 rows).
  Reviewers: migration (twice, final file), security (DELETE/re-point gaps
  fixed), design (note hint moved under the row, bill page too),
  white-label (two messages reworded). 9 business-rule questions -> TODO.
- #386 (merged 2026-10-14) work orders follow-ups:
  - Recurring work orders the nightly database generator assigns to a
    vendor now email that vendor: /api/work-orders/notify-recurring (Vercel
    cron 12:00 UTC, after pg_cron's 11:30 generator) sends the same
    white-labeled assignment email staff assignment sends, per vendor,
    each job once: every assignment email (staff, bulk, Generate now, cron)
    stamps work_orders.vendor_notified_at, and the cron queues one email per
    job under a fixed key so a retried run sends nothing twice (Codex P2 x3;
    a 7-day catch-up window; any still-active status, Codex P2). "Generate
    now" emails the vendor right away.
  - 20261015220000: a completed request goes back to waiting whenever an
    open work order appears in it (moved in, unarchived, reopened from
    cancelled, added open); reopening clears resolved_at and resolved_by,
    keeps the resolution note; service_request_guard_update keeps the
    trigger's resolved_by. LIVE as 20261014083421 (dry-run rolled back on
    production first: moved in, unarchived, reopened from cancelled and
    added open all set waiting, note kept, cancelled stays; read back).
    Migration, security and schema reviewers ran; security's duplicate-send
    finding fixed (vendor_notified_at). Note: a request can now send the
    service_request.resolved webhook again after a reopen.
- #383 (merged 2026-10-14) a removed late fee reads "Removed", not
  "Paid", on the owner's ledger and the unit page (v_charge_balances;
  balances unchanged); only remove_late_fee can mark its credit; past due
  by the association's local date. 20261015130000 LIVE as 20261014024847,
  20261015140000 (clearer reserved-reference message) LIVE as 20261014025022,
  20261015150000 (Codex P1: a removal credit counts only for its own fee;
  signed-in users can't add or move its applications) LIVE as 20261014025658,
  20261015160000 (Codex P2: reversed_at locked on a removal credit) LIVE as
  20261014030321,
  20261015180000 (Codex P1: removal credits can't be deleted) LIVE as
  20261014030816,
  20261015190000 (Codex P1: a removal credit's applications can't be
  deleted by hand either) LIVE as 20261014031317,
  20261015200000 (Codex P1: reallocate_payment refuses a removal credit;
  the payment page hides its allocation form) LIVE as 20261014031827,
  20261015210000 (reviewers re-ran on rounds 2-5 and found the rest: the
  credit is frozen except notes, the fee can't be deleted or changed except
  its description, a removal credit applies only to its own fee for every
  caller, v_unapplied_credits leaves it out so apply_credits/auto-apply
  never spend it; manager wording) LIVE as 20261014074814 (dry-run rolled
  back on production first, read back).
  Checked: the only other signed-in-callable function that rewrites
  applications, reverse_homeowner_payment, already refuses credits
  (dry-run rolled back on production first: manager and owner see removed,
  unremoved fee outstanding, due-today not past due, marker guard blocks
  setting, changing or re-typing it; read back). Round 1: migration, security and
  design reviewers ran; rounds 2-5 re-reviewed before 20261015210000; their suggestions done (method locked, UTC
  fallback date, past-due badge stays red on the unit page).
- #384 owner portal fixes (merged 2026-10-14), app
  code only (no migrations).
  - Ledger: a previous owner's paid charges are hidden; charges still open
    stay (screen and export). Unit column on charges and payments; the
    export has one header per association.
  - AutoPay: an account with online payments switched off can't be set up,
    isn't offered, and existing enrollments show as paused.
  - Hearings: the recorded hearing time wins over the old scheduled date,
    accumulated fines over the base fine; hearing dates show in the
    association's own time zone (hearings list and violation page).
  - Work orders show errors sent back by the message form.
  - Work orders and violations are paged (50 a page); violation totals
    count every violation, not just the first 100.
  - A failed read shows an error instead of an empty page (ownership dates,
    My Home, hearings, meetings, vehicles, amenities, AutoPay, messages;
    messages no longer opens "new message" when the list failed to load).
  - A failed or canceled online payment says so and links back to Pay.
  - Communications uses the shared text box.
  - A removed late fee reads "Late fee removed", never as a payment
    received (ledger, dashboard, timeline, owner assistant).
- #385 work orders and service requests (20261015170000 LIVE as
  20261014034204). Codex: one P2 (complete a request when its only work
  order is deleted) answered as intended: unfinished work never marks a
  request resolved.
- #382 Codex follow-ups on #379-#381 (20261015110000 LIVE as
  20261014022209, 20261015120000 LIVE as 20261014022727). Codex clean.
- #381 architectural reviews, documents, forms, e-sign (20261015090000 LIVE
  as 20261014011059). Codex: P1 board decision RPC (already not executable
  by signed-in users), P2 association date for on-behalf filing (fixed
  before merge), P1 signature request association (next PR).
- #380 insurance, inspections, amenities (20261015080000 LIVE as
  20261014005902). Codex follow-ups in the next PR.
- #379 board and vendor portals (20261015100000 LIVE as 20261014004501).
  Codex follow-up (board seats by email) in the next PR.
- #378 tests pass on Windows (CRLF, backslash paths, slow process start;
  1,058/1,058). Codex clean.
- #377 journal written only by database functions (20261015060000 live;
  Codex on #376) + interest on overdue balances removed (Mirsad: "THERE IS
  NO INTEREST", "ITS ONE TIME LATE CHARGE"; drop SQL in TODO). Codex clean.


## Merged 2026-10-13
- #376 claude/collections-codex-fixes: Codex on #375 (two P1s). Codex: P1
  (client-authored journal entries could steer the lookup; next PR).
  20261015050000 LIVE as 20261013234941 (read back; reviewers clean).
  - remove_late_fee debits the income account the fee's own posting
    credited (from its posted charge journal entry), not today's mapping;
    the mapping is a fallback; an inactive account gives a clear error;
    only this company's entries and this association's accounts count
    (security review: source fields are client-settable).
    Rolled back: fee posted to A, category remapped to B -> credit to A.
  - Payment plan window: charges count against a plan when recorded after
    it was made (was: due on or after its UTC start date, which missed that
    local day's charges on a US evening (Codex) and counted twice a charge
    already in the plan total that fell due on or after the start
    (migration review)); cancelled/completed ends are local dates. New
    plans' start_date is the local date; the plans report's "Behind" uses
    the local date (once per plan). Plans rechecked. Rolled back
    (Etc/GMT+12): a plan for a balance due today, then paid in full,
    completes (300/300); a charge recorded after the plan, due that day,
    counts (500 - 300 = 200); start_date local.

- #375 claude/collections-deep-check: Codex P1 x2 (fixed in the next PR). DEEP CHECK of delinquencies
  and collections (rolled back on production at 2,000 units) + Mirsad's
  "THE MANAGER SHOULD BE ABLE TO REMOVE LATE FEES". 20261015040000 LIVE as
  20261013232520 (dry runs passed; all 13 patched functions read back).
  - Remove late fee: unit page "Late fees" card (finance staff), reason +
    Remove (confirm) -> remove_late_fee: credit of the open amount to the
    fee's income account, applied to the fee, owner sees "Late fee removed",
    reason staff-only; the fee stays recorded so the daily run never charges
    it again; paid fee refused; second removal refused.
  - Association-local dates (was UTC current_date) in late fees (a fee
    could be charged a day early and dated tomorrow on a US evening),
    overrides, ladder days past due, referral readiness, plan schedule and
    paid amount (plans rechecked), plan/offer/vote date checks.
  - (SUPERSEDED: interest removed entirely, Mirsad) Interest on principal only (no interest on late/NSF fees or a previous
    owner's charges). The unit query went from 8 to 58 ms at 2,000 units
    (the ownership check runs once per unit; offset 0 stops it running per
    charge): fine for a monthly run, where posting the interest charges is
    most of the time.
  - late_fee_assessments not writable by signed-in users (a deleted row
    meant the fee was charged again).
  - Payment plan cancel reason staff-only (owners could read it through the
    API; security review).
  - Notice days left blank now errors (was silently 30); bad plan id errors.
  - Verified, no change: late-fee cron 1,600 fees in 9 s at 2,000 units,
    second run 0 (no double fees); ladder writes only through definer
    functions (cases/events SELECT-only grants); legal transitions guarded;
    every action re-checks auth; board/owner/vendor/tenant can't read
    cases, events or notes; cron routes need the secret. Charge posting
    ~3 ms per charge (2,000 units ~6 s); slower only with stale statistics
    inside one huge transaction. The ladder advances only when staff act
    (sync on the Delinquencies page, Advance per case; no cron), by design:
    steps can need human approval.

- #374 payables follow-ups (Next gaps). Codex clean.
  - 1099 totals (vendor_1099_totals, assemble_vendor_1099_data): the tax
    year is a range on paid_at in the time zone of the association
    of each bill, instead of association_local_date per bill; starts from
    the bills (a bill with no association still counts, migration review),
    narrowed by a partial index idx_payable_bills_paid_at to two days around
    the year. 20261015030000 LIVE as 20261013224154 (grants unchanged).
    Rolled back on production at 50,000 paid bills: 781 -> 56 ms and
    814 -> 42 ms; output identical (both directions, jsonb equal) for
    Chicago, Honolulu, Tokyo and a blank zone x tax years 2024-2027, bills
    each hour around New Year and a bill with no association; 672 boundary
    instants matched.
  - Bill line items vs set_payable_bill_expense_account: verified, no
    change. payable_bill_line_items has 0 rows; no function or app code
    reads or writes it; ensure_payable_bill_accrual posts the header
    gl_account_id, so the header account is the one that counts.
  - System-generated bills (recurring, management fee): no vendor invoice
    number and no payment, so the duplicate-invoice and payment-date rules
    don't apply (by design, no change). Purchase-order bills go through
    create_payable_bill (checked in #360); pay_owner_payable checks dates.
- #373 reconciliation statement balance (Codex on #372, P1): a reconciliation
  in progress can have its statement ending balance corrected on the
  reconcile page (a reopened one was stuck). App only. Codex: no findings.
- #372 banking follow-ups (Next gaps). Codex: P1, a reopened reconciliation
  could not correct its statement balance (fixed in the next PR). 20261015020000
  LIVE as 20261013215404 banking_followups, 20261013215740
  banking_followups_wording, 20261013215843 banking_followups_locks (the file
  is the final, re-runnable state); rolled-back production tests passed
  (undo, discard, guards, closed month, finalized year-end, posting still
  works):
  - Undo a reconciliation (AppFolio): undo_bank_reconciliation reopens the
    account's LATEST completed one (finance staff who can reconcile the
    account, reason of 10+ characters, audited, undone_at/by/reason kept),
    refused when a month it covers is closed or one is in progress; the
    account's reconciled-through date steps back. The guard allows it only
    through the function (a transaction-local flag naming the row). Undo
    control on the reconcile page, plus Discard for a reconciliation in
    progress that was never completed (items first, then the
    reconciliation: deleting it directly never worked, the item guard can't
    find a parent being deleted). lib/types/database.ts has the new columns.
  - Locks (security review): the undo locks the company's months (shared)
    so a month close can't pass at the same moment; finalizing a year-end
    package locks them too, so a reopen can't slip in; the undo checks
    access before locking the account.
  - A month inside a finalized year-end package can't be reopened until the
    package is superseded (set_accounting_period_status).
  - Ledger lines, journal entries and bank adjustments cleared on a completed
    reconciliation can't change amount, account, association, date or
    posting, or be deleted; a bank adjustment can't change while any
    reconciliation lists it (the item keeps its amount). All roles except
    repair sessions. Indexes on items by line and by adjustment.
- #371 email unsubscribe and suppression (Mirsad's
  recommended defaults from TODO). Codex: one P2 on an older commit (dues
  reminders skipped mail-preferring owners), already fixed by the
  all-owners commit before merge. 20261015010000 LIVE as four versions:
  20261013203100 email_unsubscribe, 20261013203437
  email_prepare_batch_platform_name, 20261013203802
  email_unsubscribe_security_fixes, 20261013203849
  email_prepare_batch_message_alias (+ 20261013211319
  email_all_owners_and_tenants); the file is the final, re-runnable
  state (read back live: email_prepare_batch, complete_email_delivery,
  policies). Rolled-back production tests passed.
  - email_queue.mail_class (required | optional) decided in the database
    from the email's key (mass-email, communication, dues/insurance/calendar
    reminders, automation, vendor-bulk are optional); a signed-in user's
    mail is optional unless its key is a known required kind or it holds a
    sign-in link, so staff can't mark mass mail required.
  - email_suppressions per company and address (unsubscribed | bounced |
    complained) + email_suppression_events; only server functions write.
    A bounce stops all mail; an unsubscribe or spam report stops optional
    mail only. Association-scoped managers don't see or clear them.
    A suppressed email is kept, failed with suppressed_at and the reason
    (shown as "Not sent" in the Communication Center). Checked when the
    worker sends (email_prepare_batch), not at insert (no per-row cost); a
    Communication Center message counts stopped recipients as done.
  - Mirsad (2026-10-13): every owner and tenant gets email; the sender picks
    owners, tenants or both (Send Email page; Communication Center groups).
    An owner's preferred contact (mail) no longer stops email, dues
    reminders included (they skipped those owners before).
  - Optional company mail gets an Unsubscribe footer and List-Unsubscribe /
    List-Unsubscribe-Post headers on the company's address
    (/unsubscribe/<token> page; /api/unsubscribe/<token> one-click POST;
    tokens server-only in email_unsubscribe_links, one per email; rate
    limited per link, not per address: providers send one-clicks from shared
    servers).
  - Resend permanent bounces and complaints suppress the address for that
    company; staff can allow a bounced address again from the email's page
    (the lookup is the email's own company).
  - Also: owner form requests carry an owner-form: key (required);
    existing mass and reminder rows (any status) were classified optional;
    claim_email_queue_snapshot skips suppressed mail; the unused
    claim_email_queue(integer) is revoked from everyone (drop on TODO);
    complete_email_delivery counts suppressed recipients as done.
- #370 SMS routing (Codex on #369). Codex clean. 20261014234500 (LIVE, applied as
  three live versions: 20261013195620 sms_provider_sender, 20261013200049
  sms_reply_routing_rpcs, 20261013200334 sms_messages_freeze_routing_columns;
  the file is the final, re-runnable state, no history fix needed):
  sms_messages.provider_from_number, the number Twilio reports it sent
  from; a trigger keeps signed-in users from setting it or the Twilio id
  (current_user) and from moving any message (recipient, conversation,
  direction), including one mid-send. Server-only
  RPCs sms_sender_companies (every company that knows a number, no row cap)
  and sms_reply_conversations (conversations we texted them in from a number).
  - Text replies and START from a number several companies know go to the
    company that texted them from the number they replied to, proven only by
    provider_from_number (from_number and our_phone_number are staff-editable,
    so another company could have claimed the replies; security review).
    The delivery cron and the status callback record it. Matching uses
    the two RPCs, so one company's rows can't hide or claim another's.
    START goes to the one company that knows them, else the one that texted
    them from that number (else 409). STOP opts out every company's record
    for the number (was the first 10).
  - With one platform Messaging Service and sticky sender, several
    companies often text a person from the same pool number, so their
    replies stay unmatched (each company gets a log entry). Fails safe.
  - Mass email stops if the association's date can't be loaded (it fell
    back to the default zone and could include or skip owners who moved
    out that day).
- #369 communications follow-ups.
  20261014233000 (LIVE):
  - REGRESSION FIX from #367: the email worker-columns guard checked
    auth.role(), still 'authenticated' inside definer functions an owner's
    action runs, so staff weren't emailed about owner messages (its company
    lookup answers only for staff since #367). It checks current_user now;
    applied live as a hotfix. No owner messages were sent in that window.
  - message notifications link to the conversation (Inbox for staff,
    portal for owners/tenants, on the company's verified domain or
    <slug>.portier369.com); an email that can't be queued is logged as
    failed in the communications log with a link to the conversation;
  - former owners (sold, by the association's date) read their old
    conversations but can't reply;
  - note-mention emails link to the company's own address, not a host the
    caller passes (security review);
  - inbound texts: one row per Twilio message id.
  App: inbound SMS replies are recorded in the sender's conversation (they
  were dropped), in the owner's or vendor's association; a sender known to
  more than one company is matched by the number they texted (since the
  follow-up: as Twilio reported it, provider_from_number), else
  each company gets a log entry without the message; the SMS sender number comes
  from the configuration, not the form; inbox and its texts tab page 100
  at a time (were cut at 300/100); mass email leaves out owners who moved
  out by the association's today. Letters vs email owners checked: the
  same 17 owners (unit_owners is synced from occupancies), no change.
- #368 email limit counted by the database time under a per-company lock
  (Codex on #367; 20261014230000). Codex clean.
- #367 email security: sign-in links unreadable by staff; staff mail checked
  in the database; mass email fast and replies to the company
  (20261014220000).
- #366 budgets: budget vs actual in fiscal months with real actuals;
  assessments can't cancel next year's or post twice; budget lines only
  through the worksheet (20261014210000).
- #365 AutoPay: a retried Stripe completion for an ended setup undoes its
  enrollment (Codex on #364; 20261014200000). Codex clean.
- #364 AutoPay: a canceled setup can't leave AutoPay active (Codex on #363).
- #363 owner portal: private calendar, right balance after a sale, fast
  owner pages, tenant pages scoped, AutoPay and Stripe fixes
  (20261014190000).
- #362 reconciliation items: an update or delete is checked against the
  item's own reconciliation (Codex on #361; 20261014180000). Codex clean.
- #361 banking: reserve funds guarded, closed months audited, reconciliations
  enforced in the database (20261014170000).
- #360 payables follow-ups: 1099 link finance-only; recurring bills via
  RPCs; payable dates; credit-paid bills (20261014160000).
- #359 payables: vendor invoices approvable; staff record board decisions;
  duplicate invoices and payment dates checked; 1099 report keeps archived
  vendors (20261014150000).
- #358 vault: #357 merged; policy subquery sweep measured, no change.
- #357 executive sessions hidden from staff outside the confidential-meeting
  set: meeting row, agenda text, attendees, quorum counts (20261014140000).
- #356 meeting lists put undated meetings last (Codex clean).
- #355 meetings: quorum read only and recorded by trigger at completion;
  completed meetings frozen in the database (no reopen, quorum/date/
  association change, delete or forged insert outside a repair session);
  cancelled not reopenable; attendance locked; owner hearing window and
  first-notice rule; charge_type change reposts (20261014100000-130000, live).
- #354 work orders: long requests convert, vendor Open tab complete, no fake
  vendor status entries, owners rate only their own jobs (20261014090000,
  live).
- #353 violations: fines to Violation Fees on the day assessed, hearing
  window, owner timeline (20261014080000, live).
- #352 charge balances and category totals add up applications once
  (20261014060000/070000, live; Codex clean).
- #351 vault: all 120 reports under 230 ms at 2,000 units.
- #350 budget pages 15-35x faster, ledger totals ~8x faster
  (20261014040000/050000, live; Codex clean).
- #349 application/unit-move race closed (20261014030000, live; Codex clean).
- #348 applied payments/charges keep their unit (20261014020000, live);
  Stripe webhook route tests.
- #347 money policies without nested RLS (20261014000000), payments apply
  to own unit (20261014010000), sweeps verified (live).
- #346 recheck existing payment plans under the new measure
  (20261013230000, live; Codex clean).
- #345 payment plan measure by recording time (cases A-G), report uses it,
  Receivables receipts from payments (20261013200000-220000, live).
- #344 future-dated bounce reopens a plan; new dues don't (20261013190000,
  live).
- #343 reversal charge skipped only when its receipt is in the plan window
  (20261013180000, live).
- #342 paid amount ignores reversals; manager scope on rows without an
  association (20261013150000-170000, live).
- #341 plan recheck canonical paid amount; reconciliation item lock
  (20261013140000, live).

## Merged 2026-10-12
- #340 signatures, transfers, attachments, notices, meeting items once per
  query; managers can create/edit meetings (20261013100000-130000, live).
- #339 unapplied credits, page totals, NSF fee income, payment plan bounce,
  locked reconciliations (20261013060000-090000, live).
- #338 delinquent_units by (unit_id, due_date) index (20261013050000, live).
- #337 aged_receivables by index (20261013040000, live).
- #336 policy copies of association checks scoped (20261013030000, live).
- #335 definer functions respect manager scope (20261013010000/020000, live).
- #334 reviewer follow-ups to #333 (20261012130000/140000/150000, live).
- #333 journal entry headers, recurring JEs, document repair
  (20261012120000, live).
- #332 manager scope on entity_type tables + deleted-records log
  (20261012110000, live).
- #331 manager scope on 72 child tables + parking (20261012100000, live).
- #330 manager scope on 43 more tables (20261012090000, live).
- #329 budget lines read once per query (20261012080000, live).
- #328 bank numbers: unused definer functions revoked; deleted-records log
  leaves out hidden columns (20261012060000/070000, live).
- #327 receipt search matches every co-owner.
- #326 New homeowner receipt search.
- #325 Inspections scores in the database (20261012050000, live).
- #324 unit dropdowns follow the association; Calendar Unit picker.
- #323 Bank Deposits grouped in the database (20261012040000, live).
- #322 Units list Previous/Next pages.
- #321 Owners/Units/Receivables at scale; chargeback_totals (live); Print
  on capped pages prints the full export.
- #320 lists past 1,000 rows; company admin no-company notice.
- #319 units manager-scope policy once per query (20261012020000, live).
- #318 migration check ignores SQL comments (Codex on #317).
- #317 RLS policies for signed-in users only (20261012010000, live).
- #316 platform operator Company details: Support phone field. Stellar's
  support email set to hello@portier369.com; phone left for Mirsad.

## Merged 2026-10-11
- #288 projects list spend for all staff (capital_project_spend_totals,
  20261011080000); #289 Piper unguessable web session id; #290 Reports
  phone width; #291-#293 Receivables page speed (1.2-2.4 s, was 15-29 s);
  #294/#296 per-row calls a few at a time (lib/db/map-limit.ts); #295
  shared components; #297 vault; #298 owner portal tap targets.
- #303 (squash, 1748bc02) carried the stacked #299-#302: board, vendor and
  company-admin tap targets; StatTile + SegmentedLinks/Buttons; Metrics in
  one call (metrics_monthly_trend 20261011120000) with month-end
  receivables in one pass (receivable_summary_by_months 20261011130000);
  /metrics 1.7-2.1 s (was 4.6-5.2 s). #299-#302 closed as included.
- #304 platform operator 40px tap targets; shared buttonClass().
- #305 all 367 buttons nested in links -> buttonClass() links.
- #306 middleware time limits (6 s per call, 9 s sign-in): a slow database
  answers 503 "try again" within Vercel's 25 s; failed identity lookup
  refuses every request.
- #307 (Codex on #306) a hit time limit cancels the request's database
  calls; every 503 keeps refreshed cookies.
- #308 index on email_sender_domain_owners.portfolio_id (live).
- #309 vault: detail-page check.
- #310 operator Overview chart labels 40px rows; all six roles checked at phone width.
- #311 TODO: Stellar support contact on Mirsad's list.
- #312 accessible form labels (~45 fields, 15 forms; lint rule in CI).
- #313 Field ties its label to a single control itself (195 Fields).
- #315 operator-without-company pages show a notice instead of crashing.
- #314 enforced nonce CSP on app pages (live: login works, analytics loads from our origin, no blocks).

## Merged 2026-10-10 (late)
- #282 query probe + refused report runs return to the report; #283
  aged_receivables migration; #284 report choices kept; #285 2026-10-04
  checks done; #286 Inbox checked + production email restored; #287
  Mirsad's action list in TODO.
- #279 MERGED by Mirsad (f4201176): one design for all six roles
  (docs/redesign/). Signed-in checks done for owner, vendor, manager and
  company admin; operator checked signed in 2026-10-10 (21 pages + 11
  detail pages OK); board checked signed in 2026-10-10 (owner1@portier369.com
  added as director on Randolph Station via SQL, no owner record): 7 pages
  OK after fixing the receivables timeout (20261011070000, APPLIED:
  aged_receivables sums payment_applications once, grouped by charge;
  identical rows for 12 callers; board receivables 8.5 s -> 64 ms). Watch: each read now sums every
  payment_application the caller can see once per query; if operator or
  company-admin reads get slow at scale, switch to a LATERAL per-charge sum
  written once.
- #281 MERGED (aa573336), claude/rls-hoist: security checks run once per query, not once per row.
  Migration 20261011010000 APPLIED to prod 2026-10-10 (Claude). 1,475
  public policies rewritten in place (ALTER POLICY; roles/commands kept):
  zero-argument helpers and operator_may_write(..) wrapped as
  "( SELECT f() )"; can_access_portfolio / can_manage_finance /
  can_admin_portfolio / can_access_association / can_view_association_row
  split into once-per-query helpers (my_access_portfolio, my_finance_portfolio,
  my_admin_portfolio, my_accessible_association_ids,
  my_managed_association_ids) plus a plain comparison. Equivalence checked
  before applying (scripts/sql/rls-hoist-equivalence.sql, rolled back): 26,507
  checks, 13 callers incl. a fixture scoped manager and support operator,
  0 differences. Measured as each role: owners+units join 215 -> 25 ms,
  work orders 24 -> 1 ms, journal lines 11 -> 1-5 ms, gl_accounts 247 -> 107
  ms (manager) and 508 -> 130 ms (vendor); row counts identical.
- Part 2, 20261011020000 APPLIED to prod 2026-10-10 (Claude): part-1
  comparisons wrapped in COALESCE(.., false) so an AND stops early (null
  made Postgres still run can_read_gl per row), and can_read_gl,
  can_access_unit, can_manage_association, can_edit_association_mvp,
  can_write_vendor_row hoisted (gl_read_all, my_readable_gl_ids,
  my_accessible_unit_ids, my_manageable_association_ids,
  my_editable_association_ids). 307 policies; 14,716 checks, 0
  differences. After both parts: gl_accounts 247 -> 0.6 ms (manager),
  508 -> 1.2 ms (vendor); owners+units 215 -> 4-6 ms; charges, work
  orders, documents 1-5 ms.
- Part 3, 20261011030000 APPLIED (migration-reviewer finding): the
  association set helpers look only at the caller's company (or all, for
  an operator) instead of calling a helper for every association on the
  platform. 52 caller/helper sets identical before/after. Note: part 2's
  `(?<!COALESCE)` guard is ineffective, so re-running part 2 would nest
  COALESCE (same result, longer text) - don't replay it by hand.
- 20261011040000 (comments): each original can_* helper names its twin.
- 20261011050000 APPLIED (Codex P2): my_accessible_association_ids and
  my_accessible_unit_ids moved to schema rls_private (not exposed by the
  API, no USAGE for anyone) so a scoped manager can't list every company
  id by RPC. Policies keep working (they reference functions by id);
  same row counts per role after the move.
  Still per-row (rare tables):
  current_resident_unit_since, can_manage_violations, budget/meeting/
  signature helpers, journal_entry_touches_board_associations.

## Where things stand
- #280 merged (ce66300c): two-step setup page no longer crashes showing
  the QR code (Supabase returns an unencoded SVG data URL; qrDataUrl()
  re-encodes it).
- #278 merged (55cadd0b): dashboard reminders and owner portal home load
  in two waves of parallel queries instead of 7-13 sequential ones.
- #277 merged (824566b2): "Unlink login" button on the owner record
  (Portal access): confirm-first, cuts off the record's own sign-in
  (auth_user_id cleared, portal off) and every sign-in it was added to
  (owner_portal_logins revoked), logged. Migration 20261010050000
  (unlink_owner_logins, DEFINER: staff + can_manage_association +
  operator_may_write) applied by Claude and read back; tested in a
  rolled-back transaction (manager unlinks, audit row; non-staff 42501).
- #276 merged (2fea8502): third-audit fixes (operator guard on
  company_state_rules, association-documents storage owner scope, vendor
  invitation email check, opening-balance imports refuse after the opening
  entry, work-order re-import links vendors, Action Center import link,
  no platform name in four texts). Migrations 20261010020000-40000 applied.
- #275 merged (ed76ad91): State Rules. Company admins record the rules
  their company follows in each state (`/company-admin/state-rules`):
  collection gates + plain-words summary, other state requirements,
  citations; managers see them on the association profile and on
  Delinquencies; `apply_delinquency_jurisdiction` uses the company's rule
  first, then the built-in profile, then DEFAULT. Migration 20261010010000
  applied and read back; tested as the live company admin and a manager.
- #274 merged (7da84a8b): `checkLinkedRecords` vendor check mirrors the
  vendor_link_same_association trigger (association's own vendor or its
  company's management company; no association -> the record's company).
  Calendar + maintenance pass the record's company. No migration.
- #272 merged (b5dde4a7): opening balances step on the import
  page. Under the trial balance tie-out (one association), "Post opening
  balances" posts one entry dated the as-of date with each account's
  difference (file minus ledger), prior years' retained earnings to the
  paired account or a chosen one the tie-out will pair, through
  import_journal_entry_batch. Server recomputes the tie-out under an import
  lock; refuses all associations, cash basis, all-time with a prior-years
  line, accounts missing from the chart, hidden accounts and ledger-only
  balances, and a second opening entry for the association (any date).
  Holds the open-balance import's lock too. Confirm-first button. No
  migration.
  Tests in gl-actions.test.ts. Randolph Station already ties out, so it
  would post nothing there.
- #271 merged (4f0f197f): trial balance tie-out counts
  a ledger retained-earnings account the file does not list (equity; name
  says prior/previous or is exactly "Retained Earnings"; see Decisions) on the file's "Calculated
  Prior Years Retained Earnings" line, only when the file has that line;
  the row names the accounts. Randolph Station's two offsetting flags
  (prior-years line vs 3350) become one matching row. Read-only action, no
  migration. Test gl-actions.test.ts. Mirsad re-ran Randolph Station after the merge: every account ties out, no flags.
- Randolph Station opening balances posted and tied out (2026-10-10):
  Mirsad uploaded the opening journal (1 batch, 1 entry, $493,061.19 each
  side, dated 2026-10-08) and ran the tie-out (as of 2026-10-08, fiscal
  year to date): 46 accounts match, 0 differ, total difference $0.00. The
  only flags are the expected pair: the file's "Calculated Prior Years
  Retained Earnings" (-159,343.43, no account number) against 3350 on the
  ledger (#271 pairs them; re-run after merge shows no flags). Claude read back: every account's ledger balance equals the
  trial balance ending balance (incl. 1300 A/R $4,387.69 from the open
  balances), ledger nets to 0.00, 16 entries. The trial balance CSV does
  not carry the property name (the page warns it may combine
  associations); fine here, it was one property.
- #270 merged (a1a0add2): Journal entries -> Upload
  batch failed with "DELETE requires a WHERE clause" (Supabase's
  pg_safeupdate refuses a bare DELETE from API sessions, even inside a
  definer RPC). import_journal_entry_batch, import_bills (Bills upload) and
  app_scan_unapplied_credits cleared their per-call temp table that way;
  migration 20261009090000 switches each to TRUNCATE (patched from the live
  definition; owner, definer and grants unchanged). Nothing was posted by
  the failed upload. A scan of every live plpgsql function found no other
  bare DELETE. Rule: clear a temp table with truncate, never a bare delete.
  Mirsad ran the migration in the SQL editor (2026-10-09; it rewrites
  function bodies to use truncate); Claude read it back: all three contain
  truncate and no bare delete, still security definer, owner postgres,
  search_path pg_catalog/public, grants unchanged, anon cannot execute.
- Randolph Station vendors, open balances, work orders imported by Mirsad
  (2026-10-09), read back: 1 vendor; open balances 15 charges $4,387.69 on
  6 units, no credits, posted Dr 1300 / Cr 4101, GL in balance; 66 work
  orders all on units, 14 of them name 8 vendors not in the app (kept in
  the staff note). Mirsad asked Claude to add them: 8 vendors created
  under Randolph Station (name only; contact, tax and insurance details
  still to fill in) and linked to their 14 work orders.
- Opening balances (Randolph Station, before the import-page step): Claude built a
  one-entry opening journal (2026-10-08, 44 lines, $493,061.19 each side)
  from the previous system's trial balance, by account, minus what the
  open-balance import already posted (1300/4101 $4,387.69); "Calculated
  Prior Years Retained Earnings" goes to 3350. Mirsad uploads it on Journal
  entries -> Upload batch, then runs the tie-out (as of 2026-10-08). The
  first upload failed on pg_safeupdate (bare DELETE in the upload function;
  nothing posted); fixed in #270 (merged a1a0add2). Bills -> Upload (since #264) and
  the unapplied-credits scan were broken the same way.
- Randolph Station units and homeowners imported by Mirsad (2026-10-09),
  read back: 17 units in 1 building, 17 current homeowners (one per unit),
  ownership 100%, dues $10,439.96/month on every unit. Unit 304's owner has
  no main email (shares unit 204's address; Mirsad: leave it). Next:
  vendors, open balances, work orders, trial balance.
- Randolph Station company chart of accounts matched to the previous system
  (Mirsad approved, 2026-10-09, applied by Claude and read back): the 50
  live accounts whose number meant something else (generic starter chart)
  renamed/retyped to the previous chart (e.g. 1200 Reserve EverBank CD3,
  2100 SECURITY DEPOSITS, 2300 Prepaid Assessment), the 242 starter-only
  accounts hidden (inactive, not deleted), 144 parent links as in the
  previous chart, charge categories DUES->4101, LATEFEE->4460,
  PARKING->4102, OTHER->4101 (opening balances and credits post there), bank accounts Operating->1150 and Reserve->1170. Now 367
  active accounts = the previous chart one for one; nothing was posted
  (0 journal lines). The chart CSV import adds nothing (all numbers exist).
- #268 merged (65414f0): owner login leftovers. The
  account page has the per-association switcher (that record's details and
  every current unit); home lists each association's emergency contact;
  migration 20261009070000 lets added records read their association's
  shared files (policy altered in place) and fixes can_access_association_mvp
  (unused today). Checked live, no change needed: owner_open_emergencies,
  form_templates_owner_read / form_submissions_owner_insert (already
  current_owner_ids since 20261009050000), the suspended-company check (the
  profile check covers every record: all are in the profile's company),
  can_access_meeting / calculate_meeting_quorum / is_portal_resident (use
  current_owner_id() only as "is an owner"). Migration 20261009070000
  applied by Claude and read back: policy SELECT authenticated via
  current_resident_association_ids(); can_access_association_mvp owner
  postgres, anon no execute; 0 live policies still match owners by
  auth_user_id.
- #267 merged (f06b9fb): owner login across associations, part 2. Owner
  portal reads every record of the login; each write names its record;
  staff owner pickers follow the association. Migration 20261009060000
  (submit_owner_message per association) applied by Claude before merge and
  read back.
- #266 merged (ffca485): owner login across associations, part 1 (database +
  invitations). Migration 20261009050000 applied by Claude before merge and
  read back: 43 policies use current_owner_ids() (the only remaining
  `= current_owner_id()` is the company-wide survey rule), 16 owner write
  policies tied with owner_record_matches, owner_portal_logins RLS select-only,
  owner_invite_scope restrictive, no email fallback, 3 triggers enabled.
  Owner and board 51 tables 58 ms warm. Fixed: auth email change (always
  failed), board keeps board role on accepting an owner invitation.
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

- #269 merged: importer credits. A credit
  (prepayment) line in the open-balance file is posted as a homeowner credit
  via new import_opening_credit (migration 20261009080000): Dr the income
  account an imported charge of the "Other" category posts to / Cr A/R; the
  unit's balance goes negative (prepayment), recorded as a negative
  imported_balances row so a re-import skips it and Import Variances ties.
  Migration 20261009080000 applied by Claude and read back (definer helper
  import_credit_income_account with finance + association checks, since
  charge_gl_accounts is service_role only; the RPC is security invoker;
  anon has no execute on either).
  Mirsad uploaded the Randolph Station homeowner directory (2026-10-09):
  parses clean (17 current homeowners, 17 units, ownership 100%, dues
  $10,439.96/month); it needs the Unit Directory imported first (0 units
  live). The import itself is Mirsad's to run on the import page.
- #263 merged (dfa8f42): vendors belong to one association (management
  company is the one exception). Migration 20261009020000 applied by Claude
  and read back (2 columns + check + indexes, 14+4+3+4 triggers, all
  policies, functions; the one vendor is in Randolph Station).
- #258 merged (4f5f0d4): AppFolio open-balance re-imports never repost an
  item: same unit + GL + charge date with a changed amount is reported;
  earlier items missing from a complete file (has a Total line it ties to)
  are reported per unit; a fully paid association that drops out of the
  export is left to the Import Variances report (Mirsad's call, see
  [[Decisions]]); "Download all messages" saves the full result. No
  migration.
- Migration 20261008080000 complete: Mirsad ran `claim_import_lock` in the
  SQL editor (2026-10-09); verified PL/pgSQL, SECURITY INVOKER, search_path
  set, no anon execute, 3 policies + RLS on import_locks. AppFolio imports
  can run.
- #257 merged (6d10b58, squash of c78db2d): AppFolio importer on one page
  (`/owners/import/previous-system`), every parser checked on Mirsad's real exports
  (not kept in the repo): units, homeowners + ownership % + dues (dues on the
  primary occupancy), chart of accounts + trial balance tie-out, vendors,
  open balances, work orders. Migration 20261008070000 applied and verified
  (Import Variances per unit + date). 20261008080000 applied in parts:
  import_locks table + RLS + 3 policies + grants + can_hold_import_lock
  (PL/pgSQL) verified; claim_import_lock run by Mirsad (above).
- #259 merged (bac812b); #260 merged: work-order status "Assigned by
  AppFolio" is shown and stored as "Assigned".
- #261 merged (deb3ad3): homeowners belong to one association. Migration
  20261009010000 applied by Claude and verified (owners.association_id NOT
  NULL, FK ON DELETE RESTRICT, 6 triggers enabled, restrictive
  mgr_assoc_scope on owners + owner_private, trigger functions not callable
  by authenticated, auto-link takes the oldest record). 20261009005000
  (purge functions) pasted by Mirsad in the SQL editor (apply_migration times
  out on any SQL with delete code), then delete_unlinked_owners removed the
  14 old demo owners. Lesson: #261 was merged before its migrations ran, so
  production briefly ran code that needed owners.association_id; post "Clear
  to merge" only once the migrations are live.
- #262 merged (8f33d0c): forward-fix migration 20261009011000 (purge_rows:
  a SET NULL link of another association stops the call; purge_type_matches:
  no id-only matching). Definitions already live (Mirsad pasted them); no
  open PR.
- #265 merged (2834717): one vendor login across a vendor's associations.
  Migration 20261009040000 applied by Claude before merge and read back: 28
  vendor policies use current_vendor_ids() (0 single-record left);
  vendor_portal_logins RLS on, select-only; trigger functions not executable
  by authenticated; current_vendor_id() has no email fallback; turn-off
  trigger enabled. As the live vendor (rolled back): 1 record, 23 vendor
  tables 49 ms warm (62 ms before).
- #264 merged: bills CSV upload matches the vendor inside the row's
  association (migration 20261009030000 run by Mirsad, read back: body
  matches the file apart from 3 blank lines the editor dropped; grants
  authenticated + service_role).
- Randolph Station created by Mirsad (2026-10-09) for the first real import;
  it is the only association. Granville Courts, 7241 N. Ridge and the Pine
  Tree sample were deleted by Mirsad in the SQL editor (one DO block: user
  triggers paused, journal entries/bills/tenants/blocking rows removed,
  triggers re-enabled; verified 0 disabled triggers, 0 orphan journal
  lines). The 14 old demo owners are gone (0 owners now).
- #256 merged (7b37b23); migration 20261008060000 applied and verified (7
  SETOF uuid identity helpers are PL/pgSQL, SECURITY DEFINER, search_path
  kept). Live timings for 30 tables per role, original -> now: board
  14.9 s -> 1.8 s, owner 7.5 s -> 0.97 s, vendor 5.8 s -> 0.71 s, manager
  2.9 s -> 0.72 s, company admin 3.8 s -> 0.72 s, operator 2.6 s -> 0.32 s.
- #255 merged (9ced138); migration 20261008050000 applied and verified:
  221 SECURITY DEFINER scalar helpers are PL/pgSQL (3 skipped by design:
  app_portal_url, app_ownership_bounds, report_data_units_by_owner),
  search_path kept, anon unchanged. Live timings for 30 tables as each
  role (before -> after): manager 2.9 s -> 0.7 s, company admin 3.8 s ->
  0.7 s, owner 7.5 s -> 2.6 s, vendor 5.8 s -> 1.3 s, operator 2.6 s ->
  0.4 s, board 14.9 s -> 5.1 s.
- #254 merged (5446724; tree equals PR head cc1a2c7); migration
  20261008040000 applied and verified (trigger, SECURITY DEFINER,
  search_path, no execute for anon/authenticated). Speed: functions in
  pdx1 (were iad1, DB is us-west-2), one me() per request, loading.tsx in
  every section. Plus the second-round gaps (charges/chargebacks/bulk
  vendor emails post once; records use their own company; reset links;
  committee owners; calendar fails loudly).
- #253 merged (dbf551c, squash; tree equals PR head bcd679c): white label on
  company addresses (middleware marketing/site files, neutral name
  fallbacks). No migration.
- #252 merged (7cbc3dd); migration 20261008030000 applied and verified
  (both triggers, FOR SHARE lock, report join; grants unchanged). A property group must be
  the association's company's: checked in associations/new and createBuilding
  (before any write; createBuilding's group update fails loudly), enforced by
  a trigger on associations and on moving a group between companies, and the
  group directory report counts only the company's associations. Migration
  20261008030000.
- #251 merged (331d709); no migration. Letters a
  platform operator sends from a client's template carry no from name (queue
  brands the template's company) and reply to that company; owner/resident
  reset + resident invite use the recipient's company (slug, name, reply-to;
  fails loudly if it can't load); `addTenant`/`addPet`/`addVehicle` take the
  company from the owner's current home / owner (addPet now checks the unit
  and resident belong to the owner: any staff could plant a pet in another
  company's owner portal); the resident invite loads the company before
  revoking the earlier invitation. No migration.
- #250 merged (c959991); no migration. `/accept-invitation` (page and `acceptInvitation`) refuses an
  invitation from another company on a company's address (platform address
  stays allowed: /invite sends other-company accounts there), names the
  inviting company, says up front when the invitation expired or is for
  another account, rate limits per token (10/h) and shows plain errors.
  No migration.
- #249 merged (052b402); migration 20261008020000 applied and verified
  (invoker, search_path pinned, anon no execute). Maintenance "complete" is one transaction
  (`complete_maintenance_task`, SECURITY INVOKER; migration
  20261008020000): the task is claimed with a
  compare-and-set on what the page showed (`seen_completed_at`, due date,
  not archived), then history, the calendar close and the next occurrence's
  event, so a double click / stale page completes once and a failure leaves
  nothing half done. Removed the uncalled `acknowledgeReminder` /
  `resendMaintenanceNotification` server actions. `update_record_note` needs
  no change (record_notes row trigger).
- #248 merged (be2f13b); no migration. Association profile shows the
  public violation-report link (`companyUrl`, the company's own address,
  `?assoc=` preselects) with a shared `components/ui/CopyButton`; warns when
  the company has no workspace address; notes that hidden associations don't
  take reports. No migration.
- #247 merged (9d7f1e8); no migration. Token pages belong to one company. `/sign/[token]` and
  `/vendor-upload/[token]` (pages and actions) treat another company's token
  as invalid on a company's address (checked before the signing view is
  recorded); on the platform address they move to the company's own address.
  Public pages get a neutral title on the platform address, and company
  pages no longer inherit the root author/creator/description/keywords tags
  (brandedMetadata clears them). No migration.
- #246 merged (fbad2ae); no migration. Public violation reports scoped to the address's company.
  `/report-violation`, its submit action and the AI photo route listed and
  accepted every company's associations (and spent any company's AI key);
  now only the host company's (tenantFromHeaders). Stripe receipts no longer
  send as the platform; the public layout falls back to "Your management
  company" instead of the platform name. No migration.
- #245 merged (e25b1d1); migration 20261007100000 applied and verified
  (sync_owner_delinquency_cases: 3 association checks, grants unchanged). 30
  silent saves fail loudly.
- #244 merged (f0da498); migration 20261007090000 applied and verified (16
  RPCs: 17 association checks plus the post_recurring_journal_entries refusal;
  grants unchanged).
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
- WAITING ON MIRSAD, in order (also at the top of docs/TODO.md):
  1. Stripe test keys in Vercel (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
     -> Claude runs online payments + AutoPay end to end.
  2. Plaid approval -> live bank feed; Zelle deposits matched automatically (#400).
  3. Twilio business verification (KYC + 10DLC) -> two-way texting.
  4. Lob billing address -> physical / certified mail.
  5. Legal sign-off on /legal/*.
  6. Decisions: platform remittance, pilot company, and whether to market the
     tenant (resident) portal (app/resident, requireTenant: it EXISTS; don't expand it).
- BROWSER TESTS (2026-10-25): `npm run e2e:db` then `npm run e2e` (e2e/README.md);
  GitHub runs them on every PR. Next coverage: Stripe TEST checkout and AutoPay
  as soon as the test keys are set; then owner/unit onboarding and bank
  reconciliation.
- DONE (claude/charge-category-seed-once, 20261025010000 LIVE as 20261025065558):
  seed_standard_charge_categories adds a standard category only when the company
  has none with that code (was: a second full set on a second call); anon/PUBLIC
  execute revoked.
- NOTHING LEFT FOR CLAUDE (2026-10-14, superseded by the two items above): every area deep-checked, all 10
  PO/project/inventory/reactivation decisions built (#396, #397), ownership
  done (#388). Do not start new deep checks. Next work starts when Mirsad
  sets Stripe test keys (then: Stripe TEST checkout + AutoPay run) or
  reports a bug.
- DONE 2026-10-14 (#390-#393): the last four never-checked areas were deep
  checked and fixed in one pass each: GL / period and year-end close /
  management fees / loans / credit cards / lockbox (#390); setup records
  (#391); company admin, platform operator, settings, AI assistants (#392);
  reports, scheduled reports, dashboards (#393). Every area of the app has now
  had a deep check. Do NOT re-check done areas (Mirsad 2026-10-14).
- DONE (claude/platform-mail-flag): platform mail flag replaces the sender
  name test.
- DONE (claude/po-projects-deep-check): deep check of purchase orders,
  projects, inventory and fixed assets; 7 bugs fixed, 9 rule questions in
  TODO for Mirsad.
- BLOCKED on Mirsad: Stripe TEST-mode checkout and AutoPay run (Vercel has
  no STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).
- Watching: CSP (0 blocked in 48 h on 2026-10-14; runtime errors only from
  the 2026-10-08 Supabase outage and one refresh token on 10-12).
- DONE (claude/work-orders-followups): recurring work orders email their
  vendor; a completed request follows open work orders moved, unarchived
  or reopened into it.
- DONE in the journal-source-guard PR (20261015060000): direct journal writes
  revoked from signed-in users.
- DONE 2026-10-14 (20261015130000): a removed late fee reads "removed" on
  the owner's ledger and the unit page.
- DONE 2026-10-13 (verified live, no change): payable_bill_line_items
  policies already use the once-per-query helpers (my_finance_portfolio,
  is_platform_operator, my_managed_association_ids) through an EXISTS on
  the bill; the older migration files still show per-row helpers. Dropping
  the unused table is Mirsad's call (TODO).
- DONE 2026-10-13 (measured, no change): v_unit_account_summary at 2,000
  units / 36,000 charges / 8,000 payments: one unit 11-94 ms by role, all
  2,000 units 140 ms for a manager.
- DONE 2026-10-13 (measured, no change): the remaining policies with a
  subquery over another RLS table are fast at scale (rolled back):
  journal_lines 30,000 lines - manager 25 ms, scoped manager 45 ms, board
  40 ms, company admin 17 ms (entries 4-28 ms); units + unit recurring
  charges at 2,000 units - manager 39 ms, scoped manager 10 ms, board 23
  ms, vendor 10 ms. Revisit only a table a page shows as slow.
- DONE 2026-10-13 (20261014140000): executive-session meeting rows and
  attendees hidden from staff outside the confidential-meeting set.
- DONE 2026-10-13: Receivables page totals at 2,000 units ~0.26 s
  unfiltered (receipts from payments). Measured, not worth changing:
  delinquent_units with the local date once per unit 129 -> 126 ms;
  categories with one lateral sum 51 -> 42 ms.
- The same RLS estimate (about one visible unit) can make any view that
  joins charges or payments to units nested-loop at scale; the fix pattern
  is a LATERAL lookup by the unit id (20261013040000).
- DONE 2026-10-13 (measured, no change): all 120 report_data_* reports at
  2,000 units (12,000 charges, 8,000 payments, 24,000 journal lines,
  rolled back) with default parameters finish under 230 ms (slowest:
  account_totals 225, trial_balance_association 223, journal_entry_register
  185, charge_detail 178, income_register 172); homeowner_ledger needs a
  unit (expected error without one).
- CLOSED 2026-10-13 (#353-#357): DEEP CHECK (rolled back, at scale): violations (10k), work
  orders (15k), meetings (3k): every page/RPC under 300 ms for every role;
  visibility correct for owner/board/vendor/scoped manager/other company/
  disabled accounts. Bugs found -> violations PR above; work orders and
  meetings PRs next. Work orders: triage fails on service requests over
  2,000 chars (check constraint); owner can rate a job from before they
  owned the unit; vendor Open tab loads the newest 200 then filters (older
  open jobs hidden); vendor can insert work_order_updates with any
  new_status (fake "Completed" entry); dead createWorkOrderFromServiceRequest
  returns { error }. Meetings: calculate_meeting_quorum (definer, granted to
  authenticated) lets owners and view-only staff rewrite quorum fields, even
  on completed meetings; the recorded quorum is never saved at publish;
  manager meetings list loads every meeting with select * (6 MB at 3,000);
  saveMeetingNotes and addMeetingAttendee allow changes after
  publish/cancel.
- Known, low priority: receivable_unit_totals(null) 239 ms at 2,000 units. Scoped-manager one-unit charge balances fixed by
  20261014060000 (419 -> 88 ms).
- NEXT before the Stripe pilot: run checkout (app/api/payments) and the
  AutoPay route (app/api/payments/autopay-run) against Stripe TEST mode once
  Mirsad sets test keys; only the database side and the webhook route are
  verified (Codex on #347).
- DONE 2026-10-13 (database side verified, no change): online payments,
  rolled back on production (Randolph, test Stripe account id): webhook ledger post
  (post_stripe_ledger_payment as service_role) card and ACH, a repeated
  event returns the same payment (1 row), journal Dr Operating cash / Cr AR
  balanced, intent succeeded, an active payment plan completes; a manager
  reversal (dispute lost / ACH return R01) with NSF fee: Dr AR / Cr cash and
  Dr AR / Cr NSF Fees Collected, plan reopens, balance +250 +35. AutoPay:
  claim once (second claim same day returns nothing), failed finalize counts
  one failure, moves next run a month, repeat finalize is a no-op, no same-day
  retry after a Stripe failure. Refunds/disputes only flag the intent for a
  manager (by design, header of app/api/stripe/webhook/route.ts).
- DONE 2026-10-13 (verified, no change): definer functions/views over
  payment_methods, physical mail, payable checks, automation flows and
  owner payables. No view reads them. Signed-in callable ones all check the
  manager's associations (owner payables via app_owner_payable_for_update ->
  can_manage_association, which includes can_view_association_row;
  void_payable_check scoped) or are company-admin only
  (record_manual_certified_mail_delivery: can_admin_portfolio);
  enroll_autopay is invoker (RLS). claim/complete/fail_physical_mail,
  capture_issued_payable_check, claim_automation_flow_run: no signed-in
  execute (service/trigger only). Production clean since 2026-10-09
  (runtime errors: one expired refresh token; no CSP blocks in 7 days).
- DONE in #340 (20261013100000-110000; measured 2026-10-13, 5,000 rows each, rolled back): per-row
  policies. signature_requests 0.6-1.4 s, signature_signers/events up to
  4.1 s (even board/owner who see 0 rows ~1 s): can_manage_signatures per
  row, twice; bank_transfers 0.65-0.8 s every role
  (app_can_view_bank_account x2 per row); owner_attachments 0.25-0.36 s
  staff (can_view_owner_row); notices 0.48 s owner portal
  (is_notice_recipient per row); agenda_items 0.76 s company admin at 2,600
  meetings (can_access_confidential_meeting_mvp per meeting; meeting
  documents/action items same shape). association_budgets fine. Fix: set
  helpers in rls_private (my_signature_portfolio_ids, my_signature_request_ids,
  my_scoped_bank_account_ids, my_managed_owner_ids, my_notice_ids,
  my_confidential_meeting_ids) used as col in (select ...).
- DONE 2026-10-13: ledger flows exercised (rolled back, manager, Randolph):
  recurring charges, late fees (manual/cron/overrides), management fees,
  bank reconciliation, payment plans, owner credits PASS. Bugs: NSF fee
  credited to 4000 Assessments instead of 4410 NSF Fees (post_nsf_fee has
  no category, charge_gl_accounts has no nsf branch; due date today+15);
  app_recheck_payment_plan ignores reversed payments (plan stays completed
  after the payoff bounces); completed bank_reconciliations can be reopened
  and un-cleared through the table, difference never checked in the DB.
- DONE 2026-10-12: pages that loaded every row to count or sum (swept
  app/**, app/api/**, lib/**: every list is capped or uses fetchAllRows).
  Fixed: Owners, Units (pages), Chargebacks tile (#321, #322), Bank
  deposits (#323), unit pickers follow the association (#324),
  Inspections scores (#325). Checked and bounded (left as is):
  company-admin overview (open work orders / active violations only),
  operator Association health (open items only), Work orders team (open +
  the chosen window), Receipts (date range), Bills (unpaid only).
  Form pickers checked: violations new/field already filter units by
  association (field adds search); deposit slips load only undeposited
  receipts; receipt search added (#326); owners/change,
  architectural-reviews/new and bills/owner-payable/new group by
  association (usable); owners/activations has search + filters (bulk
  invite list, left uncapped on purpose).
- DONE 2026-10-11: operator-without-company crashes (5 pages) fixed, see
  #315.
- AFTER RELEASE of #314: watch Vercel logs for "[csp] blocked"
  for a few days (Stripe/Plaid flows were not exercised live).
  2026-10-12: 0 blocked in 12 h, no runtime errors in 24 h. Keep watching.
- DONE 2026-10-12: ledger-posting flows exercised as the manager on
  Randolph Station in rolled-back transactions on production (nothing
  left behind, verified): homeowner receipt (posts Dr bank / Cr A/R),
  other receipt + void, bank transfer + void, other deposit, deposit slip,
  manual journal entry + reverse, bills submit/approve, check run, void
  check (bill back to approved), void bill, year-end package. All worked;
  every journal entry balanced. Bill payment for a check-only vendor is
  refused with "pay this bill in the check run" (correct). Randolph's bank
  accounts have no authorized check signer; the check-run page already
  greys them out with "signer setup required". Not covered: online/Stripe
  payments (dormant until Stripe keys). Method: one transaction as the
  user that ends in RAISE EXCEPTION carrying the report.
- DONE 2026-10-12: owners (5,000) 2-4 ms, work_orders and occupancies
  (3,000) 1-8 ms per role; payment_applications ~18 ms fixed (only read
  for one payment at a time).
- DONE 2026-10-12: RLS at scale, measured with 5,000 extra rows in a
  rolled-back transaction per role: units 330-390 ms (fixed, #319);
  charges 3-13 ms, journal_lines (15k) 5-16 ms. Static scan for per-row
  function calls in policies: remaining ones are resident-only branches
  (gated by a once-per-query role check) or small tables (bank_transfers,
  owner_attachments, budget_lines, signatures, meeting items).
  payment_applications costs ~18 ms even with 0 rows (fixed overhead; small).
- DONE 2026-10-12: policies with no TO clause (93) applied to signed-out
  callers too; one (maintenance_templates, USING true) opened every
  template to everyone. Fixed in 20261012010000 (#317).
- DONE 2026-10-11: platform-operator screens at 375 px, signed in as
  operator (Mirsad): 20 pages + a company page, no sideways overflow; one
  control under 40px (Overview chart label), fixed. All six roles now
  checked at phone width.
- DONE 2026-10-11: every manager detail page checked with data, signed
  in as manager on a production build of main. Stellar had no rows for 33
  of 48 detail-page kinds, so (Mirsad OK) 28 rows tagged "QA test
  2026-10-11" were added to Randolph Station by SQL, 54 detail pages
  crawled and checked at 375 px: 0 errors, 0 sideways overflow, server log
  clean; then all 28 deleted (verified; no email, SMS, webhook or journal
  entry was created). Ledger-posting flows: see 2026-10-12 above. Also 141 list
  pages: 0 errors, 0.9 s average. Before adding test rows to production:
  check dispatch triggers, webhook_endpoints, automation_flows and the daily
  crons (recurring_* rows need auto_generate=false and far-future dates).
- 2026-10-11 production check: no runtime errors in Vercel for 72 h (all
  12 error groups of the last 7 days were last seen 2026-10-08, before the
  speed work and the compute upgrade).
- DONE 2026-10-11: speed check of 85 manager pages after the compute
  upgrade, signed in: no errors or timeouts; median 2.4 s on a first visit
  (incl. local compiling), all under ~3.2 s once compiled (Command Center
  0.9-1.2 s; an earlier 5.4 s reading was taken while the server was busy).
  Fan-outs of one query per row fixed on Metrics (#294), Payment plans and
  Delinquencies (#296).
- CLOSED 2026-10-11: Receivables page (/charges) timeouts. Fixes:
  receivable_unit_totals split (20261011090000), four page queries in one
  call receivables_page_totals (20261011100000, #292), both reuse their
  plans from the first call (20261011110000), and Mirsad upgraded the
  Supabase compute. Cause was cold database connections (the API closes
  idle ones; a new connection loads every table, view, policy and helper
  these views touch): totals 5.5 s cold before the upgrade, 378 ms after.
  Page now 1.2-2.4 s, no errors. Lessons: judge a page's speed cold (first
  call on a new connection) and warm; pages must not fire dozens of queries
  at once (Metrics did 72; lib/db/map-limit.ts, #294); every committed DDL
  (even a test function) reloads the API's schema cache, so test in
  rolled-back transactions and not in loops.
- 2026-10-10: `npm run check:queries` against production: 0 broken of
  1,164 static queries. Excel report run checked end to end (valid .xlsx,
  17 owners); a refused run now returns to its report with the reason. All six roles checked signed in. 2026-10-04 checks done
  (batch letters, Forms upload + owner download, saved replies). Inbox
  conversation checked too. FOUND + FIXED 2026-10-10: production email
  was down since 2026-07-05 (Vercel RESEND_API_KEY rejected by Resend);
  Mirsad set a new key and redeployed; queued email sends again. A changed
  Vercel variable only applies after a redeploy.
0. Randolph Station is a TEST-ONLY association (Mirsad, 2026-10-10): it
   proved the import end to end (imported and tied out); its 8 name-only
   vendors stay as they are, no contact/tax/insurance to enter. The next
   real association uses the import page incl. the opening balances step
   (CSV exports do not state the basis: tick the accrual box).
1. Stripe live for one pilot association (Mirsad's account setup).
2. CLOSED 2026-10-10: per-request identity caching is not needed.
   Re-measured after 20261011010000-60000: the security checks cost
   0.2-2 ms per query for manager, owner and vendor (one-row reads of
   work orders, owners, journal entries, violations, meetings).
3. DONE 2026-10-10 (20261011060000): board journal-entry read
   (journal_entry_touches_board_associations per entry -> once-per-query
   set rls_private.my_board_journal_entry_ids; board 5.6 -> 1.0 ms with 16
   entries, and it no longer grows per entry) and can_manage_violations
   (same body as can_manage_association -> my_manageable_association_ids)
   on 6 violation policies. 0 differences in 338 checks incl. a fixture
   board member. Left per-row on purpose: resident move-in date checks
   (run only on rows already narrowed to the owner's units), meetings,
   budgets, signatures, notices, bank transfers, import locks (small
   tables). Revisit only if one of them is measured slow.
