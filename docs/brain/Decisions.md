# Decisions

Back to [[Home]]. Don't redo these.

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
  company, not association). Owners
  who prefer mail get no optional email. electronic_consent is not
  enforced (nearly every owner has it false; Mirsad's call). Platform mail
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
- 2026-10-13: a completed bank reconciliation is final in the app (no undo);
  the database refuses changes to it and its items and refuses completing an
  unbalanced one (20261013080000/090000). A mistaken one is fixed by the
  platform (service role is not blocked). The app never offered reopening.
- 2026-10-13: a payment plan measures a bounced receipt as a pair: the
  receipt and its reversal charge are both left out only when the receipt is
  inside the plan window; a receipt from before the plan that bounces counts
  its reversal charge against the plan as soon as the bounce is recorded,
  even when the reversal is dated in the future (20261013150000/180000/190000). A completed plan reopens only on a payment
  correction; ordinary dues that fall due after completion are a new
  delinquency, not the old plan (190000). The plan window runs from its start
  to completion or cancellation, for receipts and charges alike; activity
  after it is not the plan's (200000). Edges use recording times
  (created_at, reversed_at), not due dates. On a unit with several plans,
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
