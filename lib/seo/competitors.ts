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
]

export function getCompetitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug)
}
