# Portier369 — TO-DO

The living to-do list. Maintained by Claude; updated as items ship.
Last updated: 2026-07-14.
(Companion to `docs/PROJECT_STATUS.md`. Onboarding steps live in
`docs/ONBOARDING_CHECKLIST.md`. Roadmap detail in `docs/appfolio-gap-analysis.md`.)

---

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
- [ ] **Replace seed data** — swap the Granville sample for the first client's real
      data (import path is built + verified: `/owners/import`).
- [x] **Write the operational manual for company admins and managers** (requested
      by Mirsad 2026-07-06; DELIVERED 2026-07-06: `docs/manuals/` —
      Manager Runbook + Company Admin Guide, .docx + .pdf).
      **UPDATE 2026-07-14: the manuals are now DELIVERED to clients** — published
      at `public/manuals/` (served at `/manuals/Portier369-Manager-Runbook.pdf`
      and `/manuals/Portier369-Company-Admin-Guide.pdf`), linked in the staff
      invite emails, and linked from the `/onboard` page. Covered:
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
- [x] **AppFolio gap audits (all 4 rounds) executed 2026-07-06/07** — ~40 items:
      owner tax/1099/payout/prefs + attachments + audit log, packet config,
      reserve/loan/fee tracking, committees + lock-box creation, portal access
      controls, meeting depth, person-level vehicles, report EXECUTION fixed
      (rail + worker — reports had never been runnable), metrics rewired (health
      view never had the fields), units/tenancy sync, TasksRail panels for all
      seven flagged sections. Remaining honest gaps deliberately deferred:
      - staff-side "submit ARC request on owner's behalf" flow — **DONE 2026-07-14** (`/architectural-reviews/new`, occupancy-pick prevents forged owner/unit pairing)
      - amenity image upload (same placeholder pattern as approvals had) — **DONE 2026-07-14** (signed-URL render, 5 MB cap)
      - maintenance SLA / inspection-compliance metrics (no data source yet) — still deferred.

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
- [ ] Review the 8 SECURITY DEFINER views + 26 "RLS enabled, no policy" tables —
      confirm each is intentional/locked, add policies where a real surface needs them.
- [x] **Fixed: pinned `search_path`** on all 20 app functions. (2026-06-22)
- [ ] (Lower-risk, deferred) review the 8 SECURITY DEFINER views — converting to
      `security_invoker` can change results, so each needs per-view testing.

## 🟢 Optional / cleanup (no rush)
- [ ] Decide fate of the orphaned `/platform-operator/overview` page vs the root
      `/platform-operator` dashboard (duplicate command-center).
- [ ] `app/platform/*` vs `app/platform-operator/*` consolidation (needs approval).
- [ ] Drop the inert `'stripe'` value from the `payment_processor` enum (cosmetic;
      requires recreating the enum + retyping columns — low value).

## 🚀 Exceed-AppFolio roadmap (future bets, optional)
Detail + rationale in `docs/appfolio-gap-analysis.md`.

- [ ] Upgrade the Portfolio Assistant to **tool-calling** (live queries) beyond the
      current data-snapshot grounding.
- [ ] **Real e-signature** for board resolutions / ARC approvals / vendor contracts
      (current board sign-off is a typed-name signature, not a vendor e-sign).
- [ ] **Operator cross-company analytics** + partner **API / webhooks** (leans into
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
