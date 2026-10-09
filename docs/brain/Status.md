# Status

Back to [[Home]]. Updated 2026-10-09 (after #264 merged; no open PR).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- #263 merged (dfa8f42): vendors belong to one association (management
  company is the one exception). Migration 20261009020000 applied by Claude
  and read back (2 columns + check + indexes, 14+4+3+4 triggers, all
  policies, functions; the one vendor is in Randolph Station). No open PR.
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
  AppFolio" is shown and stored as "Assigned". No open PR.
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
- In PR: one vendor login across a vendor's associations (migration
  20261009040000: vendor_portal_logins, current_vendor_ids(), 28 vendor
  policies rewritten with ALTER POLICY; staff invite per record; staff can
  turn off one record's portal access). Main stays compatible with the
  migration, so Claude applies it once Codex is clean, reads it back, then
  Mirsad merges.
- #264 merged: bills CSV upload matches the vendor inside the row's
  association (migration 20261009030000 run by Mirsad, read back: body
  matches the file apart from 3 blank lines the editor dropped; grants
  authenticated + service_role). No open PR.
- Randolph Station created by Mirsad (2026-10-09) for the first real import;
  it is the only association. Granville Courts, 7241 N. Ridge and the Pine
  Tree sample were deleted by Mirsad in the SQL editor (one DO block: user
  triggers paused, journal entries/bills/tenants/blocking rows removed,
  triggers re-enabled; verified 0 disabled triggers, 0 orphan journal
  lines). The 14 old demo owners are gone (0 owners now).
- Next gaps: (1) one vendor login across associations (Mirsad: build now);
  (2) multi-property owner portal (one sign-in, all of a person's records) and owner pickers
  that still list the whole company; (3) chart of accounts entered/changed by
  the company admin only; (4) a real end-to-end import of Randolph Station;
  (5) credit balances from the Aged Receivable file (listed, not posted).
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
-1. In PR: one vendor login across associations. Next: the multi-property
   owner portal, using the same pattern (see [[Decisions]]).
0. AppFolio importer follow-ups: credit balances (owner prepayments), and
   run the real import for one association end to end after merge. Then: Stripe live for one
   pilot association (Mirsad's account setup), Illinois rule pack.
   Remaining speed: identity checks still ~0.1-0.5 ms per row each; next
   step would be per-request identity caching (riskier, measure first).
1. `checkLinkedRecords` with no association (calendar events without one):
   a vendor/owner only has to be visible, so a platform operator could attach
   another company's. Compare against the record's company (DB trigger
   already covers calendar vendors). Low.
2. Run a third overseer + security-reviewer audit for new gaps.
3. Optional (Mirsad decides): confirm prompts on reason-required void/cancel
   forms.
