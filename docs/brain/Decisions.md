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
