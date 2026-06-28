# Portier369 vs AppFolio — Feature Gap Analysis & Exceed Roadmap

> Compiled 2026-06-21. AppFolio data is from public marketing/help/review pages (cited inline).
> Portier369 "what we have" is verified from the live system this session (treat as ground truth).
> Scope focus: **community-association / HOA** management, since that is Portier369's market.
> Business context (confirmed 2026-06-27): the operator manages **Maryland condominium
> associations only — no rental/real-estate management**. Rental/leasing/screening and
> owner *distributions* (rent collected → paid out to owners) are firm non-goals, not
> just "rental side." Maryland statutory items (e.g. §11-135 resale certificate) apply.

> **Changelog — 2026-06-27 session** (live AppFolio walk-through + builds; supersedes stale rows below):
> - **Architectural reviews: now genuinely HAVE+.** Was a violations-table text-match hack; rebuilt as a
>   real `architectural_requests` + `architectural_request_messages` workflow — owner portal submission,
>   manager review queue (approve/deny/more-info), board review, and **threaded in-app messaging**. Deployed.
> - **In-app messaging: PARTIAL → HAVE (for ARC).** Threaded owner↔manager↔board messaging now ships on
>   architectural requests. General owner↔manager messaging outside ARC is still email-based.
> - **Amenity reservations: the "MISSING" row below is WRONG → HAVE.** `amenity_reservations` table +
>   request→approve workflow, manager/board/owner pages all exist.
> - **Inventory + Metrics:** already built; were just missing from the sidebar nav — now surfaced (deployed).
> - **Reporting:** verified ~119 active `report_definitions` vs AppFolio's ~90 — full parity-plus.
> - Resale/estoppel certificate (the one real reporting gap) was scoped to MD §11-135 but the user
>   **declined to build it** for now.

---

## 0. Executive summary

Portier369 already matches AppFolio on the **back-office substance** of HOA management
(true double-entry accounting, GL, budgets, reconciliation via Plaid, six role portals,
violations, architectural review, work orders, board/owner portals) and **exceeds it**
on a handful of architectural choices (multi-tenant operator cockpit with self-serve
billing, bring-your-own-key AI, transparent open data model).

AppFolio still clearly leads on three things we **intentionally skip or have not built**:
1. **Resident online payments at scale** (eCheck/card/Apple Pay/retail-cash via barcoded slips) — we are offline-remittance by design.
2. **Native iOS/Android mobile apps** — we are responsive web only.
3. **A mature integration marketplace (AppFolio Stack, ~40+ partners) + a polished generative-AI product (Realm-X: Assistant, Messages, Flows, Leasing/Maintenance Performers).**

Our highest-leverage path to *exceed* AppFolio is **not** to chase payments/mobile/marketplace parity.
It is to weaponize the two things our architecture makes cheap: **AI (BYO-key, no per-seat AI tax)**
and **operator/board/owner UX depth**.

---

## 1. AppFolio feature catalog (with sources)

### 1.1 Accounting & financials
- Full double-entry accounting, GL, income/expense tracking, P&L, rent rolls, balance sheets. ([appfolio.com/markets/hoa/financials](https://www.appfolio.com/markets/hoa/financials), [research.com review](https://research.com/software/reviews/appfolio-property-manager))
- Budgeting & forecasting built in; budget-vs-actuals. ([accounting comparison 2026](https://www.appfolio.com/blog/accounting-property-management-software-comparison-2026))
- Automated dues/rent calc, automatic late-fee assessment. ([HOA mgmt](https://www.appfolio.com/markets/hoa/management))
- Owner/association statements generated instantly + shared via portal.
- Bank reconciliation, AP/invoice processing (now **AI-assisted invoice processing**). ([community-associations](https://www.appfolio.com/community-associations))
- Reserve study support; assessment reports; customized financial reports.
- Report Builder — combine/customize reports, drill-down, real-time. ([report customization](https://www.appfolio.com/blog/tips-and-tricks-for-customizing-your-appfolio-reports))

### 1.2 Payments
- Resident online payments: **eCheck/ACH, debit, credit card, Apple Pay, and retail cash via barcoded slips**, with autopay. ([homeowners portal](https://www.appfolio.com/hoa/community-association-homeowners))
- 2024 pricing: $1/unit/mo portfolio-wide OR pass a $2.49/ACH transaction fee to residents. ([costbench pricing](https://costbench.com/software/property-management/appfolio/hidden-costs/))
- FolioGuard insurance services (renters/liability) purchasable in-portal; tracked automatically. ([insurance Q&A](https://www.justanswer.com/accounting-software/u4ki5-appfolio-insurance-services-tenants-benefits.html))

### 1.3 Leasing & screening (rental side; mostly N/A for HOA)
- Mobile-optimized rental applications, integrated resident screening (Experian credit + RentBureau rental history + criminal/landlord-tenant court records). ([Findigs breakdown](https://www.findigs.com/compare/appfolio-tenant-screening), [haseeblegal](https://haseeblegal.com/appfolio-background-checks-everything-you-need-to-know/))
- E-signature lease execution; guest-card/lead tracking; AI leasing assistant (qualify leads, schedule tours, follow-ups). ([leasing 2026](https://www.appfolio.com/blog/best-property-management-software-for-leasing-2026/))

### 1.4 Maintenance & vendor management
- Resident common-area maintenance requests from web/mobile; triage and assign to vendors; auto-update homeowner. ([HOA managers](https://www.appfolio.com/hoa/community-association-managers))
- Work-order tracking, status across portfolio, mobile maintenance.
- **Realm-X Maintenance Performer** — image-based diagnostics on maintenance requests. ([AI agents](https://www.appfolio.com/newsroom/appfolio-ai-agents))

### 1.5 Communications
- Modern comms: text (SMS) + email to homeowners/board, around the clock. ([HOA management](https://www.appfolio.com/markets/hoa/management))
- In-app messaging; association calendar / events; surveys for feedback.
- Automated mailing service (physical mail). ([community-associations](https://www.appfolio.com/community-associations))
- **Realm-X Messages** — AI-reimagined inbox that sorts resident comms + drafts personalized replies. ([Realm-X](https://www.appfolio.com/ai))

### 1.6 AI (Realm-X)
- **Realm-X Assistant** — conversational co-pilot: pull reports/insights, bulk actions, draft emails/texts. ([Realm-X](https://www.appfolio.com/ai))
- **Realm-X Messages** — AI inbox triage + responses.
- **Realm-X Flows** — teachable workflow automation engine (applications, rent collection, renewals). ([Flows](https://www.appfolio.com/articles/realm-x-flows))
- **Realm-X Performers (agents)** — Leasing Performer + Maintenance Performer. Claims: ~10 hrs/week saved, +73% lead-to-showing. ([AI agents](https://www.appfolio.com/newsroom/appfolio-ai-agents))

### 1.7 Reporting
- Real-time customizable reports, Report Builder, owner-facing dashboards with field-level visibility control. ([owner experience](https://www.appfolio.com/property-management-owner-experience))

### 1.8 Mobile
- Native iOS + Android apps for managers; field violation submission with photos/notes + community map; owner/board/homeowner portal apps. ([HOA managers](https://www.appfolio.com/hoa/community-association-managers))

### 1.9 Integrations / marketplace
- **AppFolio Stack** marketplace — ~40+ certified partners (ButterflyMX, Conservice, HappyCo, Knock, Lowe's, Property Meld, etc.), software + accounting/consulting services. ([Stack](https://www.appfolio.com/stack), [Stack launch](https://www.appfolio.com/newsroom/appfolio-launches-appfolio-stack-marketplace)) Partner/API program for new integrations. ([become a partner](https://www.appfolio.com/stack/become-a-partner))

### 1.10 Community-association-specific
- Violations (incl. **mobile field violation submission with photos + map**), online architectural reviews/requests, amenity reservations, association calendar, board approvals (invoices, bids, general items, **check signing**), document access (CC&Rs, minutes), **HOA website builder**, automated mailing. ([board members](https://www.appfolio.com/hoa/community-association-board-members), [homeowners](https://www.appfolio.com/hoa/community-association-homeowners))

### 1.11 Pricing (context)
- Core $1.40/unit/mo ($280 min), Plus $3 ($900 min), Max $5 ($1,500 min), Enterprise negotiated ($7,500+/mo). Small portfolios pay the minimum → effective rate much higher. ([appfoliopricing](https://appfoliopricing.com/), [costbench](https://costbench.com/software/property-management/appfolio/))

---

## 2. GAP TABLE (AppFolio capability → Portier369 status)

Legend: **HAVE** · **PARTIAL** · **MISSING** · **SKIP** (intentional non-goal)

### Accounting & financials
| AppFolio capability | Status | Note |
|---|---|---|
| Double-entry GL, journal | **HAVE** | `journal_entries`/`journal_lines`, trigger-enforced balance, closed-period guard, 294 GL accounts |
| Income/expense, P&L, balance sheet | **HAVE** | Reports module |
| Budgeting + budget-vs-actuals | **HAVE** | Budgets module |
| Automated dues + late fees | **PARTIAL** | Charges + categories + recurring; confirm automatic late-fee assessment rule engine |
| Owner/association statements | **HAVE** | Statements module |
| Bank reconciliation | **HAVE** | Plaid read-only sync + auto-match + manual recon |
| AP / vendor bills | **HAVE** | Owner-payable + vendor bills |
| AI-assisted invoice processing | **PARTIAL** | Have insurance-cert image extraction; invoice OCR→bill is roadmapped, not built |
| Reserve study support | **MISSING** | No reserve-study/funding-plan module |
| Report Builder (custom, drill-down) | **PARTIAL** | Fixed reports + scheduled reports + metrics; no user-defined report builder |
| 1099s / fixed assets | **HAVE** | 1099s + fixed assets modules (AppFolio parity-plus) |

### Payments
| AppFolio capability | Status | Note |
|---|---|---|
| Resident online payments (ACH/card/ApplePay/retail-cash) | **SKIP** | Offline remittance by design ("How to Pay"); Stripe removed deliberately |
| Autopay | **PARTIAL** | Autopay *records* tracked; no live charge execution |
| FolioGuard-style in-portal insurance purchase | **SKIP/MISSING** | We track insurance + cert extraction; no embedded insurance marketplace |

### Leasing & screening (rental — mostly out of HOA scope)
| AppFolio capability | Status | Note |
|---|---|---|
| Rental applications + tenant screening | **SKIP** | HOA product; tenants are data-only, no login, no leasing funnel |
| E-signature | **MISSING** | No e-sign for ARC approvals / board docs / contracts (gap even for HOA) |
| Lead/guest-card + AI leasing assistant | **SKIP** | Not an HOA need |

### Maintenance & vendor
| AppFolio capability | Status | Note |
|---|---|---|
| Resident maintenance/service requests | **HAVE** | Owner portal service requests + manager work orders |
| Work-order tracking + vendor assignment | **HAVE** | Work orders, recurring WOs, inspections, PO, vendor portal w/ status updates |
| Triage + auto-notify homeowner | **PARTIAL** | Have WO + comms; confirm automatic status-change notifications to owner |
| AI image-based maintenance diagnostics | **MISSING** | We have the AI plumbing (BYO-key + image extraction) but not this feature |

### Communications
| AppFolio capability | Status | Note |
|---|---|---|
| Email to owners/board | **HAVE** | Resend queue + cron, announcements, send-email, communication center |
| SMS/text | **PARTIAL** | SMS records only; no live gateway (Twilio etc.) |
| In-app messaging | **HAVE (ARC) / PARTIAL (general)** | Threaded owner↔manager↔board messaging shipped on architectural requests (2026-06-27); general owner↔manager outside ARC still email |
| Association calendar/events | **HAVE** | Calendar in manager + owner + board |
| Surveys | **HAVE** | Surveys module |
| Automated physical mailing | **MISSING** | No print-and-mail integration (Lob/PostGrid) |

### AI
| AppFolio capability | Status | Note |
|---|---|---|
| Conversational assistant (reports/bulk/draft) | **MISSING** | BYO-key infra exists; no Assistant UX yet |
| AI inbox triage + reply drafting | **MISSING** | Roadmapped (comms copilot) |
| Teachable workflow automation (Flows) | **MISSING** | No flow engine |
| AI agents (leasing/maintenance performers) | **MISSING** | N/A leasing; maintenance agent buildable on our infra |
| Document/image extraction | **HAVE** | Insurance-cert extraction live (we ship AI today, AppFolio gates it behind Max) |

### Reporting
| AppFolio capability | Status | Note |
|---|---|---|
| Real-time reports | **HAVE** | Reports + metrics |
| Scheduled reports | **HAVE** | Scheduled reports (AppFolio parity-plus in some respects) |
| User-defined report builder + drill-down | **PARTIAL** | Fixed report set; no ad-hoc builder |
| Owner dashboards w/ field-level visibility | **PARTIAL** | Owner portal dashboards exist; granular field-visibility control unconfirmed |

### Mobile
| AppFolio capability | Status | Note |
|---|---|---|
| Native iOS/Android apps | **MISSING** | Responsive web only (mobile-first design system) |
| Field violation submission w/ photo + map | **PARTIAL** | Violations + file-a-violation exist; no GPS/map field-capture flow |

### Integrations / marketplace
| AppFolio capability | Status | Note |
|---|---|---|
| Integration marketplace (~40+ partners) | **MISSING** | No marketplace; Plaid + Resend are our only integrations |
| Public partner API | **MISSING** | No documented external API |

### Community-association-specific
| AppFolio capability | Status | Note |
|---|---|---|
| Violations | **HAVE** | Violations, compliance, hearings, file-a-violation |
| Architectural reviews | **HAVE+** | Real `architectural_requests` workflow (2026-06-27): owner submission, manager queue w/ approve/deny/more-info, board review, threaded in-app messaging. Replaced the prior violations-table text-match hack. |
| Amenity reservations | **HAVE** | `amenity_reservations` table + request→approve workflow; manager (`/amenities`), owner (`/portal/amenities`), per-association pages all exist |
| Board approvals (invoices, bids, items, check-signing) | **PARTIAL** | Board financials/projects/ARC; no formal approval-queue / digital check-signing |
| Document access (CC&Rs, minutes) | **HAVE** | Governing docs, meeting minutes, documents |
| HOA website builder (public site) | **PARTIAL/SKIP** | Per-company subdomain only; per-association public sites = paid add-on later |
| Reserve study | **MISSING** | (see accounting) |
| Lock-boxes / parking / inventory / inspections | **HAVE** | We exceed AppFolio's published CA module here |

---

## 3. Where Portier369 ALREADY EXCEEDS AppFolio

1. **True multi-tenant operator cockpit with self-serve billing.** Create/suspend/archive/transfer
   companies, plan tiers, generate+email+mark-paid invoices, set passwords, audit logs, revenue,
   door-usage, support. AppFolio is a closed SaaS — there is no equivalent "platform operator"
   layer for a reseller/MSP to run multiple management companies. This is a genuine structural edge.
2. **Bring-your-own-key AI with no per-seat AI tax.** AppFolio gates Realm-X behind higher tiers and
   bundles its own model cost into pricing. We let each company plug in OpenAI/Anthropic/DeepSeek/custom,
   so AI cost is theirs and unbounded by our pricing — and we already ship live AI (insurance-cert
   extraction) without charging an AI premium.
3. **Modern unified design system across all six roles.** One coherent Vercel/Linear-grade UI for
   operator, company-admin, manager, board, owner, vendor. AppFolio's portals are functional but
   visually dated; our login page / workspace shell is a real differentiator for demos and sales.
4. **Deeper operational module set than AppFolio's published CA feature list:** lock-boxes, parking,
   inventory, fixed assets, 1099s, inspections, recurring work orders, purchase orders, letters/forms,
   hearings — several of these aren't on AppFolio's CA marketing pages.
5. **Open, inspectable data model (Postgres + RLS, ~190 tables).** Portfolio-scoped RLS, double-entry
   integrity enforced in the DB, per-manager association scoping. AppFolio is a black box; an MSP/operator
   who wants control over their data and policies gets it here.
6. **Honest, transparent money model.** No $2.49/ACH resident surcharge, no $1/unit payment tax, no
   minimum-fee trap that quadruples small-portfolio effective pricing. For small/mid HOA managers this
   is a sharp wedge against AppFolio's pricing complaints.

---

## 4. Where AppFolio STILL LEADS (honest)

1. **Resident online payments at scale** — ACH/card/Apple Pay/retail-cash + autopay execution + reconciliation.
   We deliberately don't do this; for many HOAs online dues collection is the #1 buying criterion, so this
   is a real competitive ceiling even though it's an intentional non-goal.
2. **Native mobile apps** — iOS/Android for managers, board, homeowners; offline-ish field workflows
   (violation capture with photo + GPS + community map). We are responsive web only.
3. **Generative-AI product maturity** — Realm-X Assistant/Messages/Flows/Performers is a shipped,
   marketed, agentic product line. We have the plumbing but only one live AI feature.
4. **Integration marketplace** — AppFolio Stack (~40+ partners) + public partner API. We have Plaid + Resend.
5. **Screening/leasing + e-sign** — mature, integrated (Experian, court records, e-signature). We have none
   (leasing is out of scope, but **e-sign is a real HOA gap** for ARC/board/contracts).
6. **Live SMS + automated physical mail** — both shipped at AppFolio; ours are records-only / missing.
7. **Brand maturity & trust** — #1 G2, 20,000+ customers, 8M+ units. We're pre-scale.

---

## 5. Prioritized "EXCEED" roadmap

Philosophy: don't chase payments/mobile-app/marketplace parity (capital-heavy, partly off-strategy).
Win on **AI leverage (BYO-key)**, **operator cockpit depth**, and **board/owner UX** — the places our
architecture makes features cheap that are expensive for AppFolio.

### Tier 1 — Quick wins (≤ 1 day each)
1. **AI violation-letter / notice drafting** — *Rationale:* uses existing BYO-key infra; turns a tedious
   HOA task into one click. We already extract insurance certs — same plumbing. AppFolio charges for this; we don't. *Effort: S.*
2. **AI comms copilot (draft owner/board emails + announcements)** — *Rationale:* matches Realm-X Assistant's
   most-used capability at zero incremental AI cost to us. *Effort: S.*
3. **Auto-notify owner on work-order/service-request status change** — *Rationale:* closes a PARTIAL gap vs
   AppFolio's "auto keep homeowner informed"; we already have WO + Resend queue. *Effort: S.*
4. **Threaded in-app owner↔manager messaging** — *Status: DELIVERED for architectural requests (2026-06-27)
   via `architectural_request_messages` + shared `ArcMessageThread` component.* Remaining: generalize the same
   thread pattern to service requests / violations / a standalone owner↔manager inbox. *Effort: S–M.*
5. **Automatic late-fee assessment rule** — *Rationale:* converts charges from manual to automated, matching
   AppFolio; cron + charge insert into existing journal. *Effort: S.*

### Tier 2 — Medium (2–5 days each)
6. **User-defined Report Builder (saved views + drill-down)** — *Rationale:* directly answers AppFolio's
   Report Builder; our open Postgres model + metrics make a column-picker + filter + save feasible. *Effort: M.*
7. **Amenity / facility reservation module** — *Rationale:* named CA feature we're missing; clean new RLS table
   + calendar reuse; high owner-facing value. *Effort: M.*
8. **Board approval queue + digital sign-off (invoices, bids, ARC, general items)** — *Rationale:* AppFolio's
   board-portal approvals incl. check-signing is a headline CA feature; we have board portal + bills + ARC,
   just need an approval workflow + audit trail (leans on our journal + audit logs). *Effort: M.*
9. **Live SMS gateway (Twilio) on top of existing SMS records** — *Rationale:* flips SMS from records-only to
   real two-way; AppFolio parity on text comms. *Effort: M.*
10. **AI invoice OCR → vendor bill draft** — *Rationale:* matches AppFolio's "AI-assisted invoice processing";
    extends our cert-extraction pattern; big time-saver for managers. *Effort: M.*
11. **E-signature for ARC approvals / board resolutions / vendor contracts** — *Rationale:* real HOA gap;
    embed an open e-sign flow (or DocuSeal self-host) tied to documents bucket. *Effort: M.*
12. **Reserve study / funding-plan module** — *Rationale:* CA-specific gap AppFolio markets; financial-planning
    table + projections + report; pairs naturally with our budgets/GL. *Effort: M–L.*

### Tier 3 — Big bets
13. **Realm-X-class AI Assistant (conversational ops copilot over our data)** — *Rationale:* the single biggest
    "exceed" lever. With BYO-key + open Postgres + RLS, build a chat agent that reports, drafts, and executes
    bulk actions scoped by role/portfolio. Beats AppFolio on cost (no AI tax) and openness (any model). *Effort: L.*
14. **Teachable workflow automation ("Flows") engine** — *Rationale:* matches Realm-X Flows; a rules+steps engine
    (trigger → action) over our modules (e.g. delinquency → letter → fee → board notify). Compounds every other
    feature. *Effort: L.*
15. **Native/PWA mobile field app for managers (violations w/ photo + GPS + map)** — *Rationale:* closes the
    biggest non-AI gap (mobile field ops). A PWA leveraging our responsive design system is far cheaper than
    AppFolio's native apps and could ship offline-capable violation capture. *Effort: L.*
16. **Operator-grade analytics + partner/API layer** — *Rationale:* lean into our structural edge. Give the
    platform operator cross-company benchmarking + a documented API/webhooks so an MSP can integrate — a
    marketplace-of-one that AppFolio's closed model can't match for resellers. *Effort: L.*
17. **AI maintenance triage (image diagnosis → category/urgency/vendor suggestion)** — *Rationale:* matches
    Realm-X Maintenance Performer using our existing image-extraction stack + BYO-key. *Effort: L.*

### Explicitly NOT pursuing (stay disciplined)
- Resident online card/ACH payments, FolioGuard-style embedded insurance, tenant login/leasing funnel,
  tenant screening — all confirmed non-goals; revisit only as paid add-ons if the market demands.

---

## 6. Sources
- AppFolio CA/HOA: [community-associations](https://www.appfolio.com/community-associations) · [HOA managers](https://www.appfolio.com/hoa/community-association-managers) · [board members](https://www.appfolio.com/hoa/community-association-board-members) · [homeowners](https://www.appfolio.com/hoa/community-association-homeowners) · [HOA management](https://www.appfolio.com/markets/hoa/management) · [HOA financials](https://www.appfolio.com/markets/hoa/financials)
- AI: [Realm-X](https://www.appfolio.com/ai) · [Flows](https://www.appfolio.com/articles/realm-x-flows) · [AI agents](https://www.appfolio.com/newsroom/appfolio-ai-agents)
- Marketplace: [Stack](https://www.appfolio.com/stack) · [Stack launch](https://www.appfolio.com/newsroom/appfolio-launches-appfolio-stack-marketplace) · [become a partner](https://www.appfolio.com/stack/become-a-partner)
- Payments/insurance/screening: [homeowners portal](https://www.appfolio.com/hoa/community-association-homeowners) · [insurance Q&A](https://www.justanswer.com/accounting-software/u4ki5-appfolio-insurance-services-tenants-benefits.html) · [Findigs screening](https://www.findigs.com/compare/appfolio-tenant-screening)
- Reporting/owner/mobile: [report customization](https://www.appfolio.com/blog/tips-and-tricks-for-customizing-your-appfolio-reports) · [owner experience](https://www.appfolio.com/property-management-owner-experience) · [research.com review](https://research.com/software/reviews/appfolio-property-manager)
- Pricing: [appfoliopricing.com](https://appfoliopricing.com/) · [costbench](https://costbench.com/software/property-management/appfolio/)
