# Product Marketing Context

*Last updated: 2026-07-14 (auto-drafted from codebase + docs/appfolio-gap-analysis.md; correct anything that reads wrong)*

## Product Overview
**One-liner:** White-glove operations for every association — the operating system for community-association management.
**What it does:** Portier369 runs the entire back office of an HOA/condo management company: double-entry accounting, assessments and automatic late fees, work orders, violations (with mobile field capture), architectural reviews, insurance tracking with automatic expiry reminders, board approvals with e-signatures, and six white-labeled portals (manager, company admin, board, owner, vendor, platform operator) on one login system. Every owner- and vendor-facing touchpoint presents as the management company, never the platform.
**Product category:** Community association / HOA management software (the "AppFolio alternative" shelf).
**Product type:** B2B multi-tenant SaaS.
**Business model (repositioned 2026-07-14, "commercial protection" spec):** Door-based subscription — every plan includes the COMPLETE CORE PLATFORM (Model A: tiers differ only by door capacity, support level, usage allowances); no hidden software modules; month to month. Foundation $157/mo (≤200 units) · Growth $382/mo (≤600) · Portfolio $642/mo (≤1,000) · Enterprise custom (1,000+). Unlimited owners/board/vendors. STANDARD ONBOARDING included (narrow: account config, association creation, spreadsheet-based unit/owner/vendor imports, one remote admin training session, launch assistance). PROFESSIONAL SERVICES quoted separately (data retrieval from prior provider, historical document/financial migration, cleanup, custom integrations/AI, on-site training). USAGE-BASED: AI Receptionist add-on, voice/SMS, storage/OCR overages. BANNED PHRASES (never publish): "everything included", "no implementation fees", "migration included", "no services invoice", "unlimited setup/migration", "white glove setup" as a plan bullet. Say "recognizes/matches" owners, never "authenticates". AI suite is branded "Portier AI Command Center"; the receptionist is "Portier AI Receptionist" (live demo line: 872-269-8818).

## Target Audience
**Target companies:** Small-to-mid HOA/condo management companies (1–1,000 doors) and self-managed associations; multi-company MSP/operator resellers are a structural second market (platform-operator cockpit).
**Beachhead geography (decided 2026-07-14):** Illinois — Chicago metro first (Cook, DuPage, Lake, Will counties), then downstate; company is Illinois-based (legal pages: Portier369, Inc., Cook County). Expansion: adjacent Midwest states (WI, IN) in Q3.
**Decision-makers:** Owner/principal of the management company; company admin/ops lead; senior property manager.
**Primary use case:** Replace spreadsheets + email + legacy tools (or overpriced AppFolio) with one system that runs accounting, compliance, and resident communication for every association.
**Jobs to be done:**
- Keep every association's money right (dues, late fees, AP, budgets, reconciliation) without an accountant on staff.
- Keep owners and boards informed and self-served so the phone stops ringing.
- Pass audits and board scrutiny: documents, approvals, signatures, and records always on file.
**Use cases:** onboarding a new association (operating documents checklist), monthly dues + automatic late-fee cycles, violation walks with phone photo/GPS capture, ARC review with plans attached, board packet + approvals with e-signatures, insurance certificate collection with 30/15-day expiry reminders.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Management-company owner (buyer) | Margin, professional image, not losing clients | Legacy tools eat margin; big tools price-gate features | Everything included at a flat door price; white-glove branding |
| Property manager (daily user) | Getting through the day; fewer angry calls | Chasing owners, vendors, paperwork across systems | One workspace; automation (Flows) does the chasing |
| Board member | Oversight, fiduciary duty, transparency | Blind between meetings; paper approvals | Live financials, delinquencies, approvals with real signatures |
| Homeowner | Pay, ask, know what's happening | Portals that feel like ad-ons; two logins if on the board | One login for owner+board; same calendar as the board; ledger export |
| Platform operator / MSP | Running many companies | No product serves the reseller layer | Operator cockpit: provision companies, billing, audit, health |

## Problems & Pain Points
**Core problem:** Community management runs on fragmented tools and manual chasing — money, records, and communication live in different places, and the big incumbent charges enterprise prices with per-module and AI upsells.
**Why alternatives fall short:**
- AppFolio: $280/mo minimums that quadruple small-portfolio effective rates, $2.49/ACH resident surcharges, AI gated behind the $5/unit Max tier, closed data model.
- Spreadsheets/QuickBooks + email: no owner portal, no audit trail, no RLS-scoped records, dues and late fees by hand.
**What it costs them:** hours per week per association on manual work; churned clients over unprofessional owner experience; audit and compliance risk.
**Emotional tension:** fear of looking small in front of boards; dread of the delinquency spreadsheet; anxiety that records won't hold up when a dispute hits.

## Competitive Landscape
**Direct:** AppFolio (Community Associations) — priced for scale, minimum fees punish small portfolios, AI and payments monetized as add-ons, closed platform. Buildium/Vantaca/CINC — same shelf, older UX, module pricing.
**Secondary:** QuickBooks + spreadsheets + Gmail — no portals, no workflow, no audit trail.
**Indirect:** Hiring more admin staff / outsourced bookkeeping — recurring headcount cost that doesn't scale and leaves no system behind.

## Differentiation
**Key differentiators:**
- White-glove/white-label everywhere: every email, portal, PDF export presents as the management company.
- One login, six roles — including owner+board dual role on a single account (AppFolio's portals are separate logins).
- BYO-key AI with no AI tax: assistant, violation letters, comms copilot, photo diagnostics, invoice OCR, insurance-cert extraction — on any model the company plugs in.
- Flows: teachable trigger→action automation (overdue dues → email + late fee + manager alert) on every tier.
- Operator cockpit: a reseller/MSP can run many management companies — AppFolio has no equivalent layer.
- Open, inspectable Postgres data model with row-level security; ~119 reports (vs AppFolio's ~90); print/CSV/branded-PDF export on every financial surface.
**How we do it differently:** one flat door price, everything included; modern unified design system across all portals; web-first mobile flows (field violation capture with photo+GPS) instead of app-store lock-in.
**Why customers choose us:** AppFolio capability at a fraction of the effective price, with a more professional owner experience under their own brand.

## Objections
| Objection | Response |
|-----------|----------|
| "No online ACH/card payments for owners?" | Deliberate: no $2.49 resident surcharge or per-unit payment tax; structured offline remittance instructions per association; online payments exist as a roadmap add-on when demanded. |
| "You're small / can I trust my books to you?" | Double-entry integrity enforced in the database, closed-period guards, full audit logs, exportable everything — the books are yours and inspectable, unlike a black box. |
| "No native mobile app?" | Mobile-first web covers the field workflows (photo+GPS violation capture, portals) with no app-store updates; PWA install works today. |
| "Migration pain" | "We assist with migration": standard onboarding (spreadsheet-based unit/owner/vendor imports, admin training, launch assistance) is included; data retrieval from the old provider, historical documents, and financial history conversion are professional services quoted up front. |

**Anti-persona:** single-family rental landlords/leasing operations (no leasing funnel, no tenant screening by design); associations that require embedded resident card payments on day one.

## Switching Dynamics
**Push:** minimum-fee pricing traps, per-module/AI upsells, resident payment surcharges, dated portals, support black holes.
**Pull:** flat all-inclusive price; owner/board experience that makes the management company look bigger; AI + automation included.
**Habit:** years of data in the incumbent; staff trained on old workflows; "we've always done it in Excel."
**Anxiety:** data migration accuracy; a young vendor's longevity; losing the payments rail (addressed: structured remittance + exports of everything).

## Customer Language
**How they describe the problem:**
- "I'm chasing owners for dues every single month."
- "The board wants numbers I can't pull without a weekend in Excel."
- "AppFolio's minimum is more than my smallest association pays me."
**How they describe us:**
- "Everything's in one place and it looks like *my* company, not somebody's software."
**Words to use:** association, community, doors/units, owners (not tenants), board, dues/assessments, white-glove, records, on file.
**Words to avoid:** tenants/renters (owners are not tenants), landlord, lease-up, "portal fees," Portier369 in any owner/vendor-facing copy (white-label).
**Glossary:**
| Term | Meaning |
|------|---------|
| Door/unit | The pricing metric — a unit under management |
| Association | The HOA/condo client of the management company |
| Portfolio | A management company's book of associations (one tenant in the platform) |
| ARC | Architectural review request workflow |
| Flows | Trigger→action automation rules run hourly |
| Operating documents | Declaration/CC&Rs, bylaws, articles, rules — required per client |

## Brand Voice
**Tone:** professional, calm, competent — "white-glove," never salesy or cute.
**Style:** direct and concrete; numbers over adjectives; plain words over jargon.
**Personality:** meticulous, transparent, dependable, quietly modern.

## Proof Points
**Metrics:** ~119 built-in reports (vs AppFolio's ~90 published); 6 role portals on one login; plans from $157/mo all-inclusive vs AppFolio's $280/mo minimum + surcharges; automation and AI included on every tier.
**Customers:** Stellar Property Management (customer story page live at /customers/stellar-property-management).
**Testimonials:**
> (Collect from Stellar pilot — placeholder.)
**Value themes:**
| Theme | Proof |
|-------|-------|
| Everything included | Pricing page: no modules, no implementation fees, unlimited owners/board/vendors |
| White-glove brand | All owner/vendor email + exports carry the company's name |
| Books you can trust | Double-entry GL enforced in DB, closed periods, audit logs, export everywhere |
| Automation that works | Flows, automatic late fees, 30/15-day insurance reminders, owner status notifications |

## Goals
**Business goal:** convert small/mid management companies from AppFolio/spreadsheets; land the first paying pilots and grow door count per portfolio.
**Conversion action:** Request Proposal / book a demo at /demo.
**Current metrics:** pre-scale; pilot stage (first real client onboarding is the active launch gate).
