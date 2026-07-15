// Data for /compare/[slug] pages. Rules: factual, publicly documented claims
// about competitors only; general pricing-model descriptions, never exact
// competitor prices (they change); always include an honest "when they're the
// better fit" section. Functionality comparison yes, copying their marketing
// expression no.

export type CompareRow = {
  dimension: string
  portier: string
  competitor: string
}

export type Competitor = {
  slug: string
  name: string
  /** one-line factual description of the competitor */
  whatItIs: string
  /** intro paragraph — answer-first for AI extraction */
  answer: string
  whySwitch: { title: string; body: string }[]
  table: CompareRow[]
  /** honest cases where the competitor is the better choice */
  whenTheyWin: string[]
  faq: { question: string; answer: string }[]
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'appfolio-alternative',
    name: 'AppFolio',
    whatItIs:
      'AppFolio Property Manager is a large, publicly traded property management platform built primarily for rental portfolios, with a community-associations offering alongside its leasing, screening, and marketing tools.',
    answer:
      'Portier369 is an AppFolio alternative built exclusively for HOA and condominium management — no leasing, screening, or rental tooling you pay for but never use. You get association fund accounting, the full violation notice-to-hearing lifecycle, architectural reviews, and six role-scoped portals, with transparent per-door pricing from $157/month, no implementation fees, and no long-term contract.',
    whySwitch: [
      {
        title: 'Built for associations, not adapted from rentals',
        body: 'AppFolio grew up managing rental portfolios; community associations are one segment of a much broader product. Portier369 does one thing: community association management. Violations with hearings and fines, architectural review workflows, board governance, and owner assessments are the core product, not a module.',
      },
      {
        title: 'Pricing you can put in a budget meeting',
        body: 'AppFolio prices per unit per month with monthly minimums and onboarding fees, and advanced capabilities sit in higher tiers. Portier369 is per-door from $157/month with everything included — every feature, every portal, no implementation fee, cancel anytime.',
      },
      {
        title: 'A portal for every seat at the table',
        body: 'Boards, owners, vendors, managers, company admins, and the platform operator each get a purpose-built workspace, scoped at the database level to exactly what that role should see. Board members get financial oversight without asking the manager to export reports.',
      },
      {
        title: 'Migration is part of the product',
        body: 'Guided data migration — associations, units, owners, vendors, open balances, and documents — is included. Teams switching from AppFolio are not rekeying their portfolio or paying a services invoice to leave.',
      },
    ],
    table: [
      { dimension: 'Primary focus', portier: 'HOA & condo associations only', competitor: 'Rental property management, with an associations segment' },
      { dimension: 'Pricing model', portier: 'Per-door from $157/mo, all features included', competitor: 'Per-unit with monthly minimums and tiered plans' },
      { dimension: 'Implementation fees', portier: 'None', competitor: 'Onboarding fees apply' },
      { dimension: 'Contract', portier: 'Month to month', competitor: 'Annual agreements are standard' },
      { dimension: 'Violation lifecycle', portier: 'Photo → notice → hearing → fine, fully automated', competitor: 'Violation tracking available' },
      { dimension: 'Architectural reviews', portier: 'Built-in workflow with owner messaging', competitor: 'Available within its associations offering' },
      { dimension: 'Portals', portier: 'Six role-scoped portals incl. board, owner, vendor', competitor: 'Owner and board access via its portal system' },
      { dimension: 'Accounting', portier: 'Double-entry GL, AR aging, budgets, bank reconciliation', competitor: 'Full accounting suite' },
      { dimension: 'Rental / leasing tools', portier: 'None — and you never pay for them', competitor: 'Extensive (core of the product)' },
      { dimension: 'AI assistance', portier: 'Role-scoped AI assistants for boards, owners, vendors, managers', competitor: 'AI features (AppFolio Realm) focused on rental workflows' },
    ],
    whenTheyWin: [
      'You manage rental units alongside associations and want one system for both',
      'You need in-house leasing, tenant screening, and vacancy marketing tools',
      'You prefer a large public-company vendor with a long enterprise track record',
    ],
    faq: [
      {
        question: 'Is Portier369 a good AppFolio alternative for HOA management companies?',
        answer:
          'Yes — if your portfolio is community associations (HOAs and condos), Portier369 covers the AppFolio capabilities association managers actually use: association accounting, violations with hearings, work orders, architectural reviews, and board/owner/vendor portals — without rental features or per-unit minimums. If you also manage rentals, AppFolio’s broader product may fit better.',
      },
      {
        question: 'Can I migrate from AppFolio to Portier369?',
        answer:
          'Yes. Guided migration is included: associations, units, owners, vendors, open balances, and documents are imported for you, so you keep your history and skip the rekeying.',
      },
      {
        question: 'How does Portier369 pricing compare to AppFolio?',
        answer:
          'Portier369 uses flat per-door pricing starting at $157/month with every feature included, no implementation fees, and no long-term contract. AppFolio prices per unit per month with monthly minimums, onboarding fees, and feature tiers — total cost depends heavily on portfolio size and tier.',
      },
    ],
  },
  {
    slug: 'buildium-alternative',
    name: 'Buildium',
    whatItIs:
      'Buildium is a RealPage-owned property management platform aimed mainly at residential rental portfolios, with an association-management capability that shares the rental product’s foundation.',
    answer:
      'Portier369 is a Buildium alternative purpose-built for community associations — HOA and condo management is the whole product, not a module on a rental platform. It covers fund accounting, the complete violation lifecycle with hearings, architectural reviews, preventive maintenance, and six role-scoped portals, at flat per-door pricing from $157/month with no implementation fees and no annual contract.',
    whySwitch: [
      {
        title: 'Association-first, not rentals-first',
        body: 'Buildium’s association features sit on a platform designed around leases, tenants, and rent cycles. Portier369 models what associations actually run on: assessments, violations with due process, architectural requests, board governance, and reserve-aware budgeting.',
      },
      {
        title: 'Everything in one plan',
        body: 'Buildium sells tiered plans where capabilities like open API access and premium support arrive at higher tiers, plus per-transaction add-ons. Portier369 has one answer: every feature, every portal, every report, included in per-door pricing from $157/month.',
      },
      {
        title: 'Boards and vendors are first-class users',
        body: 'Board members get financial visibility, violation oversight, and document access in their own portal; vendors get work orders, compliance tracking, and payment history in theirs. Nobody shares a login or waits for a manager to forward a PDF.',
      },
      {
        title: 'Modern, fast, and mobile-first',
        body: 'Portier369 is a modern web platform that works first-class on phones — owners pay assessments, submit requests, and upload insurance from a browser with no app download required, and a PWA/mobile app layer is available.',
      },
    ],
    table: [
      { dimension: 'Primary focus', portier: 'HOA & condo associations only', competitor: 'Residential rental management, with an associations capability' },
      { dimension: 'Ownership', portier: 'Independent', competitor: 'RealPage (acquired 2020)' },
      { dimension: 'Pricing model', portier: 'Per-door from $157/mo, all features included', competitor: 'Tiered plans (per-unit) with add-ons and transaction fees' },
      { dimension: 'Implementation fees', portier: 'None', competitor: 'Varies by plan and onboarding scope' },
      { dimension: 'Contract', portier: 'Month to month', competitor: 'Monthly or annual plans' },
      { dimension: 'Violation lifecycle', portier: 'Photo → notice → hearing → fine, fully automated', competitor: 'Violation tracking available' },
      { dimension: 'Architectural reviews', portier: 'Built-in workflow with owner messaging', competitor: 'Not a core workflow' },
      { dimension: 'Portals', portier: 'Six role-scoped portals incl. board, owner, vendor', competitor: 'Resident and association owner portals' },
      { dimension: 'Accounting', portier: 'Double-entry GL, AR aging, budgets, bank reconciliation', competitor: 'Full accounting suite' },
      { dimension: 'Rental / leasing tools', portier: 'None — and you never pay for them', competitor: 'Extensive (core of the product)' },
    ],
    whenTheyWin: [
      'You manage single-family rentals or mixed rental portfolios and want associations in the same system',
      'You want tenant screening, leasing funnels, and rental listings built in',
      'You specifically want a RealPage-ecosystem product',
    ],
    faq: [
      {
        question: 'Is Portier369 a good Buildium alternative for community associations?',
        answer:
          'Yes — for portfolios that are entirely HOAs and condos, Portier369 offers deeper association workflows (violations with hearings, architectural reviews, board portals) than a rentals-first platform, with flat per-door pricing and no annual contract. If you manage rentals too, Buildium’s rental tooling may matter more.',
      },
      {
        question: 'Can I migrate from Buildium to Portier369?',
        answer:
          'Yes. Guided migration is included — associations, units, owners, vendors, open balances, and documents come over without manual rekeying, so switching does not mean losing history.',
      },
      {
        question: 'What does Portier369 cost compared to Buildium?',
        answer:
          'Portier369 is per-door from $157/month with everything included and no implementation fees. Buildium uses tiered per-unit plans where several capabilities and lower transaction fees require higher tiers, so effective cost depends on plan choice and add-ons.',
      },
    ],
  },
  {
    slug: 'vantaca-alternative',
    name: 'Vantaca',
    whatItIs:
      'Vantaca is an HOA management platform aimed at professional community association management companies, known for its workflow automation engine and enterprise-style implementation programs.',
    answer:
      'Portier369 is a Vantaca alternative for management companies that want association-first software without an enterprise sales cycle: transparent per-door pricing from $157/month published right on the website, self-serve onboarding measured in days not months, and every capability — accounting, violations with hearings, architectural reviews, board approvals with e-signatures, AI assistance, and workflow automation (Flows) — included on every plan.',
    whySwitch: [
      {
        title: 'Days to live, not an implementation project',
        body: 'Vantaca deployments typically run through a structured, months-long implementation program. Portier369 ships with a guided onboarding checklist, CSV importers for owners, units, and balances, an operating-documents workflow, and white-glove setup on every tier — a first association can be live inside a week.',
      },
      {
        title: 'Pricing on the website, not after the discovery call',
        body: 'Vantaca pricing is quote-based. Portier369 publishes it: per-door from $157/month, everything included, unlimited owners, board members, and vendors, no implementation fee, month to month.',
      },
      {
        title: 'Automation on every tier',
        body: 'Portier369 Flows lets managers define trigger-to-action rules — overdue assessment → owner email → automatic late fee → manager alert — that run hourly with a full audit ledger. It is included for every customer, not positioned as an upsell.',
      },
      {
        title: 'Small companies are the target market, not the entry ring',
        body: 'Vantaca is strongest with large management companies. Portier369 is engineered so a 5-person company with 300 doors gets the same accounting integrity, portals, and automation an enterprise gets — at a price that fits that book of business.',
      },
    ],
    table: [
      { dimension: 'Primary focus', portier: 'HOA & condo management companies of any size', competitor: 'Larger professional management companies' },
      { dimension: 'Pricing model', portier: 'Published per-door pricing from $157/mo', competitor: 'Quote-based' },
      { dimension: 'Time to go live', portier: 'Days — guided self-serve + white-glove setup', competitor: 'Structured implementation program (typically months)' },
      { dimension: 'Contract', portier: 'Month to month', competitor: 'Term agreements are standard' },
      { dimension: 'Workflow automation', portier: 'Flows engine included on every plan', competitor: 'Workflow engine is a core strength' },
      { dimension: 'Violation lifecycle', portier: 'Photo → notice → hearing → fine, with mobile field capture', competitor: 'Violation management available' },
      { dimension: 'Architectural reviews', portier: 'Built-in with document uploads and owner messaging', competitor: 'Available' },
      { dimension: 'Board sign-off', portier: 'Digital approvals with real e-signatures', competitor: 'Board approval tooling available' },
      { dimension: 'AI assistance', portier: 'Included, bring-your-own-model — no AI surcharge', competitor: 'AI capabilities offered within its platform' },
      { dimension: 'Accounting', portier: 'Double-entry GL, budgets, automatic late fees, reconciliation', competitor: 'Full association accounting suite' },
    ],
    whenTheyWin: [
      'You run thousands of doors and want a vendor whose implementation team project-manages a long enterprise rollout',
      'Your processes are already built around Vantaca’s workflow engine and retraining costs outweigh savings',
      'You want a large ecosystem of established banking and lockbox integrations negotiated at enterprise scale',
    ],
    faq: [
      {
        question: 'Is Portier369 a good Vantaca alternative for smaller management companies?',
        answer:
          'Yes — that is the core use case. Portier369 delivers association accounting, violations with hearings, architectural reviews, board approvals, and workflow automation with published per-door pricing from $157/month and onboarding measured in days, which suits companies from 50 to 1,000 doors. Very large operations invested in Vantaca’s enterprise implementation model may prefer to stay.',
      },
      {
        question: 'Does Portier369 have workflow automation like Vantaca?',
        answer:
          'Yes. Flows is a trigger-to-action automation engine — for example, a dues charge 15 days overdue can automatically email the owner, assess the configured late fee, and alert the manager. It runs hourly, fires at most once per subject, keeps a full run ledger, and is included on every plan.',
      },
      {
        question: 'Can I migrate from Vantaca to Portier369?',
        answer:
          'Yes. Guided migration is included: associations, units, owners, vendors, open balances, and documents are imported with you, so leaving an enterprise platform does not mean a services invoice or lost history.',
      },
    ],
  },
  {
    slug: 'cinc-systems-alternative',
    name: 'CINC Systems',
    whatItIs:
      'CINC Systems is a cloud platform for community association management companies with deeply integrated banking — its accounting product is built around partnerships with association-focused banks.',
    answer:
      'Portier369 is a CINC Systems alternative for management companies that want modern association software without coupling it to a banking relationship: transparent per-door pricing from $157/month, a modern six-portal experience for managers, boards, owners, and vendors, automation and AI included, and your choice of bank — with read-only feeds and reconciliation instead of platform lock-in.',
    whySwitch: [
      {
        title: 'Your software choice shouldn’t pick your bank',
        body: 'CINC’s model is strongest when you adopt its partner-banking relationships. Portier369 connects to the accounts you already have — bank feeds, auto-matching, and reconciliation work with your institutions, and moving software never means moving the association’s money.',
      },
      {
        title: 'A portal experience owners compliment',
        body: 'Portier369’s owner, board, and vendor portals are modern, mobile-first, and white-labeled to the management company — owners pay assessments, file requests with photos, upload insurance, and see the same association calendar the board sees.',
      },
      {
        title: 'Published pricing, month to month',
        body: 'CINC pricing is quote-based. Portier369 is per-door from $157/month, every feature included, no implementation fee, cancel anytime.',
      },
      {
        title: 'Automation and AI without surcharges',
        body: 'Automatic late fees, insurance-expiry reminders, owner status notifications, workflow Flows, and AI drafting (violation letters, communications, invoice extraction) are included — on any AI model you choose.',
      },
    ],
    table: [
      { dimension: 'Primary focus', portier: 'HOA & condo management companies', competitor: 'Association management companies, banking-integrated' },
      { dimension: 'Banking', portier: 'Works with your existing banks (feeds + reconciliation)', competitor: 'Built around integrated partner banking' },
      { dimension: 'Pricing model', portier: 'Published per-door from $157/mo, all-inclusive', competitor: 'Quote-based' },
      { dimension: 'Contract', portier: 'Month to month', competitor: 'Term agreements are standard' },
      { dimension: 'Portals', portier: 'Six role-scoped portals, white-labeled, mobile-first', competitor: 'Owner/board portals and mobile apps available' },
      { dimension: 'Violation lifecycle', portier: 'Photo → notice → hearing → fine, with GPS field capture', competitor: 'Violation management available' },
      { dimension: 'Architectural reviews', portier: 'Built-in workflow with plan uploads and messaging', competitor: 'Available' },
      { dimension: 'Workflow automation', portier: 'Flows engine included', competitor: 'Automation capabilities within its suite' },
      { dimension: 'AI assistance', portier: 'Included, bring-your-own-model', competitor: 'AI features offered (e.g., for accounting workflows)' },
      { dimension: 'Accounting', portier: 'Double-entry GL, budgets, automatic late fees', competitor: 'Full association accounting, banking-centric' },
    ],
    whenTheyWin: [
      'You want banking and software from one vendor and value CINC’s bank-partnership model',
      'Your lockbox/payment operations are already built around CINC’s banking rails',
      'You are a very large firm negotiating enterprise terms where the banking economics offset software cost',
    ],
    faq: [
      {
        question: 'Is Portier369 a good CINC Systems alternative?',
        answer:
          'Yes, if you want association-first software that is independent of any banking relationship: modern portals, full association accounting, violations, architectural reviews, and automation with published per-door pricing from $157/month. If integrated partner banking is the main draw, CINC’s model may fit better.',
      },
      {
        question: 'Do I have to change banks to use Portier369?',
        answer:
          'No. Portier369 connects to the accounts your associations already hold — transaction feeds, auto-matching, and reconciliation — so adopting or leaving the software never disturbs the association’s banking.',
      },
      {
        question: 'Can I migrate from CINC Systems to Portier369?',
        answer:
          'Yes. Guided migration is included — associations, units, owners, vendors, open balances, and documents are imported with you, and month-to-month terms mean you are never locked in after the move.',
      },
    ],
  },
  {
    slug: 'tops-one-alternative',
    name: 'TOPS [ONE] (Enumerate)',
    whatItIs:
      'TOPS [ONE], now part of Enumerate, is one of the longest-standing community association management and accounting platforms, widely deployed at established management companies since the on-premise era.',
    answer:
      'Portier369 is a modern TOPS [ONE] / Enumerate alternative: the association accounting depth legacy shops rely on — double-entry GL, budgets, AR aging, automatic late fees — rebuilt as a fast, mobile-first web platform with six white-labeled portals, workflow automation, and AI assistance, at published per-door pricing from $157/month with migration included.',
    whySwitch: [
      {
        title: 'Leave the legacy stack without losing the ledger',
        body: 'TOPS earned its install base on accounting. Portier369 keeps that bar — database-enforced double-entry, closed-period guards, budget vs actual, reconciliation — and adds what legacy platforms bolt on: modern portals, one-click exports, and automation.',
      },
      {
        title: 'An owner experience from this decade',
        body: 'Owners and boards get fast, mobile-first portals under the management company’s brand: assessments, ledgers with print/CSV/PDF export, violations, architectural requests with document uploads, and a shared association calendar. No plugins, no desktop client, no app-store dependency.',
      },
      {
        title: 'Automation instead of data entry',
        body: 'Automatic late fees, insurance-expiry reminders, owner status notifications, and the Flows trigger-to-action engine cut the manual chase work that legacy workflows normalize.',
      },
      {
        title: 'Simple, published pricing',
        body: 'Per-door from $157/month, everything included, no modules, no implementation fee, month to month — versus quote-based legacy contracts and paid add-on modules.',
      },
    ],
    table: [
      { dimension: 'Product generation', portier: 'Modern cloud, mobile-first web', competitor: 'Long-standing platform with legacy roots (now Enumerate)' },
      { dimension: 'Pricing model', portier: 'Published per-door from $157/mo, all-inclusive', competitor: 'Quote-based; modules and add-ons' },
      { dimension: 'Contract', portier: 'Month to month', competitor: 'Term agreements are standard' },
      { dimension: 'Portals', portier: 'Six role-scoped, white-labeled portals', competitor: 'Owner/board portal offerings available' },
      { dimension: 'Accounting', portier: 'Double-entry GL, budgets, automatic late fees, closed periods', competitor: 'Deep association accounting (its historical strength)' },
      { dimension: 'Violation lifecycle', portier: 'Photo → notice → hearing → fine, mobile field capture w/ GPS', competitor: 'Violation tracking available' },
      { dimension: 'Architectural reviews', portier: 'Built-in with uploads, messaging, board sign-off', competitor: 'Available' },
      { dimension: 'Workflow automation', portier: 'Flows engine included', competitor: 'Varies by module' },
      { dimension: 'AI assistance', portier: 'Included, bring-your-own-model', competitor: 'Limited' },
      { dimension: 'Exports & reporting', portier: '~119 reports; print/CSV/branded-PDF everywhere', competitor: 'Established report library' },
    ],
    whenTheyWin: [
      'Decades of history live in TOPS and your team’s processes are built around it — the retraining cost is real',
      'You rely on specific Enumerate ecosystem services (e.g., its payments or print/mail offerings) already under contract',
      'You want the vendor with the longest tenure in community association software',
    ],
    faq: [
      {
        question: 'Is Portier369 a good TOPS [ONE] or Enumerate alternative?',
        answer:
          'Yes — Portier369 matches the association accounting depth (double-entry GL, budgets, AR aging, late fees) and adds modern portals, automation, AI, and published per-door pricing from $157/month. Long-tenured TOPS shops with heavy process lock-in should weigh retraining cost against the gains.',
      },
      {
        question: 'Can Portier369 import my TOPS/Enumerate data?',
        answer:
          'Guided migration is included: associations, units, owners, vendors, open balances, and documents are imported with you. Historical ledgers can be brought over as opening balances plus archived exports so nothing is lost.',
      },
      {
        question: 'Why do management companies leave legacy platforms like TOPS?',
        answer:
          'The most common reasons we hear: a dated owner/board experience, manual work that modern automation eliminates, module-based pricing, and difficulty hiring staff onto older software. Portier369 addresses each directly — modern white-labeled portals, automatic late fees and reminders, one all-inclusive price.',
      },
    ],
  },
  {
    slug: 'payhoa-alternative',
    name: 'PayHOA',
    whatItIs:
      'PayHOA is self-managed-HOA software: an affordable, single-community tool centered on dues collection, invoicing, communication, and basic records for volunteer boards.',
    answer:
      'Portier369 is a PayHOA alternative for associations and managers who have outgrown a single-community payments tool: full double-entry fund accounting, violations with hearings, architectural reviews with document uploads, board approvals with e-signatures, vendor management, and automation — from $157/month, and built to run one association or a whole management company’s portfolio.',
    whySwitch: [
      {
        title: 'Real fund accounting, not just payments',
        body: 'PayHOA centers on collecting dues. Portier369 runs the books: double-entry GL, budgets vs actuals, AR aging, automatic late fees, bank reconciliation, closed periods, and ~119 reports with print/CSV/PDF export — the records an audit or a lawsuit actually asks for.',
      },
      {
        title: 'Governance workflows built in',
        body: 'Violations with photo evidence, notices, hearings and fines; architectural requests with plans attached and board sign-off; meeting minutes; operating documents on file. Volunteer boards get due process without building it from email threads.',
      },
      {
        title: 'Grows from one association to a management company',
        body: 'PayHOA is designed per-community. Portier369 is multi-association from the ground up — if your self-managed community later hires a manager, or a volunteer starts managing three neighboring associations, the platform scales instead of being replaced.',
      },
      {
        title: 'White-glove help included',
        body: 'Guided onboarding, data import, and operating manuals ship with every plan — a volunteer treasurer is not left alone with a CSV template.',
      },
    ],
    table: [
      { dimension: 'Primary focus', portier: 'Associations and management companies (1 to many)', competitor: 'Single self-managed communities' },
      { dimension: 'Accounting', portier: 'Double-entry GL, budgets, reconciliation, closed periods', competitor: 'Payments, invoicing, and financial tracking' },
      { dimension: 'Violation lifecycle', portier: 'Photo → notice → hearing → fine', competitor: 'Violation tracking available' },
      { dimension: 'Architectural reviews', portier: 'Built-in workflow with uploads and messaging', competitor: 'Basic request handling' },
      { dimension: 'Board approvals', portier: 'Digital approvals with e-signatures and audit trail', competitor: 'Not a core workflow' },
      { dimension: 'Vendor management', portier: 'Vendor portal, work orders, compliance tracking', competitor: 'Limited' },
      { dimension: 'Automation', portier: 'Flows engine, automatic late fees, expiry reminders', competitor: 'Recurring invoicing and reminders' },
      { dimension: 'Multi-association', portier: 'Portfolio-native with company admin oversight', competitor: 'Per-community design' },
      { dimension: 'Pricing model', portier: 'Per-door from $157/mo, all-inclusive', competitor: 'Per-community subscription sized by units' },
      { dimension: 'White-label', portier: 'Every owner touchpoint carries your brand', competitor: 'PayHOA-branded experience' },
    ],
    whenTheyWin: [
      'You are one small self-managed HOA that mainly needs online dues collection and a simple ledger at the lowest possible price',
      'A volunteer board wants the lightest possible tool and accepts basic workflows',
      'You have no plans to professionalize management or grow beyond one community',
    ],
    faq: [
      {
        question: 'Is Portier369 a good PayHOA alternative for self-managed HOAs?',
        answer:
          'Yes, when the association needs more than dues collection: real double-entry accounting, violations with due process, architectural review workflows, board e-sign approvals, and vendor management. The Foundation plan at $157/month covers self-managed associations up to 200 units. A very small community that only needs payments may find PayHOA’s scope sufficient.',
      },
      {
        question: 'Can Portier369 handle multiple associations?',
        answer:
          'Yes — that is its architecture. One login can run a whole portfolio of associations with company-level oversight, per-association books, and role-scoped portals for every board, owner, and vendor. PayHOA is designed around a single community.',
      },
      {
        question: 'How hard is it to switch from PayHOA to Portier369?',
        answer:
          'Guided migration is included: owners, units, and open balances import from CSV, operating documents get a built-in checklist, and white-glove setup on every plan means a volunteer board is walked through it — typically live within a week.',
      },
    ],
  },
]

export function getCompetitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug)
}
