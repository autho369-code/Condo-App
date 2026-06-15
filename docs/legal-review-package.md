# Legal Review Package — Portier369 Legal Pages

**Prepared for:** outside counsel review
**Prepared by:** engineering (factual/product input only — not legal advice)
**Date:** 2026-06-14
**Scope:** the three public legal pages served at portier369.com:

- `/legal/privacy` — source: `app/(marketing)/legal/privacy/page.tsx`
- `/legal/terms` — source: `app/(marketing)/legal/terms/page.tsx`
- `/legal/security` — source: `app/(marketing)/legal/security/page.tsx`
- shared layout/heading components: `app/(marketing)/legal/_components.tsx`

---

## 0. Product & data facts counsel should rely on

These are confirmed against the codebase as of 2026-06-14. Counsel should treat
these as the ground-truth description of how the system actually handles data;
where the live pages diverge from this, that divergence is flagged below.

**What Portier369 is.** A multi-tenant SaaS sold to property-management /
community-association management **companies** ("Customers"). End users fall into
roles: platform operator (vendor staff), company admin, manager, board member,
homeowner/owner, and external vendor. All accounts are invitation-based.

**Controller/processor posture.** For resident/association data the Customer is
the **controller** and Portier369 is the **processor**. (The Privacy Policy
already states this — good.)

**Categories of personal data processed:**

- Identity/contact: names, emails, phone numbers, roles, login credentials.
- Association/property records: units, ownership, ledgers, assessments,
  violations, work orders, documents, emergency contacts, tenant occupancy,
  pets (`tenants`, `unit_pets` tables per project memory).
- Sensitive financial: double-entry ledgers (`journal_entries`/`journal_lines`),
  bank-account linkage and transaction feeds via **Plaid**.
- Lease/insurance documents stored in a private storage bucket, served via
  signed URLs.
- Usage/device/log data, IP addresses.

**Payment / cardholder data — IMPORTANT for counsel.**
- There is **no online card collection from residents.** Resident assessment
  payments are **offline remittance** (manager-entered) reconciled against bank
  feeds. Stripe was removed from the resident-payment flow (commit
  `7bedce0`, 2026-06-14). Portier369 stores **no cardholder data (no PAN)**.
- **Plaid** is used to link Customer/association **bank accounts** and pull
  **transaction** data (`products: [Products.Transactions]`,
  `lib/plaid/client.ts`, `app/api/plaid/*`). Plaid holds the banking
  credentials; Portier369 receives account/transaction metadata. This is a
  meaningful financial-data flow and a sub-processor relationship.
- **Residual Stripe usage:** the **company-admin SaaS billing** schema still
  carries `stripe_customer_id` / `stripe_subscription_id` /
  `stripe_invoice_url` columns (`app/company-admin/billing/page.tsx`). This is
  Portier369 charging *its own management-company customers* a subscription —
  **not** residents paying assessments. So Stripe may still be a sub-processor
  for *Customer billing*, even though it is gone from the resident-facing
  payment path. Counsel should confirm whether Stripe remains live for SaaS
  billing before drafting the sub-processor list.

**AI features — IMPORTANT and currently UNDISCLOSED.**
- Portier369 ships AI features on a **bring-your-own-key (BYOK)** model. Each
  portfolio/Customer configures their own provider and API key
  (`app/(app)/settings/ai/page.tsx`, `lib/ai/service.ts`). Supported providers:
  **OpenAI, DeepSeek, Anthropic, or any custom OpenAI-compatible endpoint.**
- Live feature: **insurance certificate (HO6) extraction** — uploaded
  certificate **images are sent to the customer-chosen AI provider** via a
  vision API (`lib/ai/service.ts` `visionCompletion`,
  `app/api/ai/analyze-violation-photo/route.ts`). Roadmap features (violation
  drafting from photos, communication Copilot, financial analysis) will send
  additional owner/association content to the AI provider.
- The customer's AI API key is stored in the `portfolios` table
  (`ai_api_key`). The UI states "Stored encrypted" — counsel/security should
  confirm the encryption claim is accurate (see Security gap list).
- **Neither the Privacy Policy, Terms, nor Security page currently discloses any
  AI processing or that resident PII / document images may be transmitted to a
  third-party AI provider.** This is the single biggest disclosure gap.

**Sub-processors actually in use (for the DPA / sub-processor list):**

| Sub-processor | Role | Data touched |
|---|---|---|
| Supabase (project `termxngysvotnfbzbgrv`) | Database, auth, file storage | All association/resident data, credentials, documents |
| Vercel | Application hosting / edge | Request data, logs, IP |
| Resend | Transactional + bulk email delivery | Recipient email, message content |
| Plaid | Bank-account linking & transaction sync | Bank account + transaction data, banking credentials (held by Plaid) |
| Stripe (SaaS billing only — confirm) | Subscription billing of management companies | Customer billing contact, payment method on file |
| Customer-selected AI provider (OpenAI / DeepSeek / Anthropic / custom) | AI extraction/drafting (BYOK) | Document images, violation/PII content sent at customer's direction |
| SMS provider | SMS delivery (referenced in pages; provider not confirmed in code) | Recipient phone, message content |

> Note: the pages mention SMS delivery, but no SMS provider integration was
> located in the code during this review. Confirm whether SMS is live before
> listing an SMS sub-processor.

**Governing details NOT found anywhere in the product (counsel must supply):**
legal entity name, state/country of incorporation, registered business address,
governing-law jurisdiction, arbitration/venue choice, and the liability-cap
figure. The Terms reference these concepts only generically.

---

## 1. Privacy Policy (`/legal/privacy`)

### 1a. What the page currently covers
- Identifies Portier369 and its role; states Customer = controller, Portier369 =
  processor for in-platform resident/association data.
- Categories collected: account info; association/property data; payment info
  ("processed through third-party providers; we do not store full card or bank
  numbers"); communications (email/SMS); usage/device data.
- How info is used (operate, authenticate, process payments, support, fraud
  prevention, legal compliance, product improvement); "we do not sell personal
  information."
- How info is shared (Customer org; service providers under contract; legal
  compulsion; M&A).
- Data security summary (RLS, encryption in transit, RBAC, audit logging;
  cross-references Security page).
- Data retention (kept as needed / per Customer agreement; Customer controls
  retention; export/deletion per agreement).
- Your rights (access/correct/delete/port/object/restrict "depending on
  jurisdiction"; directs requests to the management company since Portier369 is
  a processor).
- Children's privacy (not directed to under-16).
- Changes; contact (`hello@portier369.com`).
- "Not legal advice / recommend counsel review" disclaimer. ✔ present.

### 1b. Gap analysis
1. **No named sub-processor list.** "Service providers (such as hosting, payment
   processing, email, SMS)" is generic. Mature SaaS privacy/DPA practice names
   Supabase, Vercel, Resend, Plaid (and the AI provider / Stripe-for-billing) or
   links to a maintained sub-processor page. **Add a sub-processor list or a
   link to one.**
2. **No DPA reference.** Page never mentions that a Data Processing Addendum is
   available to Customers, nor that it governs the processor relationship.
   Counsel will likely want a standalone DPA; the policy should point to it.
3. **No CCPA/CPRA-specific section.** "Depending on your jurisdiction" is too
   thin for California. CPRA expects: categories of PI collected/disclosed,
   purposes, the "do not sell/share" statement made explicit, sensitive-PI
   handling, consumer rights + how to exercise, non-discrimination,
   authorized-agent mechanism, and a "shine the light" / retention disclosure.
   The "we do not sell" line is good but should be CPRA-anchored.
4. **No other US state privacy acts.** As of 2026 multiple state acts are in
   force (e.g., Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA,
   Texas TDPSA, Oregon, Montana, etc.). Counsel should decide whether to add a
   multi-state addendum or rely on the controller (Customer) for resident
   notices. Because Portier369 is mostly a processor, the practical question is
   *which obligations flow to the processor* — needs a counsel decision.
5. **GDPR applicability undecided.** No legal-basis language, no
   EU/UK representative, no international-transfer mechanism (SCCs). If the
   target market is US-only HOAs, counsel may scope GDPR out explicitly; if any
   EU resident/owner data is plausible, the SCC/transfer story is missing. **Open
   question for counsel.**
6. **Retention is non-specific.** "As long as needed" with no concrete periods,
   no post-termination deletion window (e.g., "deleted/returned within N days of
   termination"). Backups also exist (Supabase PITR + a `backups/` seed dump) —
   retention of backups should be addressed.
7. **Resident/owner deletion rights are circular.** The policy directs data
   subjects to the management company (correct for a processor) but does not
   describe the *operational* deletion path or SLA when a Customer instructs
   deletion. Pair with a DPA deletion clause.
8. **Breach notification absent.** No commitment to notify Customers of a
   personal-data breach, and no timeline. Processors are typically contractually
   bound to notify the controller "without undue delay" (often 48–72h). This
   belongs in the DPA but a pointer in the policy is advisable.
9. **AI processing not disclosed (critical).** No mention that uploaded
   documents/images or resident content may be transmitted to a third-party AI
   provider chosen by the Customer. See section 0. **Must be addressed.**
10. **Plaid / financial-data specificity.** "We do not store full card or bank
    numbers" is true but undersells that bank **transaction data** is pulled via
    Plaid. Consider a Plaid-specific disclosure (Plaid's end-user privacy policy
    is commonly surfaced at link time).
11. **Cookies / analytics / tracking.** No cookie or analytics disclosure. If
    any analytics or cookies are used (Vercel Analytics, etc.), CPRA/ePrivacy
    expect disclosure. Confirm whether any are in use.
12. **No data-subject contact for processor role beyond a generic mailbox.**
    Fine for now; counsel may want a privacy-specific address.

### 1c. Suggested edits (do NOT change legal meaning without counsel)
These are *proposals* for counsel, not applied to the live page.

- **Sub-processor list — proposed addition** (new `<H2>` after "How we share
  information"):
  > Current: "...service providers who process data on our behalf (such as
  > hosting, payment processing, email, and SMS delivery)..."
  >
  > Proposed (counsel to finalize): add a new section "Sub-processors" listing
  > Supabase (hosting/database/storage), Vercel (application hosting), Resend
  > (email), Plaid (bank-account connectivity), and any Customer-configured AI
  > provider, with a note that an up-to-date list is available on request /
  > at a linked URL.

- **AI disclosure — proposed addition** (new `<H2>`):
  > Proposed (counsel to finalize): "Some optional features use artificial-
  > intelligence services. When a Customer enables these features and provides
  > their own AI provider credentials, certain content (such as uploaded
  > documents or images) may be transmitted to that provider for processing at
  > the Customer's direction. The Customer selects the provider and is
  > responsible for that provider's terms."

- **Retention specificity — proposed replacement:**
  > Current: "We retain information for as long as needed to provide the
  > Services and as required by our agreements with Customers and applicable
  > law."
  >
  > Proposed (counsel to set the number): add "Following termination of a
  > Customer agreement, association data is deleted or returned within [N] days,
  > subject to legal retention requirements and routine backup cycles."

- No factual placeholder errors found on this page; product name "Portier369"
  is consistent. "Last updated" already advanced to **June 14, 2026** (applied).

---

## 2. Terms of Service (`/legal/terms`)

### 2a. What the page currently covers
- Acceptance / authority-to-bind on behalf of an organization.
- Description of the Services (accounting, work orders, violations,
  communications, owner/board/vendor portals; subscription basis governed by the
  order/Customer agreement).
- Accounts & access (invitation-provisioned, credential responsibility,
  role-based access).
- Acceptable use (no unauthorized access, no interference, no unlawful content,
  no reverse engineering except as permitted, no rights violations).
- Customer data (Customer owns submitted data; Portier369 processes per Privacy
  Policy + Customer agreement; Customer responsible for accuracy/lawfulness/
  consents).
- Payments & fees (fees per order; transaction processing by third parties;
  fees non-refundable except as required by law).
- Third-party services (hosting, payments, email, SMS, "optional AI features";
  governed by third-party terms; Portier369 not responsible).
- Intellectual property (Portier369 ownership; limited license to Customer).
- Disclaimers ("as is"/"as available"; no warranties; no legal/accounting/tax
  advice).
- Limitation of liability (no indirect/consequential damages; **cap = fees paid
  in trailing 12 months**).
- Termination (per subscription agreement; export before deletion).
- Changes; contact. Disclaimer present. ✔

### 2b. Gap analysis
1. **No governing law / venue clause.** No choice-of-law state, no venue. This is
   a primary "counsel-ready" omission. **Open question.**
2. **No dispute resolution / arbitration clause.** No arbitration vs. litigation
   choice, no class-action waiver, no jury-trial waiver. Counsel must decide.
   **Open question.**
3. **Liability cap is present but underspecified.** "Amounts paid in the twelve
   months preceding the claim" — counsel should confirm (a) whether a floor/
   alternative applies for free trials / pre-revenue Customers, and (b) whether
   carve-outs (IP indemnity, confidentiality breach, data-protection breach,
   gross negligence/willful misconduct) should sit *outside* the cap. None are
   present today.
4. **No indemnification section** (neither Portier369→Customer IP indemnity nor
   Customer→Portier369 for their unlawful data). Common in B2B SaaS.
5. **No SLA / uptime commitment.** Page is silent on availability. Even a "no
   uptime guarantee in these public Terms; SLA, if any, is in the order" pointer
   would clarify. If an SLA is promised in sales materials, it needs a home.
6. **AI features mentioned but not governed.** Terms list "optional AI features"
   under third-party services but give no AI-specific terms: no statement that
   the Customer brings its own key, no allocation of responsibility for AI
   output accuracy, no "do not rely on AI output as legal/compliance advice,"
   no prohibition on the AI provider training on Customer data. Given the BYOK
   architecture (section 0), this is thin. **Recommend an AI terms section.**
7. **Payment language is now slightly stale.** "Payment processing for
   assessments and other transactions is handled by third-party providers" reads
   as if residents pay online. In the current product, **resident assessment
   payment is offline remittance reconciled via bank feeds (no online card
   collection)**; the third-party processor that remains is Plaid (bank feeds)
   and possibly Stripe for *SaaS subscription billing of management companies*.
   Counsel should align this clause with the actual flow. (Flagged as factual,
   but rewording touches legal meaning, so left for counsel — not edited.)
8. **No confidentiality clause** for the parties (separate from the privacy
   posture). Often expected in B2B Terms or the underlying order.
9. **No data-protection/DPA incorporation by reference.** Terms should state the
   DPA is incorporated where personal data is processed.
10. **No "entire agreement / order of precedence" clause** reconciling these
    public Terms with the negotiated Customer order. Important because the page
    repeatedly defers to "the applicable subscription agreement."
11. **No assignment, force majeure, severability, notices, or survival clauses**
    — standard boilerplate currently absent.
12. **Export window not quantified** at termination ("may export their data in
    accordance with their agreement before deletion" — no time window).

### 2c. Suggested edits (proposals for counsel; not applied)
- **Governing law — proposed addition** (new `<H2>` near the end):
  > Proposed: "These Terms are governed by the laws of the State of [____],
  > without regard to conflict-of-laws rules. [Venue / arbitration clause to be
  > selected by counsel.]" — *requires the incorporation/governing-law decision
  > below.*

- **Liability cap carve-outs — proposed clarification:**
  > Current: "Our aggregate liability for any claim is limited to the amounts
  > paid for the Services in the twelve months preceding the claim."
  >
  > Proposed (counsel to finalize carve-outs): "...preceding the claim, except
  > for [Customer's payment obligations / a party's indemnification obligations /
  > breach of confidentiality / a party's gross negligence or willful
  > misconduct], which are [excluded from / subject to a separate] cap."

- **AI terms — proposed addition** (expand the third-party section or add `<H2>`
  "Artificial-intelligence features"):
  > Proposed: "Certain optional features use AI services configured by the
  > Customer under the Customer's own provider account and credentials. AI output
  > may be inaccurate and must not be relied upon as legal, accounting, tax, or
  > compliance advice. The Customer is responsible for reviewing AI output and
  > for its chosen provider's terms, including any data-use or model-training
  > terms."

- **Payment clause factual alignment — flagged for counsel (not edited):** the
  "payment processing for assessments" sentence should be reconciled with the
  offline-remittance reality. Because rewording it changes the meaning of a
  legal clause, it is left for counsel rather than edited in housekeeping.

- No outright factual placeholder errors (e.g., wrong product name) were found.
  "Last updated" advanced to **June 14, 2026** (applied).

---

## 3. Security (`/legal/security`)

### 3a. What the page currently covers
- Framing: handles sensitive financial + personal data; specifics available to
  prospects under NDA.
- Tenant isolation: row-level security enforced at the DB layer; scoped by
  portfolio + role.
- Access control: invitation-based, role-based, least privilege; platform-
  operator actions separated from association accounting; audit trail.
- Encryption: TLS in transit; "payment details handled by PCI-compliant
  third-party processors; we do not store full card or bank account numbers."
- Infrastructure: established cloud infra; automated backups + point-in-time
  recovery; providers hold their own certifications.
- Data portability: Customer export anytime; no lock-in.
- Vulnerability reporting: email `hello@portier369.com`; responsible disclosure
  appreciated.
- "Security evolves" note. (Counsel disclaimer **now added** — see edits.)

### 3b. Gap analysis
1. **Encryption at rest not stated.** Only "in transit" (TLS) is claimed. The
   data lives in Supabase/Postgres + object storage; counsel/security should
   confirm and, if true, add "encrypted at rest." Notably the **AI API key and
   payment-related fields** are stored — the AI settings UI claims the key is
   "stored encrypted"; confirm whether that is column-level encryption / Vault
   (project memory says Resend key lives in Supabase Vault — confirm whether the
   AI key does too) before any public encryption-at-rest claim is made.
2. **No certification posture.** "Providers maintain their own certifications"
   defers entirely to Supabase/Vercel. No statement of Portier369's own program
   (SOC 2 in progress? none yet?). HOA management buyers increasingly ask. State
   honestly — over-claiming here is a litigation risk. **Open question:** what,
   if anything, can be claimed.
3. **No breach / incident-response commitment.** No mention of an incident-
   response plan or breach-notification practice. Pairs with the Privacy/DPA gap
   (#8 above). Even a one-line "we maintain an incident-response process and will
   notify affected Customers without undue delay" would help (counsel to set
   timeline).
4. **No formal vulnerability-disclosure policy / safe-harbor.** A generic mailbox
   is fine to start, but there is no safe-harbor language for good-faith
   researchers, no scope, no response-time expectation.
5. **MFA / authentication strength unstated.** Auth is invitation + credential
   based; the page doesn't mention MFA availability or password policy. Confirm
   what exists (Supabase Auth supports MFA) and disclose accordingly.
6. **Plaid / banking-data handling not mentioned.** Given bank feeds, a line on
   how banking connectivity is secured (tokens via Plaid, no stored bank
   credentials) would strengthen the page and align with the Privacy disclosure.
7. **AI data-flow security not mentioned.** Same critical gap: document images
   leave the platform to a third-party AI provider. Security-conscious buyers
   will ask where their data goes.
8. **Backup retention / restoration testing.** "Automated backups + PITR" is
   stated but no retention period or restore-testing posture. The repo also
   contains a `backups/` directory with a seed-data JSON dump — confirm that no
   production resident data is committed to the repo (it appears to be seed/demo
   data, but counsel/security should verify the policy that prod data is never
   committed).
9. **Sub-processor security flow-down.** No statement that sub-processors are
   bound to comparable security obligations (ties to DPA).

### 3c. Suggested edits
- **Counsel disclaimer — APPLIED (housekeeping).** The Security page previously
  carried only a "security evolves" note and lacked the "not legal advice /
  pending counsel review" disclaimer that Privacy and Terms have. The standard
  disclaimer paragraph was added so all three pages are consistent. This adds a
  *cautionary* disclaimer only; it makes no substantive security claim. See
  section 5.
- **Encryption-at-rest — proposed (do NOT publish until verified):**
  > Current: "Data is encrypted in transit using industry-standard TLS."
  >
  > Proposed only if confirmed true: "Data is encrypted in transit using
  > industry-standard TLS and encrypted at rest by our infrastructure
  > providers." — *engineering/security must confirm before this goes live.*
- **Breach-response — proposed addition** (new `<H2>`), counsel to set timeline.
- No factual placeholder errors found; product name consistent. "Last updated"
  advanced to **June 14, 2026** (applied).

---

## 4. Open questions for counsel (consolidated)

**Corporate / jurisdiction**
1. Exact legal entity name and registered address to appear on the pages.
2. State (and country) of incorporation.
3. Governing-law state for the Terms.
4. Dispute resolution: litigation vs. binding arbitration; venue; class-action
   and jury-trial waivers — yes/no.

**Commercial risk allocation**
5. Liability cap: confirm 12-month trailing-fees cap; set a floor for
   trial/pre-revenue Customers; decide carve-outs (IP indemnity, confidentiality,
   data-breach, gross negligence/willful misconduct).
6. Indemnification: include mutual indemnities? Scope?
7. SLA / uptime: is any availability commitment made? If yes, where does it live
   (public Terms vs. order) and what are credits?

**Data protection**
8. Is a standalone DPA being produced, and should the Privacy Policy + Terms
   incorporate it by reference?
9. Sub-processor list: confirm final list and whether Stripe (SaaS billing) and
   an SMS provider are live. Publish as a list or maintained URL?
10. Breach-notification timeline to Customers (48h? 72h? "without undue delay"?).
11. GDPR scope: in or out? If any EU/UK data is plausible, decide on SCCs, an
    EU/UK representative, and transfer language.
12. CCPA/CPRA: add a California-specific section? Multi-state addendum for
    VCDPA/CPA/CTDPA/UCPA/TDPSA/etc., or rely on Customers as controllers?
13. Concrete retention periods and post-termination deletion/return window
    (including backups).

**AI**
14. How should AI processing be disclosed across Privacy + Terms (BYOK model;
    document images sent to customer-selected provider; no-reliance/no-advice
    language; provider-training restrictions)?
15. Confirm the technical truth of the "AI API key stored encrypted" claim
    before any public statement depends on it.

**Security claims**
16. What security posture can be truthfully claimed (encryption at rest? MFA?
    SOC 2 status? incident-response process?) — to avoid over-claiming.

**Payments**
17. Confirm and document that no resident cardholder data is collected/stored
    (offline remittance + Plaid bank feeds only), and align the Terms "payments"
    clause accordingly.

---

## 5. Page edits actually made in this pass (housekeeping only)

All three pages were verified with `npm run typecheck` (green) after editing.

| File | Change | Nature |
|---|---|---|
| `app/(marketing)/legal/privacy/page.tsx` | "Last updated" June 13 → **June 14, 2026** | Date refresh |
| `app/(marketing)/legal/terms/page.tsx` | "Last updated" June 13 → **June 14, 2026** | Date refresh |
| `app/(marketing)/legal/security/page.tsx` | "Last updated" June 13 → **June 14, 2026**; **added** the standard "not legal advice / recommend counsel review" disclaimer paragraph (kept the existing "security evolves" note) | Date refresh + add cautionary disclaimer for cross-page consistency |

No substantive legal clauses were rewritten. No legal commitments were invented.
Product name "Portier369" was already consistent across all three pages; no
placeholder/product-name errors were found.

---

## 6. Priority recommendation for counsel

If triaging, address in this order:
1. **AI disclosure** (Privacy + Terms) — undisclosed data flow of resident PII /
   document images to third-party AI providers. Highest exposure.
2. **Governing law, arbitration, and liability-cap carve-outs** (Terms) — the
   core "counsel-ready" gaps before signing a paying Customer.
3. **DPA + sub-processor list + breach-notification timeline** — required by
   sophisticated management-company buyers and most state privacy regimes for a
   processor.
4. **CCPA/CPRA + multi-state privacy posture**, then **GDPR scoping decision.**
5. **Security claims truthfulness** (encryption at rest, MFA, certifications)
   before publishing any stronger statement.
