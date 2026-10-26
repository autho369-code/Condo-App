# Decisions

Back to [[Home]]. Don't redo these.

- **Every owner and tenant gets email** (Mirsad, 2026-10-13): as in
  AppFolio, the sender chooses owners, tenants or both; an owner's preferred
  contact (mail) and electronic_consent don't stop email (dues reminders
  included). Only an unsubscribe or spam report (optional mail) or a bounce
  stops it.

- **Email opt-out follows the recommended defaults** (2026-10-13, Mirsad
  hadn't answered; TODO keeps the question open): an unsubscribe stops
  optional mail only (mass email, announcements, dues, insurance and
  calendar reminders, automations, vendor bulk mail); sign-in links,
  receipts, statements, notices, letters, form and signing requests and
  replies are always sent. A bounced address gets nothing; a spam report
  stops optional mail only (like an unsubscribe), so sign-in links and legal
  notices still reach the owner (security review).
  Suppressions are per company (white label; Resend already stops hard
  bounces account-wide). Only the recipient undoes an unsubscribe or spam
  report (from the link); staff can allow a bounced address again. Managers
  limited to some associations don't see or clear suppressions (they are by
  company, not association). Platform mail
  sent as Portier369 has no company unsubscribe link (account mail).
  Accepted: staff who queue mail directly with a required kind's key (e.g.
  notice:) send it as required; that is a deliberate act, like emailing
  from their own mailbox. Suppression is checked when the worker sends, not
  when mail is queued (no per-row cost; covers mail queued earlier).

- **A reply belongs to the company that texted from that number**
  (2026-10-13, Codex on #369): when several companies know a sender, a text
  reply or START goes to the company with a text we sent the sender from
  that number, as Twilio reported it (sms_messages.provider_from_number,
  server-only). Otherwise it is not filed with any company (each gets a log
  entry without the message). STOP opts out every company. Numbers staff can
  edit (from_number, our_phone_number) never decide.

- **Sign-in emails are invisible in the app** (2026-10-13, 20261014220000):
  password-reset, invitation, e-signature and upload emails (email_queue
  holds_auth_link) show nowhere a signed-in user can read: not in an owner's
  email history, the Communication Center or the platform-operator monitors
  (system, insights). Their links would let the reader act as that person.
  The request itself stays in the audit log; delivery is unaffected.

- **Buyers see the payment applications on their unit's charges**
  (2026-10-13, 20261014190000): so a charge the seller paid shows as paid.
  The seller's payment rows stay hidden (move-in cutoff); an application
  shows only the amount and date applied (its notes column is unused, and
  payment notes are private in payment_private). A late Stripe checkout
  event after a refund/return/cancel changes nothing; posting is idempotent
  per Stripe PaymentIntent, so a retried post is a no-op.

- **Supabase "multiple permissive policies" warnings stay** (2026-10-11):
  511 warnings on 165 tables (one policy per role: staff, board, resident,
  vendor, operator). Since 20261011010000-60000 every policy helper runs
  once per query; measured cost 0.2-2 ms per query. Merging policies per
  table would risk who-sees-what for no visible speed. Revisit only if a
  table is measured slow because of it. "Unused index" (889) notices: most
  tables are still small; don't drop indexes on that signal alone.

- **Project spend totals count every account, readable or not** (2026-10-10):
  the projects list total equals the project page total, which already adds
  spend on restricted GL accounts as one unnamed "Restricted accounts" line.
  Staff who can see a project see its total; bill rows stay finance-only.

- **`'stripe'` stays in the `payment_processor` enum.** It is live: the Stripe
  Connect webhook saves payment methods with it and `select_payment_processor()`
  falls back to it. The old TODO item to drop it was withdrawn (2026-10-07).
- **AppFolio open-balance import is a go-live tool, not a reconciler**
  (Mirsad, 2026-10-08, #258): re-imports never repost and report changed or
  missing items of associations in the file; an association whose items are
  all paid (absent from the export) is left to the Import Variances report.
  Don't build a reconciliation pass unless he asks.
- **State rules are the company's, per state, for the whole USA** (Mirsad,
  2026-10-10: "forget illinois rule pack, this software needs to be for
  entire usa"; "the company admin should be able to add this for each
  particular state and it should be visible to the property manager").
  `company_state_rules` (company admin edits, staff read) overrides the
  built-in `collection_jurisdiction_profiles`. Never build a single-state pack.
- **Owner logins are cut off with "Unlink login", not by changing the
  email** (Mirsad, 2026-10-10). An email change keeps revoking only added
  logins whose own email no longer matches (typo fixes stay harmless).
- **No confirm prompts on reason-required void/cancel forms** (Mirsad,
  2026-10-10): the required reason is enough.
- **Randolph Station is a test-only association** (Mirsad, 2026-10-10):
  don't treat its data as a real client's or chase missing details there
  (e.g. vendor contact/tax/insurance).
- **Resale / estoppel certificate:** declined by Mirsad; build only if he asks.
- **Old `/platform/*` URLs** redirect permanently to `/platform-operator`
  (`next.config.mjs`), 2026-10-07.
- **Invitation emails** link to `<slug>.portier369.com` (sign-in rule); the
  Runbook link may use the verified custom domain.
- **Invitation tokens are always server-generated** (64 lowercase hex). Rows
  written through the API get a fresh token from the trigger and can't change
  it; a new SECURITY DEFINER RPC must never write a caller-supplied token.
- **Neutral company-name fallback stays "Your management company"**; blank
  names are now impossible (DB check + every settings action), so it is only a
  last resort.
- **Brand color is always #RRGGBB** (DB check; middleware falls back to
  #10B981) because it is sent to every page as a request header.
- **Server actions never fall back to a client-sent (bound) id** — use the
  caller's own portfolio and error if it's missing.
- **Destructive or access-changing one-click actions use `PendingSubmit` with
  `confirm`** (remove staff, send reset link, change role). The confirm runs
  only after the form is valid, so mark choices that must be made `required`.
- **AI setup is company-admin only; every company brings its own provider
  key** (no platform fallback key yet). Managers see an "ask your company
  admin" note, never a bouncing link.
- **Token pages belong to the token's company.** On another company's address
  a signing or vendor-upload token reads as "isn't valid" (never says whose it
  is). On the platform address (no company) the page moves to the company's
  own address instead of failing: email links already use that address, so
  this only catches older or copied links. Pages with no token to name a
  company (`/report-violation`) still fail closed there.
- **Links managers share with the public use `companyUrl`** (the company's own
  address), never the platform host; with no workspace address, show an
  Alert instead of a link that wouldn't work.
- **`/accept-invitation` is the exception to the platform-address redirect.**
  On another company's address it is invalid like the other token pages, but
  on the platform address it stays (no move to the company's address):
  `/invite` sends people whose account belongs to another company there to
  sign in and accept, and their session lives on that address. The RPC binds
  the invitation to its email, so this is safe.
- **A company's address is its portal, never the platform's site.** There,
  marketing paths redirect to login, robots.txt is disallow-all, and the
  platform's own files and marketing APIs 404 (`PLATFORM_ONLY_PATHS` in
  `middleware.ts`). A new platform-only file (sitemap-like, `public/*.html`,
  marketing API) must be added there; `public/*.html` also to `PUBLIC_ASSETS`.
- **Deleting an association is a SQL-editor job for Mirsad** (2026-10-09):
  `owners.association_id` is ON DELETE RESTRICT, so a plain delete never
  removes homeowners silently. `delete_association_completely()` and
  `delete_unlinked_owners()` are revoked from every app role (incl.
  service_role); never add an app path or API to them, and Claude never runs
  them.
- **Vendors per association, with one management-company exception**
  (Mirsad, 2026-10-09). `vendors.association_id` + `is_management_company`
  (exactly one holds). Linking a vendor of another association to a work
  order, bill, check, PO, etc. is refused in the database
  (`trg_vendor_same_association` on every vendor/association table).
  Management fees only accept the management-company vendor. Asked: "one
  company-level exception" vs a copy per association — he chose the
  exception. 1099s stay per association (each association is the payer).
- **Late fees can be removed by managers** (Mirsad, 2026-10-13: "THE
  MANAGER SHOULD BE ABLE TO REMOVE LATE FEES"). Built as a credit to the
  fee's own income account (Dr late-fee income / Cr A/R), not a delete: the
  ledger keeps the history and the daily run can't charge it again. A paid
  fee is refused (give a credit or refund). Finance staff only. The owner's
  ledger shows the credit as "Late fee removed"; the reason is staff-only.
- **Amenity requests in the portal stay** (Mirsad, 2026-10-14: "YES"):
  owners can request an amenity in the portal and staff approve it, for
  amenities set to in-app booking; email/link amenities show their address
  or link.
- **ARC "Send decision for e-signature" stays** (Mirsad, 2026-10-14: "YES").
- **No interest on overdue balances** (Mirsad, 2026-10-14: "THERE IS NO
  INTEREST", "ITS ONE TIME LATE CHARGE"): a late payment gets one late
  fee, charged once. Interest settings and the daily interest job were
  removed; never add interest back. Changing how a money rule works is
  Mirsad's call; bug fixes are not.
- **A bill posts to its header expense account** (verified 2026-10-13):
  payable_bill_line_items is unused (no writer, no reader), so
  set_payable_bill_expense_account decides what is posted. Line-item
  posting would be a new feature, not a fix.
- **One vendor login across associations: build now** (Mirsad,
  2026-10-09), as its own PR after vendors-per-association. Until then the
  auto-link links the oldest matching record (no more failed sign-ups when
  two records share an email).
- **A login reaches records only through their own invitation** (Mirsad,
  2026-10-09). Staff invite per record; accepting another record's invite
  while signed in adds it to the login (`vendor_portal_logins`). Never by
  email match (asked: "staff invites per record" vs "automatic by matching
  email" — he chose invites; the old email fallback in `current_vendor_id()`
  is gone). **Pattern for multi-record logins (owners next):** keep
  `<table>.auth_user_id` unique for the first record, add a link table
  (record_id PK, auth_user_id, portfolio_id, invitation_id) written only by
  the invitation trigger, a PL/pgSQL `current_<x>_ids()` SETOF helper, and
  `ALTER POLICY` every `= current_<x>_id()` to `IN (SELECT current_<x>_ids())`.
  The portal shows the union; every write targets one exact record.
  **Owners (2026-10-09):** same pattern (`owner_portal_logins`,
  `current_owner_ids()`, invitations carry `metadata.owner_id`). Differences
  from vendors: turning an owner's portal off is a pause (staff re-enable it
  only while `auth_user_id` is set), so it does not unbind; board access stays
  on `board_members` (already per association). Shipped in two PRs: database
  + invitations first (current pages keep reading the first record), then
  the portal pages and the staff owner pickers (part 2). Rules from part 2:
  a write by a login with several records never falls back silently to the
  first record; it uses the record holding the unit/association, or asks
  which association (`?record=` switcher / Association select). Staff side:
  an owner picked with no association must be in an association the caller
  manages; with one, the owner must be that association's record.
  **Sold units (Mirsad, 2026-10-09):** what matters is the unit, not the
  owner. When a unit is sold, the old owner is removed and the new owner is
  moved in once they provide the closing documents. So an owner record with
  no current unit is not a state to design for: former owners get no
  association access (no widening of `associations` reads for them).
- **Imported credits (2026-10-09):** a credit or prepayment in the previous
  system's open-balance file posts as a homeowner credit that mirrors an
  imported charge: Dr the income account a charge of the "Other" category
  posts to, Cr A/R. The unit's A/R goes negative (the app's prepayment
  model; used up by the next charges). No separate prepaid-liability
  account (the chart of accounts is the company admin's). It is recorded as
  a negative imported balance so re-imports skip it.
- **Company chart = the previous system's chart (2026-10-09, Mirsad):**
  account numbers mean exactly what they meant in the previous system (the
  trial balance and open balances import by number). Starter accounts that
  are not in that chart stay hidden, not deleted.
- **No bare DELETE in database functions (2026-10-09):** Supabase runs
  pg_safeupdate for API sessions, so `delete from x;` with no WHERE fails
  even inside a security definer RPC ("DELETE requires a WHERE clause").
  Clear a per-call temp table with `truncate`. A test fails any later
  migration that adds a bare DELETE.
- **Tie-out prior-years line (2026-10-10, Mirsad asked):** when the trial
  balance file has its "Calculated Prior Years Retained Earnings" line, the
  tie-out counts on that line the ledger equity accounts named retained
  earnings that the file does not list and whose name says prior/previous
  (and nothing of this year's: current, this, YTD, CY) or is exactly
  "Retained Earnings"; any other wording keeps the account on its own row
  (an unreadable name shows as a difference, never hides a balance). Names
  them on the row. An account the file lists is compared on its own row.
  Mirsad (2026-10-10, #271): when the file lists the number, the numbered
  row is compared whole; a combined (all associations) file where two
  associations use the same number for different equity is left as two
  offsetting rows (total still right), not split by guessing.
- **Opening balances from the trial balance (2026-10-10, Mirsad asked):**
  the import page posts one entry per association dated the as-of date:
  each account's difference between the previous system's trial balance and
  the ledger, so open balances imported first are left out (import open
  balances first). Prior years' retained earnings go only to an account the
  tie-out pairs with that line. It never reverses a ledger balance the file
  does not list, never posts to hidden accounts, and needs an accrual file
  compared fiscal year to date. One opening entry per association (found by
  its memo on the association's lines, any date); corrections go in as
  journal entries.
  Mirsad (2026-10-10, #272): the read-then-post gap (a manual journal entry
  landing in the same second) is accepted; the tie-out re-runs right after
  posting and shows any mismatch. No transactional RPC for it.
- 2026-10-12: RLS policies apply to authenticated only; signed-out
  reads/writes go through explicit `to anon` policies or the service
  client. maintenance_templates "Anyone can read templates" was switched
  off with USING (false) instead of dropped (DROPs are Mirsad's).
- 2026-10-13 (replaced the same day): a completed bank reconciliation can be
  undone, as in AppFolio, but only the account's LATEST one, by finance staff
  who can reconcile the account, with a reason (audited; kept on the row), and
  not when a month it covers is closed (reopen the month first). It goes back
  to in progress with its cleared items as they were. Otherwise the database
  still refuses changes to a completed one and its items, and completing an
  unbalanced one (20261013080000/090000, 20261015020000). The earlier "final,
  no undo" rule was Claude's from the deep check, not Mirsad's. A
  reconciliation in progress can be discarded (items, then the
  reconciliation: two steps, so a failure can leave an empty one in progress,
  which can be discarded again); a reopened one can't (it was completed once;
  complete it again, correcting its statement ending balance if needed).
- 2026-10-13: a month inside a finalized year-end package can't be reopened
  until the package is superseded (finalizing already needs every month
  closed). Months are company-wide, so one association's finalized year keeps
  that month closed for the whole company (20261015020000).
- 2026-10-13: a ledger line, journal entry or bank adjustment cleared on a
  completed reconciliation can't change amount, account, date or posting, or
  be deleted, until that reconciliation is undone; a reversal (new entry) is
  the correction (20261015020000).
- 2026-10-13: a payment plan measures a bounced receipt as a pair: the
  receipt and its reversal charge are both left out only when the receipt is
  inside the plan window; a receipt from before the plan that bounces counts
  its reversal charge against the plan as soon as the bounce is recorded,
  even when the reversal is dated in the future (20261013150000/180000/190000). A completed plan reopens only on a payment
  correction; ordinary dues that fall due after completion are a new
  delinquency, not the old plan (190000). The plan window runs from its start
  to completion or cancellation, for receipts and charges alike; activity
  after it is not the plan's (200000). Edges use recording times
  (created_at, reversed_at), not due dates; since 20261015050000 that
  includes the start edge for charges (a charge counts when recorded after
  the plan was made; charges already on the balance are in its total). On a unit with several plans,
  money recorded inside a plan's window (not cancelled) is that plan's.
- 2026-10-13: when a migration changes how a stored status is derived
  (payment_plan_paid_amount -> plan status), the same PR rechecks existing
  rows (20261013230000); a measure change alone leaves stale statuses until
  the next triggering write.

## Board decisions are recorded by staff (2026-10-13)
The board portal stays read-only (product rule), so a bill, purchase order or
other request needing the board is decided by the board at a meeting or by
email and **staff record the decision** on the bill page
(record_approval_decision: approved/rejected, note, who recorded it, when;
kept in approval_decisions). Nothing else can mark a request approved
(trigger approval_requests_approve_guard). Vendors never choose expense
accounts: a vendor-portal invoice arrives without one and staff set it.

## Work orders follow-ups (2026-10-14)
- **Reopened request keeps its resolution note.** When an open work order
  returns to a completed request, the request is waiting again and
  resolved_at / resolved_by are cleared; the note staff wrote stays (nothing
  they wrote is lost). Ask Mirsad before clearing notes.
- **Nightly recurring jobs are emailed by an app cron, not SQL.** The pg_cron
  generator can't run the app's email code, so
  /api/work-orders/notify-recurring (12:00 UTC) emails vendors their new
  recurring jobs with lib/notifications/vendor-assignment.ts: one template,
  one white-label link builder, no SQL copy to drift.
- **A reopened request can send `service_request.resolved` again.** When it
  completes a second time, the customer webhook fires again (each completion
  is real). Integrations should treat it as "resolved as of now".
- **Imported history sends no vendor email.** Work orders brought over from
  a previous system keep their vendor without emailing it; they are past
  jobs, not new assignments.

## Claude may auto-merge its PRs (2026-10-14)
Mirsad gave permission in chat to auto-merge and keep working through the
TODO list. Conditions in [[PR Rules]] (Codex clean, CI green, threads
resolved, migration live; enable through the PR tool, never merge by hand).

## A unit sale is "move in the new owner" (Mirsad, 2026-10-14)
Selling a unit = recording the new owner moving in (Change homeowner). No
closing settlements, seller history access, board-seat rules or other sale
policy. Ownership work is done (#388); only real, reported breaks get fixed.

## Purchase orders, projects, inventory, reactivation: 10 decisions (Mirsad, 2026-10-14)
Mirsad: "go with your recommendations on all 10 decisions".
1. Staff record the board's decision on a PO, including one they created
   (like bills; the note says where the board decided).
2. A bill within a board-approved PO's amount skips the board vote.
3. The vendor is emailed when its PO is approved (once per approval).
4. A recurring PO creates only the current period's draft, never a backlog
   of missed periods.
5. Project "Committed" = open approved PO balances + unpaid bills (open PO
   balances only for finance staff); "Spent" = paid bills.
6. PO numbers are automatic per company (PO-00001) and unique (case-insensitive).
7. Purchase orders are finance-only in the database too, like the pages.
8. Company admins see and use inventory (reports stay staff-only).
9. "Used on work order #N" is resolved within the item's company and an
   ambiguous number is refused.
10. No late fee for 24h after a company is reactivated on units whose AutoPay
    is due; and in every company, none while the unit has money in flight
    (processing payment under 14 days old, or AutoPay pending under 1 day).

## Zelle owner payments (2026-10-14)
Zelle owner payments: identified by remembered sender, memo unit number, owner
name, amount; staff confirm; Plaid original_description required.
- No auto-posting: the bank feed suggests the unit with its reason and
  confidence, staff choose and click Receive.
- Search only units in the bank account's association(s); the remembered
  sender is per association and is downgraded when the unit has a new owner.
- Where owners send Zelle (association recipient) is a finance decision, like
  the allocation order (#391).

## Grok outside review (2026-10-24)
- The root PORTIER369_*.md audits (2026-08-01) are historical; the live
  state is Status.md. Outside reviewers get pointed at Status, not them.
- Health alert: the database only counts (platform_health_summary, operator
  or service role); the email is written in app code by a daily Vercel cron
  (/api/platform/health-alert), like other nightly mail. Platform mail, one
  per operator per day (key platform-health:<day>:<operator>; service-role
  inserts stay required mail). Sent only when something failed. Counts and
  job names only, never recipients or contents. Known limit: if Resend or
  the Vercel cron itself is down, no alert arrives (the System Monitor still
  shows it). Vercel cron failures themselves are not in the summary (they
  live in Vercel logs); a stuck email queue does show up.
- Not doing (Grok #6): replacing ~3,600 `any` casts, a typed domain layer,
  lib/env.ts. Column mistakes are caught by npm test's live-schema check;
  a rewrite is risk without user-visible gain (no overcomplication).
- Not doing without Mirsad: a public "beta / early access" page and the
  pilot plan (business decisions, TODO "Business decisions").

## Browser test environment (2026-10-25)
- Browser tests run on a LOCAL Supabase in Docker (e2e/supabase, port 55321)
  built from a schema-only `supabase db dump` of production plus production's
  auth triggers, storage buckets/policies and global reference rows. Never
  production; the seed and helpers refuse any other URL.
- Not the hosted staging project: staging stopped at 20260803080000, and
  production's own migration history can't be replayed cleanly (some functions
  were changed outside it). The replay attempt left staging part-way
  (53 production migrations after Aug 3 + one function); nothing uses staging
  now. Not a Supabase branch either: this client can't confirm branch cost,
  and the raw history can't rebuild an empty database.
- The dev server for tests gets the local settings in its process environment,
  which Next.js prefers over .env.local (production). Outside services off.
- Tests sign each role in once per run (the app's sign-in rate limit: 10 per
  account per 15 min counts successful sign-ins too).
- Refresh the schema dump after production schema changes the tests should
  cover (scripts/e2e/build-db.mjs; e2e/README.md).

## Email to owners on hold (2026-10-26)
- Mirsad: "stop sending emails to the owners" — the sample building on
  production is a real building (17 owners; 6 automatic dues reminders went
  out 2026-10-15, 1 message 2026-10-10). Texts and physical mail never sent.
- platform_flags.hold_resident_email (on) makes claim_email_queue_snapshot
  leave mail to owners/tenants pending: held, not sent, not deleted. Staff and
  platform mail unaffected. Only Mirsad lifts it.
- Mirsad 2026-10-26: keep the sample building's data as it is; the hold is
  enough. Don't replace or delete its owners.
- Email leaves the platform only through the app worker
  (/api/email/process-queue -> claim_email_queue_snapshot). The old edge
  functions send-email and process-email-queue are retired stubs (410); never
  redeploy a mail sender as an edge function that accepts the anon key.

