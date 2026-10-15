# Portier369 — TO-DO

The living to-do list. Maintained by Claude; updated as items ship.
Last updated: 2026-10-14 (priorities added).
(Companion to `docs/PROJECT_STATUS.md`. Onboarding steps live in
`docs/ONBOARDING_CHECKLIST.md`. Roadmap detail in `docs/appfolio-gap-analysis.md`.)

---

## 📋 Mirsad's action list (2026-10-10)

Everything Claude can do alone is done; these need Mirsad (accounts, keys,
DNS or decisions). Details for the older items are further down.

**⭐ Do these first (2026-10-14, in order — each unlocks the next work for Claude)**
1. [ ] **Stripe test keys** — Vercel → condo-app → Environment Variables:
   `STRIPE_SECRET_KEY` (sk_test_…) and `STRIPE_WEBHOOK_SECRET` (whsec_…),
   then redeploy. Unlocks: Claude runs online payments + AutoPay end to end.
2. [ ] **Plaid approval** (sandbox, then production) — unlocks the live bank
   feed, so Zelle and other deposits arrive automatically and are matched to
   units (#400). Until then staff record Zelle payments by hand.
3. [ ] **Twilio business verification** (Trust Hub KYC + US 10DLC) — two-way texting.
4. [ ] **Lob billing address** — physical and certified mail.
5. [ ] **Legal sign-off** on `/legal/*` by counsel.
6. [ ] **Business decisions:** how management companies pay Portier369;
   tenant portal in or out; which pilot company to onboard first.

**Housekeeping (quick)**
- [ ] **Email opt-out: two defaults to confirm** (2026-10-13). Answered:
      every owner and tenant gets email, sender picks owners, tenants or
      both (preferred contact and electronic consent don't stop it). Built
      as recommended, say if either should change:
      1. Unsubscribing (or marking as spam) stops optional mail only: mass
         email, announcements, reminders. Sign-in links, receipts,
         statements, violation/hearing, meeting and collection notices are
         always sent. A bounced address gets nothing.
      2. Staff can't clear an owner's unsubscribe (only the owner, from the
         link); staff can clear a bounce after the address is fixed.
- [ ] **Optional cleanup (interest removed from the product, 0 rows):** interest on overdue balances is gone from the app (no settings, no daily job). To drop what is left in the database:
      `drop function public.assess_association_interest(date); drop table public.interest_assessments; alter table public.associations drop column annual_interest_rate, drop column interest_grace_days, drop column interest_post_day_of_month, drop column interest_grace_balance, drop column interest_income_gl_account_id;`
- [ ] **Optional cleanup (unused table, 0 rows):** `drop table public.payable_bill_line_items;`
      Nothing in the app or the database reads or writes it; bills post to
      their header expense account. Keep it if you want itemized bills later.
- [ ] **Optional SQL (unused function):** `drop function public.claim_email_queue(integer);`
      The email worker uses claim_email_queue_snapshot; the old one is no
      longer callable by anyone (20261015010000) and doesn't skip
      unsubscribed addresses.
- [ ] **Delete the test conversation** "Inbox test (please ignore)" in the
      Inbox (Randolph Station, Alexandra Podkanska).
- [ ] **Delete the old Resend API key** that was pasted in chat (Resend →
      API Keys), if it is not the one now set in Vercel.
- [ ] **Optional:** put the current Resend key in
      `C:\Users\autho\Portier369\.env.local` (`RESEND_API_KEY`) so local
      testing sends mail like production.
- [ ] **Remember:** a changed Vercel environment variable only takes effect
      after a production redeploy.

**Accounts and setup**
- [x] **Check the database's computer size** (DONE 2026-10-11: upgraded to Small) - Supabase dashboard ->
      project condo-app -> Reports / Database: CPU usage graph and compute
      size. On 2026-10-10 the same query swung from 0.08 s to 14 s and pages
      (Receivables) timed out; a small "burstable" size runs out of CPU
      allowance. Tell Claude what it shows; upgrading costs money, so it is
      your call.
- [ ] **Stellar's support phone** (support email set to hello@portier369.com on 2026-10-12) - Platform operator ->
      Companies -> Stellar -> Company details: Support email and Support phone (or as company admin: Settings). Owners see them on the
      portal's Emergency page (today it shows no contact).
- [ ] **Let Auth use the bigger database** - Supabase dashboard -> project
      condo-app -> Settings -> Database (or Auth) -> connection pooling for
      Auth: switch from a fixed 10 connections to a percentage. Supabase's
      advisor: after a compute upgrade a fixed number does not grow, so
      sign-ins don't benefit from the upgrade. Free, a setting only.
- [ ] **Stripe live for one pilot association** — Stripe Connect platform keys
      in Vercel (see "Set the platform Stripe keys in Vercel" below), then the
      association connects its own Stripe account.
- [ ] **Stellar's own email sender domain** — Company admin → Settings → Email
      sender: add Stellar's domain and the DNS records it shows. Until then
      Stellar's mail (Inbox replies, notices) goes out as "Stellar Property
      Management <hello@portier369.com>"; after verification it comes from
      Stellar's own address automatically (no code change).
- [ ] **Two-way SMS** — Twilio Trust Hub KYC + US 10DLC registration.
- [ ] **Physical mail** — Lob account + billing address.
- [ ] **Live bank feeds** — Plaid sandbox/production certification.
- [ ] **AI features** — set an AI key at `/settings/ai`.
- [ ] **DMARC** — move from `p=none` to `quarantine`, then `reject` (DNS).
- [ ] **Optional cleanup:** drop the view `capital_project_financials` in the
      SQL editor (`drop view public.capital_project_financials;`); unused
      since migration 20261011080000 (projects list spend).
- [ ] **Optional cleanup:** drop the switched-off policy in the SQL editor
      (`drop policy "Anyone can read templates" on public.maintenance_templates;`);
      it reads nothing since migration 20261012010000.
- [ ] **Optional cleanup:** drop the policies switched off in migration
      20261014190000 and the two unused AutoPay functions (SQL editor):
      `drop policy calendar_events_resident_read on public.calendar_events;`
      `drop policy calendar_events_tenant_read on public.calendar_events;`
      `drop policy occupancies_self_update on public.occupancies;`
      `drop function public.enroll_autopay(uuid, uuid, integer, autopay_frequency);`
      `drop function public.cancel_autopay(uuid, text);`
      (Residents read the calendar through resident_calendar_events; AutoPay
      runs through the portal's server actions.)
- [ ] **Optional cleanup:** drop the unused email helpers replaced in
      migration 20261014220000, and the old budget-line RPCs it revoked
      (SQL editor). The first was created on production during that change
      (not in any migration file) and is executable by no one:
      `drop function rls_private.email_queue_recent_count(uuid);`
      `drop function public.email_queue_sender_problem(uuid, uuid, text, text, text, text, uuid);`
      `drop function public.upsert_budget_line(uuid, uuid, uuid, integer, numeric[], text, text);`
      `drop function public.delete_budget_line(uuid);`
- [ ] **NSF fee income account setting (Codex on #339):** companies whose NSF
      income account is not named like "NSF fee" post NSF fees to default
      income, because the GL map can't store an `nsf_fee_income` key. Run in
      the SQL editor, then tell Claude to wire the setting:
      `alter table public.gl_account_map drop constraint gl_account_map_map_key_check;`
      `alter table public.gl_account_map add constraint gl_account_map_map_key_check check (map_key = any (array['accounts_receivable','accounts_payable','late_fee_income','default_income','assessment_income','undeposited_funds','nsf_fee_income']));`
- [ ] **Optional cleanup:** drop the index `charges_unit_idx` in the SQL
      editor (`drop index public.charges_unit_idx;`); the new
      `charges_unit_due_idx (unit_id, due_date)` from migration 20261013050000
      covers it.
- [ ] **CLAUDE.md rule 6 (your file):** add `to authenticated` to the preferred
      policy form; a policy with no TO clause applies to signed-out callers
      too (20261012010000; the migration check now fails one).

**Decisions**
- [ ] **Legal sign-off** on `/legal/*` by counsel.
- [ ] **Platform remittance** — how management companies pay Portier369.
- [ ] **Tenant portal** — in or out of scope.
- [ ] **Pilot company** — onboard one real management company for a full
      month on real data.

---

## 🔨 Claude build queue (recorded 2026-10-05)
The code gaps left, in build order. No placeholders, no missing routes, and the
nightly jobs and data checks are healthy; everything else on this page needs
access, accounts, approval or decisions.

1. [ ] **Resale / estoppel certificate** — the document an HOA issues when a unit
       sells (balance, dues, special assessments, violations, pending charges).
       Earlier scoped to MD §11-135 and **declined by Mirsad** (see
       `docs/appfolio-gap-analysis.md`); the **Homeowner Resale** report already
       gives the per-unit data. Build only if Mirsad asks.
2. [x] **Assistant tool-calling** — DONE 2026-10-05: the Portfolio Assistant can
       call six fixed, read-only, RLS-scoped lookups (owner, unit, delinquent
       units, open work orders, open violations, bills) on top of the snapshot.
3. [x] **Real e-signature** — already built (found 2026-10-06): `/signatures`
       sends private signing links (typed name + consent), records every step
       in `signature_events` with a SHA-256 document fingerprint, supports
       sequential signers, and issues a certificate. Board resolutions, vendor
       agreements, ARC decisions, management agreements and year-end packages
       are all signable subjects.
4. [x] **Operator cross-company analytics + partner API/webhooks** — the partner
       API (`/api/v1`, API keys, scopes, rate limits), signed outbound webhooks
       and the Developer Hub already existed; 2026-10-06 added
       `/platform-operator/usage-trends` (monthly per-company usage from
       `usage_metrics`, which was collected nightly but never shown).
       2026-10-06 also added per-key daily API call counts
       (`api_key_usage_daily`, shown in the Developer Hub and summed into
       `usage_metrics.api_calls`) and a webhook "Send test event" button
       (`send_test_webhook`, signed `ping` delivery). Possible follow-up: write
       endpoints in the partner API (needs a decision on which records partners
       may change).

Cleanup needing Mirsad's approval:
- [x] Fold the legacy `app/platform/*` redirect shim into `app/platform-operator/*`.
      DONE 2026-10-07: the catch-all page is gone; `/platform` and `/platform/*`
      are permanent redirects in `next.config.mjs`.
- [x] ~~Drop the unused `'stripe'` value from the `payment_processor` enum~~
      WITHDRAWN 2026-10-07 — the value is NOT unused: Stripe Connect (added back
      2026-07-06) saves owner payment methods with `processor: 'stripe'`
      (`app/api/stripe/webhook/route.ts`), and `select_payment_processor()`
      falls back to it. Dropping it would break online payments. Do not do this.

Sample-data housekeeping (not code):
- [x] 5 sample bank accounts show "not reconciled in over 60 days" on the
      month-end close page — gone with the Granville sample (deleted by Mirsad
      2026-10-09).

## 🗂 Future work (recorded 2026-10-04)
Everything left after the AppFolio left-navigation parity pass (#138–#182).
Every AppFolio page is built; these need access, accounts or decisions first.

### Needs access for Claude (highest value next)
- [x] **Test login + Supabase network access for the cloud container.** Done
      from the desktop session (signed-in local runs against production). Add a
      staff test account and allow `termxngysvotnfbzbgrv.supabase.co` in the
      environment's network settings (or supply a `.env.local`). Unblocks:
  - [x] Browser walkthroughs of every workflow on the Vercel preview (manager,
        board, owner, vendor, company admin, platform operator). DONE
        2026-10-11/12: all six roles at 375 px, 54 detail and 141 list pages
        crawled with data, ledger flows run in rolled-back transactions.
        Left: Stripe/Plaid flows (dormant until the keys are set).
  - [x] `npm run check:queries` against production. DONE 2026-10-10: 0 broken
        of 1,164 distinct static queries (the script now runs from
        environment variables when there is no `.env.local`). Note: it is a schema probe
        only (literal `.from().select()` strings, anonymous, `limit=0`); it
        skips template selects and RPCs, so it does not replace the signed-in
        walkthroughs above.
  - [x] End-to-end Excel report download. DONE 2026-10-10 as a manager:
        Owner Directory, portfolio scope, Excel -> run succeeded, file is a
        valid .xlsx (spreadsheetml type, 1 sheet, 21 rows: title lines,
        headers, 17 owners). A refused run now returns to the same report
        with the reason above the form (was: the Reports list).
  - [x] End-to-end checks of the 2026-10-04 work. DONE 2026-10-10 on
        production data (local server on main):
        - Batch letters: Randolph Station -> "Print 17 letters", one per
          homeowner; clear warnings for empty merge fields and the 17
          homeowners with no mailing address. Nothing printed or saved.
        - Forms: manager uploaded a test PDF (browser -> storage), saved as a
          Homeowners form; signed in as owner2 the portal's Download link
          (signed, time-limited) returned the same PDF. Then archived (the
          app archives; the record and file stay).
        - Saved replies: created an email template; stored in the company
          with channel email, which is what the Inbox reply box loads. Then
          deleted. Not seen inside a conversation: production has none.
        - Inbox search: loads without errors; nothing to find (0 threads).
  - [x] Inbox with a real conversation. DONE 2026-10-10: manager started
        "Inbox test (please ignore)" to owner2's homeowner record (email set
        to hello@portier369.com for the test, then back to blank). Search finds
        it by subject and by name, nothing for a non-match; "Insert a saved
        reply" fills the owner's name into the reply box. The email first
        FAILED: production RESEND_API_KEY in Vercel was rejected by Resend
        ("API key is invalid"); no queued email had sent since 2026-07-05.
        Mirsad set a new key in Vercel and redeployed; the email then sent
        (Resend message id recorded).

### Known issue to fix
- [x] **Forms upload size on Vercel.** FIXED 2026-10-04: the file now goes
      browser→storage through a signed upload URL (`FormFileInput` +
      `createFormFileUpload`); `saveFormTemplate` checks the stored object's
      path, type and size before linking it. Limit raised to 25 MB (bucket max).

### Audit follow-ups (2026-10-04, need a design change)
- [x] **Staff-only notes are readable through the API.** (Done in #191: owner_private plus 12 more `*_private` tables; work-order notes were already in work_order_private.) Board members can
      read `owners.notes` (management's notes about owners); owners can read
      `work_orders.internal_notes`, `vendor_instructions` and
      `withheld_amount_from_owner` for their units. Pages don't show them, but
      the row-level policies return whole rows. Fix: move those columns into
      staff-only tables (or staff-only views/RPCs) and revoke the columns from
      `authenticated`, then point the staff pages at the new source.
- [x] **Owner timeline shows returned (NSF) payments as normal payments** —
      `receivable_payments_ledger` now carries `reversed_at`/`reversal_reason`.
      The owner portal timeline, the owner record, /receipts and the
      receivables receipts tab label returned payments and leave them out of
      the received/YTD totals.

### Needs provider accounts from Mirsad
- [ ] **Two-way SMS:** Twilio account + US 10DLC registration (Inbox texting).
- [ ] **Physical mail:** Lob account (certified mail, letters).
- [ ] **Online payments:** Stripe Connect platform keys in Vercel
      (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) + live test cases.
- [ ] **Live bank feeds:** Plaid sandbox/production certification.

### Needs owner decisions
- [ ] **Tenant portal:** in or out of scope (tenants are data-only today).
- [ ] **Platform remittance:** how management companies pay Portier369.
- [ ] **Legal sign-off** on `/legal/*` by counsel.
- [ ] **Pilot client** to run a full month on real data.

### Out of scope by choice (revisit only if asked)
- New native-only features and app-store publishing (the Capacitor iOS/Android
  shell in `mobile/` is built and loads the live site) · integration marketplace.

## 🔴 Launch gates — must close before the first paying client
Mostly on Mirsad / external; not code.

- [ ] **Legal sign-off** — have counsel review `/legal/*` (privacy, terms, security).
      They're drafted with Portier369, Inc. (Illinois, Cook County) facts filled.
- [ ] **Platform remittance decision** — decide how management companies pay
      Portier369 (ACH / mailing address / Bill.com link). Then bake it into the
      invoice email (`sendInvoice` in `app/platform-operator/companies/actions.ts`)
      and the company Billing page. Today it says "contact us."
- [ ] **Run a pilot** — onboard one real management company; run a full month of
      real dues, work orders, and a board cycle. Use `docs/ONBOARDING_CHECKLIST.md`.
- [x] **Replace seed data** — the Granville sample was replaced with Randolph
      Station, Mirsad's first real association (2026-10-09). Granville Courts,
      7241 N. Ridge and Pine Tree were deleted. Import path: `/owners/import`.
- [x] **Write the operational manual for company admins and managers** (requested
      by Mirsad 2026-07-06; DELIVERED 2026-07-06: `docs/manuals/` —
      Manager Runbook + Company Admin Guide, .docx + .pdf).
      **UPDATE 2026-07-14: the manuals are now DELIVERED to clients** — published
      at `public/manuals/` (served at `/manuals/Portier369-Manager-Runbook.pdf`
      and `/manuals/Portier369-Company-Admin-Guide.pdf`), linked in the staff
      invite emails, and linked from the `/onboard` page.
      **UPDATE 2026-10-07: rebranded per company** (Mirsad) — the guides are
      generated per company from `lib/guides/content.ts` by `app/manuals/[file]/route.ts`
      at `/manuals/manager-runbook.pdf` and `/manuals/company-admin-guide.pdf`
      (company name + its Portier369 sign-in address; footer "Powered by Portier369").
      The old `Portier369-*.pdf` links redirect. Covered:
      - Assign a **site manager on every association** — that field drives where
        owner-portal "Send a message" emails land (fallback: company admins, then
        portfolio support email). Manager replies from their own inbox (reply-to
        is the owner) — there is no in-app inbox to monitor.
      - Set portfolio **support email/phone** (feeds the owner dashboard contact
        card and is the messaging safety net).
      - Inviting users (the invitation chain), resetting passwords per role.
      - Work-order lifecycle, violation workflow, ARC review flow.
      - Payments: association Stripe Connect onboarding (Payments tab), AutoPay,
        and the payment-instructions text owners see on "How to Pay."
      - Where owner messages / announcements are logged (communications log).

- [ ] **Set the platform Stripe keys in Vercel** (`STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET` + the Connect webhook endpoint) — the entire
      online-payments system is built and dormant behind this one config step.
      Flagged by every external audit round as the last env gap.
      When creating the Connect webhook endpoint, include
      `checkout.session.expired` in its events (added 2026-10-13: closes
      unfinished checkouts and AutoPay setups).
- [x] **AppFolio gap audits (all 4 rounds) executed 2026-07-06/07** — ~40 items:
      owner tax/1099/payout/prefs + attachments + audit log, packet config,
      reserve/loan/fee tracking, committees + lock-box creation, portal access
      controls, meeting depth, person-level vehicles, report EXECUTION fixed
      (rail + worker — reports had never been runnable), metrics rewired (health
      view never had the fields), units/tenancy sync, TasksRail panels for all
      seven flagged sections. Remaining honest gaps deliberately deferred:
      - staff-side "submit ARC request on owner's behalf" flow — **DONE 2026-07-14** (`/architectural-reviews/new`, occupancy-pick prevents forged owner/unit pairing)
      - amenity image upload (same placeholder pattern as approvals had) — **DONE 2026-07-14** (signed-URL render, 5 MB cap)
      - maintenance SLA metrics — **DONE 2026-10-04** (`/reports/maintenance_response_times`: first-reply on-time rate, median reply/resolve/complete times, open work-order aging; CSV/Excel/PDF export). Inspection compliance — **DONE 2026-10-04** (`/reports/inspection_compliance`: on-time completion rate, overdue inspections, open findings by severity, median days to resolve a finding; CSV/Excel/PDF export).

- [x] **File uploads actually work with large files (2026-07-14, PM).** Both the
      architectural-documents and insurance-certificate uploaders originally posted
      files through server actions, which Vercel caps at ~4.5 MB — real plan PDFs
      failed. Rebuilt browser→Supabase Storage via signed upload URLs
      (`createSignedUploadUrl` server actions + client uploader components):
      ARC documents multi-select 4+ (max 10/request, 25 MB each, sequential);
      insurance certificate 25 MB. Bucket now accepts WebP/HEIC (iPhone photos
      were rejected). Verified against live storage with an 8 MB PDF + HEIC.
      Also fixed same-day: missing `calendar_events.vendor_id` FK (events were
      invisible everywhere), calendar timezone (UTC→association timezone,
      default America/Chicago), board/owner calendar parity (one shared feed),
      owner+board single login (dual-role RLS), board-member marking UI on the
      owner page.

## 🟡 Should-do soon (non-blocking, smaller)
- [ ] **Set an AI key** at `/settings/ai` to switch on the AI features (violation
      letters, comms copilot, `/assistant`). Without it they show a "configure AI" link.
- [ ] **SMS gateway** — wire Twilio (+ US 10DLC registration) when a pilot needs
      texting. Today SMS records messages but doesn't send. Email already delivers.
- [ ] **Tighten DMARC** — currently `p=none` (monitor). Move to `quarantine` then
      `reject` once you've confirmed legit mail passes.

## 🛡️ Security hardening (from Supabase advisor scan 2026-06-22)
Mostly pre-existing + by-design (this app's RLS helpers/RPCs are SECURITY DEFINER),
but a few worth addressing before scale:
- [x] **Fixed "Exposed Auth Users"** — `v_manager_workload` no longer joins
      `auth.users` (uses `profiles.last_login_at`). (2026-06-22)
- [x] **CRITICAL fixed: `platform_operators`** privilege escalation — was
      `ALL/public/USING(true)` (anyone could self-insert as an operator). Now
      operator-only. (2026-06-22)
- [x] **CRITICAL fixed: `portfolios`** public SELECT exposed every column
      (incl. `ai_api_key`) to anon. Locked to staff/operator; branding now via a
      SECURITY DEFINER `tenant_branding()` function (safe columns only). (2026-06-22)
- [x] **Fixed: unused lead/marketplace tables** — `leads`/`lead_messages`/`bookings`
      + `providers`/`services`/`provider_*` had public read/update (lead PII). They're
      unused + empty (demo form only emails via Resend), so dropped all public
      policies (RLS deny-all). (2026-06-22) Remaining benign always-true policies are
      reference/by-design: `house_rules`, `feature_entitlements`, `user_roles`,
      `maintenance_templates`, `portfolios` branding (now via SECDEF fn), audit/marketing INSERTs.
- [x] **Security audit of all 257 SECURITY DEFINER RPCs (2026-10-04).** No
      cross-company read/write or role escalation found. Fixed (migration
      `20261004130000_association_scope_hardening`, applied): association-scoped
      managers could write outside their associations (charges, recurring
      charges, dues increase, owner statements, board-approval settings, notes,
      tags, signatures, year-end, lockbox payments) → row-level scope trigger on
      11 tables; `me()` no longer returns the full company row (tax id, security
      policy) to owners/tenants/board/vendors; six fee/processor lookups revoked
      from signed-in users. The 38 "RLS enabled, no policy" tables are
      intentional deny-all (the four the app uses are read with the service key).
      Accepted LOW: `document_portfolio_id`, `*_links_valid`,
      `association_local_date`, `association_fiscal_year_of` reveal trivial
      facts by id but are needed by RLS policies/views.
- [x] **Fixed: pinned `search_path`** on all 20 app functions. (2026-06-22)
- [x] SECURITY DEFINER views — verified 2026-10-04: every public view now runs
      with `security_invoker`, so none bypasses RLS.

## 🟢 Optional / cleanup (no rush)
- [x] Orphaned `/platform-operator/overview` command center — linked from the
      operator sidebar and the root dashboard's Quick Navigation (2026-10-05).
- [x] `app/platform/*` vs `app/platform-operator/*` consolidation (done 2026-10-07).
- [x] ~~Drop the inert `'stripe'` value from the `payment_processor` enum~~ —
      withdrawn 2026-10-07: the value is live (see the cleanup note above).

## 🚀 Exceed-AppFolio roadmap (future bets, optional)
Detail + rationale in `docs/appfolio-gap-analysis.md`.

- [x] Upgrade the Portfolio Assistant to **tool-calling** (live queries) beyond the
      current data-snapshot grounding. (2026-10-05)
- [x] **Real e-signature** (built — see build queue item 3) for board resolutions / ARC approvals / vendor contracts
      (current board sign-off is a typed-name signature, not a vendor e-sign).
- [x] **Operator cross-company analytics** + partner **API / webhooks** (built — see build queue item 4) (leans into
      the multi-tenant cockpit).
- [ ] *(Deliberately NOT pursuing — by design):* third-party integration
      marketplace. *(Formerly on this list but since BUILT: online owner payments
      (Stripe Connect, 2026-07-06) and native mobile apps (Capacitor iOS/Android
      in `mobile/`, 2026-07-06).)*

---

## ✅ Recently completed (this work cycle)
- [x] **2026-07-14 batch (all committed + pushed):**
      - Insurance: policy document upload + policy period dates + automated
        30/15-day expiry email reminders to owner **and** manager, white-labeled
        as the management company.
      - Architectural requests: owners can upload supporting documents
        one at a time, up to 10 per request.
      - Association operating/governing documents: new documents tab on the
        association detail page + required onboarding step so every new client
        gets their governing docs loaded.
      - White-label email fixes: all outbound mail now sends as the management
        company (not Portier369) — includes fixing the dead maintenance-reminder
        cron and the maintenance-comms `company_name` bug.
      - Operating manuals published to clients at `/manuals/*`
        (`public/manuals/`), linked in invite emails and on `/onboard`.
      - Owner portal nav: Account Ledger entry + prominent Pay Assessments CTA.
- [x] **2026-07-12:** full ship-readiness security re-review — 46 unguarded
      server actions given in-action guards, API auth + scope checks, no secrets
      in URLs, preview-mode kill-switch, secured cron worker endpoints
      (timing-safe auth), build fixes.
- [x] Full-site audit + ~30 bug fixes across all six roles
- [x] Stripe fully removed (code, deps, DB tables/columns, types)
- [x] Operator billing: generate / **send** / mark-paid / void invoices
- [x] Login: Operator + Company Admin sign-in entry points
- [x] Single platform operator (`hello@portier369.com`)
- [x] Owner portal completed: real documents, meeting minutes, file-a-violation,
      working email-to-manager
- [x] Owner "mark as board member" on the New Owner form (+ board-role fix)
- [x] Legal pages drafted + corporate facts filled + draft disclaimers removed
- [x] **Exceed-AppFolio:** AI violation letters, communications copilot,
      board approval queue + digital sign-off, amenity reservations,
      user-defined report builder, conversational Portfolio Assistant
- [x] **CSV import** (owners/units + opening balances) — built + verified e2e
- [x] Email deliverability verified (SPF/DKIM/DMARC present)
- [x] Fixed `has_entitlement` tier-name regression that broke charge creation
- [x] Onboarding checklist (`docs/ONBOARDING_CHECKLIST.md`)
