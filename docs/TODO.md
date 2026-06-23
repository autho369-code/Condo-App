# Portier369 — TO-DO

The living to-do list. Maintained by Claude; updated as items ship.
Last updated: 2026-06-22.
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
- [ ] (Minor) set a fixed `search_path` on the ~20 flagged functions.

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
- [ ] *(Deliberately NOT pursuing — by design):* online owner payments at scale,
      native mobile apps, third-party integration marketplace.

---

## ✅ Recently completed (this work cycle)
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
