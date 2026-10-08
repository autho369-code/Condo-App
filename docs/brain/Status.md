# Status

Back to [[Home]]. Updated 2026-10-08 (after #252).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Open (next PR): moving a calendar event
  says when its reminders could not be moved (form: error after save; drag:
  a warning, the event keeps its new spot) instead of silently keeping the
  old reminder times; inspection "create work order" links only when no work
  order is linked yet (a double submit archives its duplicate and opens the
  existing one). `query-columns` test gets a 30s timeout (5s default timed
  out under load). Also: `checkLinkedRecords` now requires a vendor to be the
  association's company's (visible was not enough for platform operators);
  maintenance task add/edit/new check the vendor; maintenance calendar
  events take the association's company; migration 20261008040000 adds the
  vendor trigger to calendar_events (maintenance_tasks already
  checked by RLS `maintenance_task_links_valid`). Apply after merge.
  Also: ad-hoc unit charges and work-order chargebacks claim a one-time form
  token (`ad_hoc_charge`, `work_order_chargeback`), so a double submit posts
  once (live `form_submissions_admin_operator_insert` lets company admins and
  operators claim too).
  Security review fix: migration 20261008040000 now has its own
  `calendar_event_vendor_in_company()` that checks the vendor against the
  ASSOCIATION's company (fires on association_id too); new calendar events,
  their reminders and drafts take the association's company. Owner statement
  emails brand and link from the association's company (not the sender's).
  Bulk vendor emails (`/maintenance/communications`) go out under each
  vendor's own company and claim a one-time token (`vendor_bulk_comms`; the
  client form makes a fresh one per message) plus a per-vendor
  idempotency key on email_queue.
  Password reset asked on the platform address emails a link to the
  person's company workspace (`<slug>.<apex>`, skipped once archived).
  Committee chair/member must be a current owner in the association, and the
  bound committee id must be the association's.
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
Found 2026-10-08 by the overseer + a security-reviewer audit.
Found 2026-10-08 (overseer + security-reviewer audit, second round):
1-2. Done locally (wip-next): ad-hoc charge and chargeback form tokens.
3. Done locally (wip-next): owner statements from the association's company.
4. Done locally (wip-next): bulk vendor emails per vendor company + token.
5. Done locally (wip-next): reset links open the company's workspace.
6. Done locally (wip-next): committee members checked.
7. Closed, no change: the worker sends a stored non-platform from_address
   from the platform address only when the company hasn't verified that
   domain (sending from it would fail); the sender NAME stays the company's.
8. Optional (Mirsad decides): confirm prompts on reason-required void/cancel
   forms.
