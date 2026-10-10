# Decisions

Back to [[Home]]. Don't redo these.

- **`'stripe'` stays in the `payment_processor` enum.** It is live: the Stripe
  Connect webhook saves payment methods with it and `select_payment_processor()`
  falls back to it. The old TODO item to drop it was withdrawn (2026-10-07).
- **AppFolio open-balance import is a go-live tool, not a reconciler**
  (Mirsad, 2026-10-08, #258): re-imports never repost and report changed or
  missing items of associations in the file; an association whose items are
  all paid (absent from the export) is left to the Import Variances report.
  Don't build a reconciliation pass unless he asks.
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
  compared fiscal year to date.
