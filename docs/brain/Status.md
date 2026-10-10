# Status

Back to [[Home]]. Updated 2026-10-10 (after #276 merged; open PR: unlink owner login; next: vendor details for Randolph Station, then Stripe pilot).

## Open PR
- claude/unlink-owner-login: "Unlink login" button on the owner record
  (Portal access): confirm-first, cuts off the record's own sign-in
  (auth_user_id cleared, portal off) and every sign-in it was added to
  (owner_portal_logins revoked), logged. Migration 20261010050000
  (unlink_owner_logins, DEFINER: staff + can_manage_association +
  operator_may_write) applied by Claude and read back; tested in a
  rolled-back transaction (manager unlinks, audit row; non-staff 42501).

## Where things stand
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
0. Randolph Station is a TEST-ONLY association (Mirsad, 2026-10-10): it
   proved the import end to end (imported and tied out); its 8 name-only
   vendors stay as they are, no contact/tax/insurance to enter. The next
   real association uses the import page incl. the opening balances step
   (CSV exports do not state the basis: tick the accrual box).
1. Stripe live for one pilot association (Mirsad's account setup).
2. Optional: per-request identity caching for speed (identity checks
   ~0.1-0.5 ms per row each; riskier, measure first).
