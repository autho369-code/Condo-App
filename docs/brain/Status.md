# Status

Back to [[Home]]. Updated 2026-10-08 (after #249).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Open: `/accept-invitation` (page and `acceptInvitation`) refuses an
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
1. Letters sent by a platform operator from a client's template go out under
   the operator's company name / reply-to (`app/api/letters/send/route.ts`
   ~77-79): use the template company's name and support email, or
   `fromName: null` so the queue brands it.
2. Owner/resident password reset and resident invite links + email text use
   the caller's company (`app/(app)/owners/[id]/occupancy-actions.ts` ~247,
   261, 274, 361-378, 449): read slug/name/support email for the owner's or
   tenant's portfolio.
3. `property_group_id` from the form isn't checked against the association's
   company (`lib/rpcs/entities.ts` ~424-428, `associations/new/page.tsx`
   ~116); the update has no `.select()` check. Pin like
   `lib/rpcs/property-groups.ts:57`.
4. Portier369 marketing still opens on company addresses: `/demo`, `/legal/*`
   (and `/api/demo-request`) aren't in middleware `MARKETING_PATHS`;
   `app/robots.ts` always points at portier369.com; `public/llms.txt` served
   on custom domains.
5. Platform name in client-facing fallbacks: `lib/auth/login-errors.ts:16`
   ("Contact Portier369 support" for suspended companies), `?? 'Portier369'`
   in board/vendor/portal/resident/company-admin layouts, sidebars,
   `app/invite/page.tsx` (email subject) -> `NEUTRAL_COMPANY_NAME`.
6. `rescheduleReminders` (`lib/rpcs/calendar.ts` ~260-269) ignores errors and
   0-row updates: event moves, reminders keep old times, user sees "saved".
7. Inspection "create work order" (`app/(app)/inspections/[id]/page.tsx`
   ~130-147) can create duplicate work orders on a double submit
   (unconditional link update, no `.select()`).
8. Optional (Mirsad decides): confirm prompts on reason-required void/cancel
   forms.
