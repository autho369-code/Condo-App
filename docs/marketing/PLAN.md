# Portier369 — 12-Month Marketing Plan (v1)

*Prepared 2026-07-14 · fCMO-level plan · AARRR-structured · Grounded in `.agents/product-marketing.md`, the live codebase, and docs/appfolio-gap-analysis.md. Scores marked "from materials" — push back where you have better data.*

---

## 1. Executive summary

Portier369 is a feature-complete, white-label HOA/condo management platform at pilot stage: product exceeds AppFolio on automation, AI, and operator architecture at a fraction of the effective price, but has **zero paying customers and zero systematic demand generation**. The constraint is not product. It is that no management company outside the founder's orbit knows Portier369 exists.

**Three big bets for the next 12 months:**

1. **Founder-led outbound to small management companies (Acquisition → Revenue).** The ICP is reachable by list: HOA management companies with 50–1,000 doors are enumerable from state registries, Google Maps, and community-association directories. A 200-company list, a white-glove pitch ("AppFolio capability, $157/mo, we migrate you"), and 50 personalized emails/week is the fastest path from 0→5 paying portfolios. Skills: `prospecting`, `cold-email`. The scraping infrastructure to build these lists already exists in-house.
2. **Own the "AppFolio alternative" and local search shelves (Acquisition, compounding).** The pages already exist — /compare/appfolio-alternative, ~31 /local city pages, /hoa-laws state pages, llms.txt, IndexNow. The bet is finishing the job: expand competitor set (Buildium, Vantaca, CINC, TOPS, PayHOA), 10× the local coverage programmatically, and structure everything for AI-search citation. Skills: `competitors`, `programmatic-seo`, `ai-seo`, `seo-audit`.
3. **Pilot → proof → referral engine (Activation → Referral).** Convert the Stellar pilot into a named case study with numbers (hours saved, delinquency collected via automatic late fees, board satisfaction), then weaponize HOA-world structure: board members sit on multiple boards, and managers talk. A "first association free for 90 days" wedge plus a referral credit turns every satisfied board into a lead source. Skills: `customer-research`, `referrals`, `sales-enablement`.

**90-day priority:** first 3 paying management companies (or 1 paying + 2 committed pilots), with the outbound machine running weekly and the case study published.

**12-month outcome (honest, linear-growth math):** 10–20 paying portfolios ≈ 2,000–6,000 doors ≈ $30–90K ARR — enough proof to decide between bootstrapped profitability and raising. The step-function upside (not promised, worked toward): one 1,000+ door enterprise portfolio or one MSP/operator reseller doubles the base overnight.

---

## 2. Strategic frame

**Category claim:** *The white-glove operating system for community-association management* — sits on the "AppFolio alternative / HOA management software" shelf, differentiated by all-inclusive flat pricing and white-label depth.

**ICP distilled:** Principal/owner of an HOA-condo management company, 1–20 staff, 50–1,000 doors, currently on AppFolio (paying the $280+ minimum tax), Buildium, or spreadsheets+QuickBooks. Secondary: self-managed association boards (Foundation tier). Tertiary/structural: MSP-style operators who run multiple management companies (nobody else serves this layer).

**Business-model logic:** Door-based flat subscription ($157/$382/$642/custom), everything included, unlimited seats. Revenue grows two ways: new portfolios (sales) and door growth inside portfolios (customer success). No payments/AI/module upsells — that *is* the positioning.

**Brand voice non-negotiables:** professional, meticulous, white-glove; concrete numbers over adjectives; "owners" never "tenants"; the platform's name never appears in owner/vendor-facing surfaces; no marketing-speak ("revolutionary," "supercharge").

**Open strategic decision (blocks messaging):** primary geography. Gap analysis says Maryland condos; legal pages say Illinois/Cook County. Pick one beachhead state for outbound + local SEO concentration. *(§13 Open decisions, #1.)*

---

## 3. Current state — scored from materials

**Team:** founder (Mirsad) — sales, product direction, domain expertise; AI execution engine (this stack) — engineering, content, ops. No marketing hires. Founder is the strategic owner; effectively π-shaped (domain + product) with the AI stack covering content/growth execution.

**Budget:** ~$0–2K/mo (bootstrapped tier): hosting/Supabase/Resend/AI keys. No paid acquisition. Blended CAC: unknown (no customers yet) — **the** open metric.

**Phase:** $0–10K ARR — the grueling phase. Binding constraint: first customers, not brand.

**Rubric scores (0–5, from materials):**

| # | Area | Score | Evidence / gap |
|---|------|-------|----------------|
| 1 | Positioning & messaging | 4 | Sharp pricing/compare pages; geography unresolved |
| 2 | Website & landing pages | 4 | Modern marketing site, feature pages, customer story |
| 3 | SEO — technical | 3.5 | Sitemap, IndexNow, llms.txt, schema on pricing; needs full audit |
| 4 | SEO — content | 3 | /local (31 cities), /hoa-laws, /compare exist; thin coverage vs opportunity |
| 5 | AI-search readiness | 3 | llms.txt + report-card exist; no citation strategy |
| 6 | Paid acquisition | 0 | None (correct for stage) |
| 7 | Outbound | 1 | Infrastructure (scraping, email) exists in-house; no ICP list or sequences |
| 8 | Social / community | 0 | Nothing |
| 9 | PR / directories | 0.5 | Not submitted anywhere |
| 10 | Analytics | 2.5 | Vercel Analytics only; no funnel events, no CRM |
| 11 | Email marketing | 2 | Transactional pipeline excellent (Resend, white-label); zero marketing sequences |
| 12 | Activation/onboarding | 4.5 | Onboarding checklist, operating manuals delivered, white-glove setup, trial countdown |
| 13 | Retention product surface | 4.5 | Flows, reminders, portals, exports — retention is a product strength |
| 14 | Referral | 0 | No program |
| 15 | Pricing & packaging | 4 | Clear tiers, honest FAQ; annual/discount policy undecided |
| 16 | Sales enablement | 2 | Demo page + manuals; no deck, no ROI one-pager, no battle cards beyond compare pages |
| 17 | Proof | 1.5 | One customer story (Stellar), no metrics, no testimonials |

**Already done (acknowledge):** full marketing site incl. programmatic scaffolding; AppFolio gap analysis (4 audit rounds); operating manuals v1.1; SEO groundwork session (schema, IndexNow); report-card page; customer story page.
**In-flight:** none blocking.
**Stuck:** first real pilot beyond Stellar; geography decision.

---

## 4. Acquisition

**Channels now (priority order):**

1. **Founder-led outbound (primary until 10 customers).**
   - Build the beachhead list: every HOA management company in the chosen state + 2 adjacent (name, doors if findable, current software from job posts/reviews, principal's email). Target: 200 accounts. Skills: `prospecting` (+ in-house scraping).
   - Sequence: 4-touch over 3 weeks. Angle A (AppFolio users): "your minimum fee vs our $157 — same capability, we migrate you." Angle B (spreadsheet shops): "look bigger than you are — owner portal + board portal under your brand in a week." Skill: `cold-email`.
   - Volume: 50 new accounts/week, personalized first lines. Reply → 20-min demo on the live Granville sample.
2. **Comparison/alternative SEO (compounding).** Expand /compare to Buildium, Vantaca, CINC, TOPS, PayHOA, Condo Control + "best HOA management software for small companies" listicle-bait page. Every page: honest feature table, pricing math vs their minimums, migration CTA. Skills: `competitors`, `competitor-profiling`.
3. **Programmatic local SEO.** 31 cities → 300+ (every city >50k pop in beachhead + adjacent states), plus "HOA management companies in {city}" directory-style pages that also seed outbound goodwill. Skill: `programmatic-seo`. Guard: unique data per page (state law snippets from /hoa-laws, local stats) — no thin duplicates.
4. **AI-search (GEO).** The buyer increasingly asks ChatGPT "AppFolio alternatives for HOA." Optimize compare pages for citation, keep llms.txt current, add FAQ schema everywhere, publish the gap-analysis as public content ("Portier369 vs AppFolio: the honest table"). Skill: `ai-seo`.
5. **Directory submissions (one-time sprint).** Capterra, G2, Software Advice, GetApp, SaaSHub, AlternativeTo + HOA-industry directories (CAI service directory). Free DR + the review surface B2B buyers check. Skill: `directory-submissions`.
6. **Community presence (low-volume, high-trust).** Answer questions in r/HOA, CAI chapters, Facebook HOA-manager groups — as a practitioner, not a vendor. 2 hrs/week cap. Skill: `community-marketing`.

**Skipped (with rationale):** paid ads (no budget, CAC unknown, long sales cycle — revisit at seed tier); social content calendar (ICP isn't scrolling LinkedIn for HOA software; presence only); events/sponsorships (cash); cold calling (founder time better spent on demos).

**12-month:** by Q4, SEO+AI-search should produce 5–10 inbound demo requests/mo; outbound remains the floor. CAI chapter sponsorship becomes the first paid test *if* two organic-sourced customers close first.

---

## 5. Activation

Definition: signed-up management company → first association fully live (units, owners imported, operating documents on file, owners invited).

- **The product already does the heavy lifting:** /onboard checklist with operating-documents gate, CSV importers, invitation chain, manuals in the welcome email, trial countdown. Keep.
- **Add (90 days):** "First association live in 7 days" concierge promise on /demo — founder does the import *for* them (white-glove is the brand; at this stage it's also the activation strategy). Skill: `onboarding`.
- **Add:** activation email sequence (day 0 welcome → day 2 "import your owners" → day 5 "invite your board" → day 12 "your trial dashboard" → day 25 trial-end + proposal). Uses existing Resend pipeline. Skill: `emails`.
- **Instrument:** define activation event = first association with ≥10 units + ≥5 owner invites sent; track weekly. Skill: `analytics`. *(Currently unmeasured — Open decision #3.)*
- **Demo motion:** the live Granville sample *is* the demo. Add a /demo self-serve sandbox login (read-only owner + manager persona) so a curious principal can touch it without booking. (Product task, small.)

---

## 6. Retention

Retention is product-led and already strong (Flows, reminders, white-label email, exports). Marketing's job: make the value *visible* and catch risk early.

- **Monthly "Your association, this month" digest to company admins** — dues collected, late fees auto-assessed, work orders closed, docs filed. The invoice justifies itself. Skill: `emails`.
- **Quarterly business review one-pager per portfolio** (auto-generated from existing reports) the manager can forward to boards — retains the *manager's client*, which retains ours.
- **Churn-risk flow:** login lapse >21 days or doors trending down → founder email. Skill: `churn-prevention` (lightweight now; formal cancel-flow when there's volume to save).
- **Support-as-marketing:** keep the operating manuals current with each release; in-app "what's new" note per monthly release train.

---

## 7. Referral

HOA-land is structurally viral: board members serve on multiple associations' boards; managers know each other through CAI; vendors work across companies.

- **Now:** "Give 2 months, get 2 months" referral credit for management companies; founder asks personally at first QBR.
- **Board-member vector (unique to us):** every board portal footer: "Your management company runs on Portier369 — know another community that deserves this?" → referral page. Tasteful, white-label-compatible (frame as the *management company's* tech advantage).
- **Q2:** vendor vector — vendors use the vendor portal free; they talk to many management companies. "Powered by" touchpoint on vendor invites.
- **Q3+:** formal partner/affiliate program for HOA accountants and attorneys (they advise boards on management-company selection). Skill: `referrals`.

---

## 8. Revenue

- **Pricing holds.** $157/$382/$642 is the wedge; do not discount the sticker. Unit economics at full tiers: ARPC ≈ $250–400/mo blended once real portfolios land.
- **Decide (Open decision #2):** annual prepay incentive (recommend 2 months free — improves cash in bootstrap mode) and trial length/terms (recommend 30 days, card-less, concierge-gated).
- **Expansion revenue = door growth:** managers win new associations partly *because* of the platform — the QBR one-pager and proposal-ready exports are expansion features. Track doors/portfolio monthly as the NRR proxy.
- **Enterprise/MSP motion (opportunistic):** the operator cockpit is a category-of-one. One outbound letter/month to franchise-style management groups. Custom pricing; founder-led.
- **Budget math:** at $0 paid CAC, every customer is founder-time CAC. When the first 10 close, compute real blended CAC (founder hours × imputed rate + tools) — that number decides whether paid ever makes sense. Skills: `pricing`, `revops` (lightweight CRM: a tracked pipeline table is enough now — HubSpot free at >20 active deals).

---

## 9. 90-day roadmap

Owners: **M** = Mirsad (founder), **AI** = this stack.

**Weeks 1–2 — Unblock**
| Move | AARRR | Owner |
|---|---|---|
| Decide beachhead geography (MD or IL) + fix legal/marketing copy to match | Strategy | M |
| Define + instrument activation event, demo-request event, funnel dashboard | Activation | AI |
| Decide trial terms + annual incentive | Revenue | M |
| Stellar case-study interview (numbers: hours saved, late fees collected, board NPS) | Proof | M+AI |

**Weeks 3–4 — Foundation**
| Move | AARRR | Owner |
|---|---|---|
| 200-account ICP list w/ emails + current-software flags | Acquisition | AI |
| Cold sequences (2 angles × 4 touches) + sending domain warmup | Acquisition | AI |
| Publish case study + testimonial on site; sales one-pager + ROI calc PDF | Proof/Sales | AI |
| Expand /compare: Buildium, Vantaca, CINC, TOPS, PayHOA | Acquisition | AI |
| Directory sprint: Capterra, G2, GetApp, SaaSHub, AlternativeTo, CAI | Acquisition | AI |

**Weeks 5–8 — Velocity**
| Move | AARRR | Owner |
|---|---|---|
| Outbound live: 50 accounts/week; demos booked by M | Acquisition | M+AI |
| Activation email sequence live | Activation | AI |
| Local pages 31 → 150 (beachhead-weighted, unique data per page) | Acquisition | AI |
| Self-serve read-only demo sandbox | Activation | AI |
| Full technical SEO audit + fixes | Acquisition | AI |

**Weeks 9–12 — Compound**
| Move | AARRR | Owner |
|---|---|---|
| Referral credit live + board-portal referral touchpoint | Referral | AI |
| Monthly value-digest email live | Retention | AI |
| "Portier369 vs AppFolio: the honest table" long-form + AI-citation optimization | Acquisition | AI |
| First QBR with earliest customer; ask for referral + review (G2/Capterra) | Referral/Proof | M |
| Compute first real CAC + pipeline review; go/no-go on any paid test | Revenue | M |

**90-day targets:** 600 accounts touched · ≥25 demos · **3 paying portfolios** · case study live · 10 keywords on page 1–2 for "{competitor} alternative HOA".

---

## 10. 12-month outlook

- **Q1 (plan quarter):** 0→3 customers; outbound machine; proof published. Phase: grueling $0–10K.
- **Q2:** 3→8 portfolios. Double down on whichever outbound angle converts; local SEO to 300 pages; first CAI chapter appearance; referral flywheel first turns. Watch for the treacherous-middle plateau — answer is *more accounts, adjacent state*, not new channels.
- **Q3:** 8→14. Add second beachhead state; accountant/attorney partner program; consider first contractor (VA for list-building + demo scheduling, ~$1–1.5K/mo) — first budget unlock, funded from revenue, not a raise.
- **Q4:** 14–20 portfolios, ~$50–90K ARR run-rate. Decision gate: bootstrap to profitability (default) vs. raise pre-seed to unlock $5–15K/mo paid + first marketing hire (π-shaped growth+content, Manager title). The 3-3-2-2-2 curve only applies if raising; don't cosplay venture pacing while bootstrapped.
- **S-curve layering:** current curve = founder outbound. Start the next (SEO/AI-search inbound) now — it's Q3–Q4's curve. The third (partners/referral) seeds in Q2, pays in year 2.

---

## 11. Marketing operations stack

| AARRR stage | Moves | Skills | Tools/MCP |
|---|---|---|---|
| Acquisition | list-building, cold sequences | `prospecting`, `cold-email` | in-house scraper, Resend/instantly-class sender, gh |
| Acquisition | compare + local + laws pages | `competitors`, `programmatic-seo`, `copywriting` | Next.js repo, IndexNow script |
| Acquisition | AI-search citation | `ai-seo`, `schema` | llms.txt, JSON-LD |
| Acquisition | audits | `seo-audit`, `competitor-profiling` | WebFetch/WebSearch |
| Activation | trial emails, concierge onboarding | `emails`, `onboarding`, `signup` | Resend pipeline (built), /onboard (built) |
| Retention | digests, QBR one-pagers, churn saves | `emails`, `churn-prevention` | report exports (built), email queue |
| Referral | credits, board/vendor touchpoints, partners | `referrals`, `co-marketing` | product surfaces |
| Revenue | pricing decisions, pipeline, enablement | `pricing`, `offers`, `revops`, `sales-enablement` | platform billing (built), pipeline sheet |
| Cross-cutting | proof, research, voice | `customer-research`, `copy-editing`, `marketing-council` | .agents/product-marketing.md |

This stack replaces roughly a 6–8 person early marketing org. The founder's only irreplaceable jobs: geography/pricing decisions, demos, and asking for referrals.

**Capability unlocks:** revenue-funded VA (Q3, ~$1.5K/mo) → pre-seed close ($5–15K/mo: paid pilots on "appfolio alternative" search terms + CAI sponsorships + first hire) → beyond: not planned this cycle.

---

## 12. Tactical idea bank (139-idea library, statused)

Dense summary by cluster — full per-idea table available on request; **Now** items are already embedded in §4–§8/§9.

| Cluster (≈ideas) | Status | Notes |
|---|---|---|
| Cold outbound, list-building, niche directories (12) | **Now** | §4.1, §4.5 |
| Comparison/alternative pages, programmatic SEO, AI-SEO (14) | **Now** | §4.2–4.4 |
| Case studies, testimonials, reviews (8) | **Now** | §9 weeks 1–4 |
| Onboarding/lifecycle email (9) | **Now** | §5 |
| Referral/partner programs (10) | Now→Q2 | §7 |
| Community/forums/Reddit presence (7) | Q2 | 2 hr/wk cap |
| Free tools & lead magnets (11) | Q2–Q3 | best fits: HOA late-fee calculator, reserve-study checklist, "what does AppFolio really cost" calculator |
| Content marketing/newsletter/podcast guesting (12) | Q3 | founder-voice, CAI circuit |
| Webinars/events (6) | Q3–Q4 | CAI chapters only |
| Paid search/social/retargeting (15) | Q4+ (gate: CAC known + budget) | first test: branded-competitor search |
| PR/launch platforms (8) | Q4+ | Product Hunt is wrong shelf; trade press (CAI's *Common Ground*) right one |
| Influencer/affiliate at scale, ABM tooling, video series, marketplace integrations (27) | Skip this cycle | wrong stage or wrong ICP |

---

## 13. Measurement, RACI, open decisions

**North star:** paying doors under management.
**Leading indicators:** A: accounts contacted/wk, demo requests · A2: trials reaching activation event · R: WAU company-admins, doors/portfolio · R2: referrals asked/received · $: MRR, CAC (once computable).

**RACI:** Strategy/pricing/geography — R:M, A:M · Outbound content+list — R:AI, A:M · Demos/closes — R:M · Site/SEO/content/email builds — R:AI, A:M · Analytics — R:AI · Referral asks — R:M.

**Open decisions (blocking, ranked):**
1. **Beachhead geography** (MD vs IL) — blocks outbound list, local SEO weighting, legal copy coherence.
2. **Trial terms + annual incentive** — blocks activation sequence copy and proposal template.
3. **Activation metric sign-off** — blocks funnel dashboard.
4. **Stellar case-study numbers approval** — blocks proof publication.
5. **CAC after first 10 customers** — blocks any paid decision (highest-impact unknown; every projection depends on it).

**Appendix:** `.agents/product-marketing.md` (positioning source of truth) · `docs/appfolio-gap-analysis.md` (competitive substance for compare pages) · `docs/manuals/` (activation collateral) · this file mirrored at `docs/marketing/PLAN.md` in the repo.
