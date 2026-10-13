# Shipped

Back to [[Home]]. Newest first. (The session-start hook also prints the last
15 merges on main live from git.)

## 2026-10-13
- Banking: reserve accounts protected by the board-authorization rule;
  closed months can't be reopened without the audited step, and only by
  staff over every association; reconciliations validated in the database
  (dates, book balance, no double clearing); transfer voids dated after the
  transfer; deposits keep their totals; faster reconciliation start
  (20261014170000).
- Payables follow-ups: 1099 link for finance staff only; recurring bills
  change only through their screens; homeowner payable dates checked;
  credit-paid bills dated correctly and left out of 1099 counts
  (20261014160000).
- Payables: vendor-portal invoices can be approved and paid; staff record
  the board's decision on a bill (no silent approval); duplicate invoice
  numbers refused; payment dates checked; 1099 report keeps archived
  vendors; vendor portal totals complete (20261014150000).
- Executive sessions are hidden from staff not assigned to the
  association: the meeting, its agenda text and attendees (20261014140000).
- Meeting lists put undated meetings last, so recent meetings are never
  cut off by the row limit.
- Meetings: owners and view-only staff can no longer change a meeting's
  quorum; the quorum is recorded when the meeting is completed; a completed
  meeting can't be reopened, edited in its result, date or association,
  deleted or created with a made-up result; a cancelled one can't be
  reopened; notes and attendance lock after completion; the meeting page
  shows the derived quorum; meetings list loads fast (20261014100000-130000).
- Violations: a hearing can be requested only after the first notice, and
  the owner page shows the deadline; changing a charge's type moves its
  ledger entry (20261014110000/120000).
- Work orders: long service requests convert, vendors' Open tab shows every
  open job, vendors can't post fake status entries, owners rate only their
  own jobs (20261014090000).
- Violation fines post to Violation Fees on the day assessed; hearing
  requests respect the window; owners see their violation timeline
  (20261014080000).
- Charge balances and category totals 2-5x faster for every staff role
  (20261014060000/070000).
- Budget vs actuals, budget worksheet and budget forecast 15-35x faster;
  ledger totals behind accounting pages and reports ~8x faster
  (20261014040000/050000).
- Applying a payment and moving its unit can no longer race (20261014030000).
- An applied payment or charge cannot be moved to another unit
  (20261014020000); Stripe webhook route tests (Codex on #347).
- Owner portal and board money pages up to 30x faster: access rules on
  charges/payments/applications no longer expand inside each query
  (20261014000000); payments apply only to charges on their own unit
  (20261014010000).
- Existing payment plans rechecked under the new measure (Codex on #345,
  20261013230000).
- Payment plans: one window by recording time; charges posted after a payoff,
  backdated bounces and two plans on one unit handled; Payment Plans report
  matches the plan (20261013200000/210000).
- Receivables page totals ~25% faster at scale (20261013220000).
- Payments after a plan completes no longer hide a bounce of a payment that
  paid the plan (Codex on #344, 20261013200000).
- A payment plan reopens when a payment from before it bounces with a future
  date (Codex on #343, 20261013190000).
- A payment made before a payment plan that bounces after it started reopens
  the plan (Codex on #342, 20261013180000).
- Managers limited to some associations no longer reach other owners'
  payment methods and letters; company-wide automations read-only for them
  (#342, 20261013160000).
- Payment plan reopens on a bounced payoff whatever the reversal date
  (#342, 20261013150000).
- Payment plan reopens on a bounced payoff even with other receipts;
  reconciliation items can't race a completion (#341, 20261013140000).
- E-signature lists 100-300x faster at scale (#340, 20261013100000).
- Bank transfers, owner attachments, owner notices, meeting items checked
  once per query; managers can create and edit meetings again (#340,
  20261013110000/120000/130000).
- Unapplied credits 3x faster; unfiltered Receivables totals read past-due
  units once (#339, 20261013060000/070000).
- NSF fee to NSF income, payment plan reopens after a bounced payoff,
  completed bank reconciliations locked (#339, 20261013080000).
- Past-due units list 2.5x faster at scale (#338, 20261013050000).
- Receivables (aged_receivables) 4-13x faster at scale (#337,
  20261013040000).
- Policy copies of the association checks match a manager's scope; payout
  matching filters in the query (#336, 20261013030000).
- Database functions that checked only the company respect a manager's
  associations (#335, 20261013010000).

## 2026-10-12
- Reviewer follow-ups to #333: journal entry update/delete across
  associations, signature reminder/void, violation photos, payout matching,
  resident invitations (#334, 20261012130000/140000/150000).
- Manager scope on journal entry headers, recurring journal entries and the
  document repair tool (#333, 20261012120000).
- Manager scope on documents, notes, tags, audit and deleted-records logs,
  SMS opt-ins (#332, 20261012110000).
- Manager scope on 72 child tables + parking (#331, 20261012100000).
- Managers assigned to some associations limited to them on 43 more tables
  (#330, 20261012090000).
- Budget lines read 35-50x faster at scale (#329, 20261012080000).
- Full bank account numbers no longer reachable by staff through an unused
  function or the deleted-records log (#328, 20261012060000/070000).
- New homeowner receipt: search for the homeowner, unit or association (#326).
- Inspections scores computed in the database (#325, 20261012050000).
- Unit dropdowns follow the association (5 forms); Calendar gets a real
  Unit dropdown (#324).
- Units list Previous/Next pages (#322). Bank Deposits grouped in the
  database (#323, 20261012040000).
- Owners/Units lists render 500 rows with a notice; Owners balances in a
  few reads; Chargebacks tile from chargeback_totals; association Units
  tab pages its owners and renters (#321).
- Lists past 1,000 rows (#320): company-admin Violations tiles counted
  in the database; capped lists say so; Owners tenants, Maintenance,
  Delinquencies, association Units page past the cap. Company admin
  section shows the no-company notice to an operator with no company.
- units read 70x faster at scale: manager-scope policy once per query
  (#319, 20261012020000).
- Migration check ignores SQL comments when looking for CREATE POLICY
  without a TO clause (Codex P2 on #317) (#318).
- RLS policies are for signed-in users only (#317, 20261012010000):
  maintenance_templates no longer readable by everyone; is_system no
  longer shares a company's templates or report definitions with every
  company; 91 policies with no TO clause now TO authenticated; the
  migration check fails a new CREATE POLICY without a TO clause.
- Platform operator Company details: Support phone field (portfolios.
  support_phone, shown to owners on the Emergency page and portal home)
  (#316).

## 2026-10-11
- Operator without a company (#315): 5 pages showed
  "We could not load this workspace" for a platform operator; they now show
  a notice with a link to Companies; 2 actions refuse with a message.
- Enforced Content Security Policy with a per-request nonce on every app
  page (#314): an injected <script> no longer runs (verified on
  a production build); Plaid allowed; print script by hash; dynamic 404;
  /api/csp-report logs blocks. Marketing pages stay report-only.
- Field ties its own label (#313, Codex on #312): a
  Field with one Input/Select/Textarea and no htmlFor wraps it in the label;
  195 such Fields were unnamed to screen readers (profile page 18 -> 0).
- Accessible form labels (#312): every field label is
  tied to its control (~45 in 15 forms, mostly moved onto Field/Input/
  Select); lint rule label-has-associated-control on in CI. Remaining
  jsx-a11y recommended findings are by design: command palette (combobox
  pattern), CardTitle (children), MFA code autofocus.
- Operator screens checked at 375 px signed in (21 pages, no overflow);
  Overview chart labels made 40px rows (#310).
- Index on email_sender_domain_owners.portfolio_id (claude/fk-index;
  migration 20261011140000, LIVE): Supabase's only unindexed foreign key.
- Middleware time limits (claude/middleware-deadlines): every database call
  in middleware 6 s, the sign-in check 9 s, so a slow database answers 503
  "try again" within Vercel's 25 s instead of hanging (155 such timeouts
  Sep 2 - Oct 8). No sign-out, no "workspace not found", refreshed cookies
  kept; a failed identity lookup refuses every request (fails closed).
  Codex: a hit time limit now cancels the request's database calls (no
  token refresh finishing after the answer), and the branding 503 keeps
  refreshed cookies too.
- No more buttons inside links (claude/link-button-nesting): 367 spots in
  200 files (`<Link><Button/></Link>`, `<a><Button/></a>`) are one link
  styled by buttonClass() - valid HTML, one Tab stop and one accessible name
  each; looks identical (measured against main on four pages).
- Platform operator at phone width (claude/operator-tap-targets): 40px tap
  targets on 10 operator pages (filters, invoice fields, row actions on
  Support and Piper, links); Companies View/Billing were <Button> inside
  <Link> (invalid) and are now plain links. Name links inside table cells
  left as they are (same as #299). #299-#302 merged inside #303.
- Metrics month-end receivables in one pass (claude/metrics-month-ends;
  migration 20261011130000, LIVE): receivable_summary_by_months replaces
  twelve receivable_summary_as_of calls inside metrics_monthly_trend
  (join, not a per-row subquery, so it scales with payment applications).
  Identical results incl. back-dated charges and partial payments; the call
  1.6-2.9 s -> 0.16-0.33 s; /metrics 1.7-2.1 s signed in as a manager
  (was 4.6-5.2 s before #301).
- Metrics: monthly call runs alongside the snapshot (claude/metrics-parallel;
  on #301): measured signed in as a manager, /metrics 4.6-5.2 s before #301,
  3.6-3.8 s with #301, 2.7-2.8 s with this. Remaining: the 12-month
  receivables (about 1.3 of the 1.5 s call).
- Metrics in one call (claude/metrics-one-call; migration 20261011120000,
  LIVE): the page's month-by-month figures (6 requests per month, 72 a year)
  come from one security-invoker function, metrics_monthly_trend, using the
  same functions and filters: ~1.4 s for 12 months in the database (was 5-9 s
  for the page two months at a time). 0 differing months for manager,
  company admin and board, with and without an association filter.
- Design follow-ups (claude/design-followups; no migration): shared StatTile
  replaces 12 hand-built figure tiles; shared segmented control for every
  pill switcher (vendor filter, calendar views, platform-request tabs,
  RecordSwitcher, vendor compliance); vendor forms on the shared form kit.
  Documented in DESIGN_SYSTEM.md.
- Board, vendor and company admin at phone width
  (claude/board-vendor-admin-tap-targets; no migration): signed in per role
  at 375 px, 37 pages, no horizontal overflow. Tap targets raised to 40 px;
  figure tiles fixed where large amounts spilled out (12 hand-built copies
  plus the shared Metric/MetricStrip). Follow-ups in docs/redesign/PROGRESS.md.
- Owner portal at phone width (claude/owner-portal-tap-targets; no
  migration): signed in as owner2 at 375 px, all 24 portal pages plus a
  work order: no horizontal overflow. Raised to 40 px: dashboard and
  Emergency contact/action links, "Back to work orders", assistant
  suggestion chips (shared by every role's assistant), ledger Print/CSV/PDF
  (shared Button), file-upload buttons (8 forms), reminder checkbox
  labels, insurance certificate link, attachments Upload (shared Button).
  Finding for Mirsad: Stellar has no support phone/email set, so owners'
  Emergency page shows no contact for the management company.
- Per-row database calls limited (claude/limit-per-row-rpcs; no
  migration): Payment plans read one schedule per plan (up to 500 at once)
  and Delinquencies one referral-readiness check per case, all at once;
  now four at a time via lib/db/map-limit.ts. Same figures. Production has
  few such records today, so this prevents the Metrics-style timeout
  before it happens.
- Shared components (claude/shared-components-cleanup; no migration):
  calendar filters -> Select, Print/CSV/PDF export buttons -> Button
  (secondary, sm; on ~19 list pages), Reports search card and Company admin
  invite card -> Surface. Checked at 375 px and desktop: 40 px controls,
  no horizontal overflow, same card padding and radius.
- Supabase compute upgraded by Mirsad (2026-10-11). Re-measured: cold
  connection totals 378 ms (was 5.5 s), with homeowner filter 278 ms (was
  12 s); Receivables page 1.2-2.4 s, no errors (was 15-29 s with errors);
  dashboard, accounting, command center, units, owners, management fees
  2-3 s, no errors.
- Metrics page two months at a time (claude/metrics-fewer-parallel; no
  migration): it fired 72 queries at once (6 per month x 12) and timed out
  after ~18 s even after the upgrade. New lib/db/map-limit.ts (tested);
  now 5-9 s with no errors. Three at a time had a 35 s outlier.
- Receivables plan cache (claude/receivables-plan-cache; migration
  20261011110000, LIVE): receivables_page_totals and receivable_unit_totals
  use plan_cache_mode = force_generic_plan, so a connection plans their
  queries once instead of on each of its first five calls: 786 ms first
  call, then 72-78 ms (was 0.3-5.5 s for the first five).

## 2026-10-10
- Receivables page totals in one call (claude/receivables-page-totals;
  migration 20261011100000, LIVE): /charges ran six queries at once over
  RLS-heavy views and timed out. Four of them (receipt count/total,
  delinquent units, outstanding/delinquent totals, charges by category) are
  now one security-invoker PL/pgSQL function, receivables_page_totals: same
  views and filters, plans kept per connection (~80 ms warm). Identical
  results for 3 staff users x 4 filter cases. Parity baseline updated.
- receivable_unit_totals split (claude/receivables-totals-speed; migration
  20261011090000, LIVE): one SQL statement over aged_receivables,
  v_unapplied_credits and delinquent_units (900+ RLS sub-plans) took 13-25 s;
  now PL/pgSQL, one query per total, separate filtered/unfiltered queries:
  45-600 ms, identical results for every role. The Receivables page
  (/charges) still times out under load: see Status, Next gaps.
- Phone width fixes (claude/phone-width-fixes; no migration): signed-in
  check at 375 px of 11 manager pages, none scroll sideways. Fixed: Reports
  search box collapsed to 19 px (flex-1 in a column form; also Company admin
  invite email), export buttons, report chips and calendar view/filter
  controls raised to the 40 px touch target. Notes in docs/redesign/PROGRESS.md.
- Projects list spend (claude/project-spend-list; migration 20261011080000,
  live): /projects read capital_project_financials, a security_invoker view
  over payable_bills, so staff without a finance role saw $0 spent on every
  project while the project page showed the real figure. The list now calls
  capital_project_spend_totals() (security definer, totals only, never bill
  rows): same access rules and same bills as project_budget_vs_actual
  (approved or paid, not archived, in the project's own association; the old
  view did not check the association). Rolled-back test on production:
  equal to the project page for every staff role incl. scoped managers and
  the operator; nothing for board/owner/vendor/unknown; no project beyond
  capital_projects RLS; 0.3-10 ms. The view stays (unused).
- Piper web chat session id (claude/piper-secure-session-id; no migration):
  `crypto.randomUUID()` instead of `Math.random()` (CodeQL insecure
  randomness). The id rate-limits a chat and files its lead, so it should not
  be guessable.
- #272 (merged, b5dde4a7; no migration): opening balances step on the import
  page. Under the trial balance tie-out (one association), a confirm-first
  "Post opening balances" posts one entry dated the as-of date with each
  account's difference, through import_journal_entry_batch; prior years'
  retained earnings by account id to an account the tie-out pairs. Refuses:
  all associations, non-accrual (user confirms when the export does not
  say), all-time with a prior-years line, unreadable or malformed lines,
  accounts missing/hidden/shared by number, ledger-only balances, and a
  second opening entry at any date. Server recomputes under both import
  locks; posts the compared snapshot only.
- #271 (merged, 4f0f197f; no migration): trial balance tie-out counts the
  ledger's prior years' retained-earnings account (name says prior/previous
  or is exactly "Retained Earnings"; any other wording keeps its own row)
  on the file's "Calculated Prior Years Retained Earnings" line and names
  it there. Classified per account before shared numbers are added up.
  Mirsad re-ran Randolph Station: every account ties out, no flags.

## 2026-10-09
- #270 (merged, a1a0add2; migration 20261009090000 run by Mirsad in the SQL
  editor and read back by Claude): Journal entries -> Upload batch, Bills ->
  Upload and the unapplied-credits scan failed with "DELETE requires a
  WHERE clause" (pg_safeupdate). Each now clears its temp table with
  truncate; owner, definer and grants unchanged. Test fails any later
  migration with a bare DELETE.
- #269 (merged; migration 20261009080000 applied by Claude before the PR
  opened and read back): the open-balance import posts credit lines
  (prepayments) as homeowner credits via import_opening_credit (Dr the Other
  category's income account / Cr A/R; definer helper
  import_credit_income_account checks finance + association access). Recorded
  as negative imported balances, so re-imports skip them; credit-only files
  import; a credit gone from a later file reads "used up or removed".
- #268 (merged 65414f0; migration 20261009070000 applied by Claude before
  the PR opened and read back): owner login leftovers. Account page per
  association (switcher, every current unit); home lists each association's
  emergency contact; shared association files and can_access_association_mvp
  use current_resident_association_ids() (0 live policies still match
  owners by auth_user_id). Decision: a sold unit removes the old owner, so
  former owners get no association access.
- #267 (merged f06b9fb; migration 20261009060000 applied by Claude before
  merge and read back): owner login across associations, part 2. Owner
  portal reads every record of the login; each write names its record (the
  unit's record for pay/autopay/amenities/architectural/service requests,
  the survey's association, a ?record= switcher for insurance and contact
  details, a per-association submit_owner_message overload). Staff owner
  pickers follow the association (OwnerSelect) and the server refuses an
  owner of another association; the staff owner page shows "Sign-in:".
- #266 (merged ffca485; migration 20261009050000 applied by Claude before
  merge and read back): owner login across associations, part 1. A login
  reaches its first owner record plus every record whose own invitation it
  accepted (owner_portal_logins), never by email; 41 owner policies use
  current_owner_ids(), 16 write policies tied to the record's association;
  owner invitations name their record; auth email change fixed; board keeps
  board role on accepting an owner invitation. Portal pages follow in part 2.
- #265 (merged 2834717; migration 20261009040000 applied by Claude before
  merge and read back): one vendor login across a vendor's associations.
  A login reaches its first record plus every record whose own invitation it
  accepted (vendor_portal_logins), never by email match; 28 vendor policies
  use current_vendor_ids(); compliance per association with a switcher;
  staff "Turn off portal access" unbinds one record (database trigger,
  links revoked, never deleted); an email change revokes added records.
- #264 (merged; migration 20261009030000 run by Mirsad in the SQL editor,
  read back by Claude): bills CSV upload (`import_bills`) matches the vendor
  inside the row's association plus the management company; another
  association's vendor is named only to callers who can see it.
- #263 (merged dfa8f42; migration 20261009020000 applied by Claude and read
  back): a vendor record belongs to one association; the management company
  is the one company-level vendor. 14 same-association triggers + parent-row
  triggers, restrictive association scope on vendors and their private,
  compliance, financial, document, note and tag rows; every vendor picker,
  list, report, email and SMS names/scopes the association; management-company
  upload emails readable only by company-wide staff.
- #262 (merged 8f33d0c; migration 20261009011000 already live): delete tool
  stops on another association's SET NULL links; attached (type, id) records
  match only by type + id.
- #261 (merged deb3ad3; migrations 20261009005000 run by Mirsad, 20261009010000
  applied): a homeowner record belongs to one association (column, triggers,
  association-scoped managers see only their homeowners, change homeowner in
  two steps, imports match inside the association); SQL-editor-only
  delete_association_completely() and delete_unlinked_owners().
- #260 (merged; no migration): imported work-order status drops the old
  system's name ("Assigned by AppFolio" -> "Assigned").
- #259 (merged bac812b; no migration): importer renamed "Import from previous
  system" (/owners/import/previous-system, old URL redirects), sidebar entry,
  no competitor name in product text or stored records (old markers still
  recognised for dedupe), one association of a file shown at a time.

## 2026-10-08
- #258 (merged 4f5f0d4; no migration): AppFolio open balances — a changed
  amount is reported, not reposted; items gone from a complete file are
  reported; all result messages downloadable.
- #257 (merged 6d10b58; migration 20261008070000 applied, 20261008080000
  applied except claim_import_lock, which waits on Mirsad because its body
  has a DELETE): AppFolio importer — units, homeowners, chart of accounts,
  vendors, open balances, work orders, trial balance tie-out — checked on
  the real exports.
- #256 (merged 7b37b23; migration 20261008060000 applied): the SETOF uuid
  identity helpers (board/resident/tenant/vendor) run as PL/pgSQL; board
  30-table timing 5.1 s -> 1.8 s, owner 2.6 s -> 0.97 s.
- #255 (merged 9ced138; migration 20261008050000 applied): RLS helpers run
  as PL/pgSQL (nested SQL helpers re-planned per row, ~1 ms each); pages
  stop hitting the 8 s statement timeout; manager 2.9 s -> 0.7 s, board
  14.9 s -> 5.1 s for 30 tables.
- #254 (merged 5446724; migration 20261008040000 applied): speed (pdx1
  region next to the DB, me() once per request, loading screens), one-time
  tokens on ad-hoc charges, chargebacks and bulk vendor emails, records use
  their association's/vendor's company (calendar events, statements, vendor
  emails, owner notices), calendar vendor trigger, reset links to the
  company workspace, committee members must be owners, calendar reminder
  moves fail loudly, inspection work order links once.
- #253 (merged dbf551c; no migration): a company's address never serves the
  platform's marketing pages or site files (`/demo`, `/legal` redirect to
  login; disallow-all robots; sitemap, llms.txt, IndexNow key,
  report-card.html and marketing APIs 404); client-facing fallbacks use
  `NEUTRAL_COMPANY_NAME`; MFA issuer, help email, send-email From are the
  company's.
- #252 (merged 7cbc3dd; migration 20261008030000 applied): a property group
  must be the association's company's (app checks before writes; DB triggers
  on associations and on group moves, serialized with a row lock; group
  directory report counts only the company's associations).
- #251 (merged 331d709; no migration): letters, owner/resident resets and
  resident invites use the recipient's company (name, reply-to, sign-in
  address); residents, pets and vehicles take the owner's company; addPet
  checks the unit and resident (closed a cross-company pet plant).
- #250 (merged c959991; no migration): `/accept-invitation` refuses another
  company's invitation on a company's address (platform address allowed),
  names the inviting company, shows expired / other-account states (sign-in
  keeps the token), rate limits per token, plain errors.
- #249 (merged 052b402; migration 20261008020000 applied): maintenance
  "complete" runs in one transaction (`complete_maintenance_task`, SECURITY
  INVOKER) with a compare-and-set on what the page showed, so it completes
  once and never half; removed two uncalled calendar server actions.
- #248 (merged be2f13b; no migration): association profile shows the
  public violation-report link on the company's own address with a shared
  `CopyButton`; warns when the company has no workspace address.
- #247 (merged 9d7f1e8; no migration): `/sign/[token]` and
  `/vendor-upload/[token]` treat another company's token as invalid on a
  company's address and move to the company's address from the platform
  address; neutral public metadata; company pages no longer inherit the root
  author/creator/description/keywords.
- #246 (merged fbad2ae; no migration): `/report-violation`, its submit
  action and the AI photo route only list and accept the host company's
  associations (and spend only its AI key); Stripe receipts send in the
  company's name; public layout falls back to a neutral name.

## 2026-10-07
- #245 (merged e25b1d1; migration 20261007100000 applied): delinquency sync
  scoped to the caller's associations; 30 saves that RLS could silently skip
  now fail loudly; vendor ACH order; site manager scoped; error banners.
- #244 (merged f0da498; migration 20261007090000 applied): 16 finance and
  delinquency RPCs association-scoped for managers limited to some
  associations (save/archive recurring bill and delinquency RPCs were real
  gaps; the rest add an earlier refusal over existing row triggers).
- #243 (merged df91ada; migrations 20261007070000 + 20261007080000 applied):
  AI follow-up (snapshot guard admits company admins, on/off from a usable
  key); ~45 destructive buttons confirm first; company names must contain a
  visible character (app + DB check kept in sync by a test); Plaid Link no
  platform-name fallback; security sweep (owner attachment delete scoped to
  the owner's storage path, meeting-document delete, ~15 silent RLS no-ops
  fail loudly, safe `back=`, bill RPCs association-scoped).
- #242 (merged 32bd9b5): AI Assistant setup reachable for company admins;
  managers see an "ask your company admin" note instead of a bounce; AI
  on/off status. Merged before the Codex fixes — those ride the follow-up.
- #239 (merged 0e8f398; migrations applied): invitation token hardening (token format CHECK,
  server-generated tokens for API writes, `html_escape` escapes `'`); company
  name can't be blank, brand color #RRGGBB (DB checks + all three settings
  actions); Branding page validates URLs/email and fails loudly; support email
  validated in the Branding, Company Admin and Platform Operator actions.
- #241 (merged 11ad690): `/settings` team table and MFA rows meet the 40px touch
  target; every submit uses `PendingSubmit`, with confirms before Remove,
  Send reset link and Apply role.
- #240 (merged 79e91ab; migration 20261007060000 applied): `/settings` saves
  show a success banner and never keep a stale error; NBSP-safe company-name
  check.
- #238 (merged b7ec661; migration 20261007030000 applied): second brain vault + hooks; Settings staff invitation email on
  the company workspace, escaped, Runbook link; company pages never fall back
  to the platform name (`NEUTRAL_COMPANY_NAME`).
- #237 / #235: first memory file. #236: `/platform/*` → `/platform-operator`
  permanent redirects in `next.config.mjs`.
- #234: staff guides generated per company at `/manuals/*.pdf`
  (`lib/guides/content.ts`, `app/manuals/[file]/route.ts`).
- #233: generated PDF letters headed by the company.
- #232: company links use the verified custom domain (`companyUrl` in
  `lib/tenant/host.ts`; hourly `/api/tenant/verify-domains`).
- #229–#231: review agents with self-learning memory; `/portier-review`;
  `scripts/review-scope.mjs`.
