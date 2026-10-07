// The staff guides (Manager Runbook, Company Admin Guide), written once and
// rendered per company: {company} is the management company's name and
// {address} its own sign-in address, filled in when the PDF is generated
// (lib/guides/pdf.ts). White label: the guides never name the platform; only
// the PDF footer carries the allowed "Powered by Portier369" credit.

export type GuideBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'table'; head: [string, string]; rows: [string, string][] };

export type GuideSection = { title: string; blocks: GuideBlock[] };

export type Guide = {
  slug: 'manager-runbook' | 'company-admin-guide';
  title: string;
  subtitle: string;
  version: string;
  sections: GuideSection[];
};

const p = (text: string): GuideBlock => ({ kind: 'paragraph', text });
const h = (text: string): GuideBlock => ({ kind: 'heading', text });
const ul = (...items: string[]): GuideBlock => ({ kind: 'bullets', items });

export const MANAGER_RUNBOOK: Guide = {
  slug: 'manager-runbook',
  title: 'Manager Operations Runbook',
  subtitle: 'The day-to-day guide for property managers',
  version: 'Version 1.2 — October 2026',
  sections: [
    {
      title: 'Getting Started',
      blocks: [
        h('Signing in'),
        ul(
          'Go to {address} and sign in.',
          'Enter your work email and password. Staff accounts are invitation-based: your company admin creates your account and you receive an email with a link to set your password. You can always find this Runbook on the Onboarding page.',
          'Forgot your password? Click Forgot password? on the sign-in page and a reset link is emailed to you. Your company admin can also issue a temporary password from Settings.',
        ),
        h('The workspace'),
        p('Everything lives in the left sidebar. The right-hand Tasks rail shows quick actions and context for the page you are on. On a phone, the sidebar collapses behind the menu button: the whole workspace is mobile-friendly, and owners can install their portal on their home screen like an app.'),
      ],
    },
    {
      title: 'Your Day',
      blocks: [
        ul(
          'Dashboard: your morning screen, with open work orders, violations, delinquencies, and what needs attention today.',
          'Reminders: due and upcoming items across every association you manage.',
          'Calendar: meetings, vendor visits, and maintenance events in one view.',
          'AI Assistant: ask questions in plain English ("who is delinquent at Granville?"). It answers from live portfolio data.',
        ),
      ],
    },
    {
      title: 'Associations',
      blocks: [
        h('Set up each association correctly (one-time, 10 minutes)'),
        p('Open Associations → Directory, pick the association, then the Profile tab. Three things on this tab drive the owner experience:'),
        ul(
          'Assigned manager (Site Manager). Select yourself or the responsible manager. This is where owner-portal messages for this association are delivered. If left unassigned, messages fall back to the company admins.',
          'Payment instructions. "Make checks payable to", the remittance address, and any bill-pay notes. This text is exactly what owners see on their How to Pay page, so keep it accurate.',
          'Online payments (optional). On the Payments tab, connect the association\'s own Stripe account so owners can pay online; funds settle directly to the association\'s bank account.',
        ),
        h('Operating documents (required for every association)'),
        p('The association\'s Documents tab holds its governing documents, with a required checklist: Declaration / CC&Rs, Bylaws, Articles of Incorporation, and Rules & Regulations (plus the optional Current Operating Budget and Master Insurance Policy).'),
        ul(
          'Upload or replace one file at a time (max 10 MB); a chip shows "N of 4 required on file", and a general documents list sits below.',
          'Everything you upload here appears automatically under Governing Documents in the owner and board portals, with no extra sharing step.',
          'Onboarding step 4 requires all four for every association; the Onboarding page links straight to any association still missing documents.',
        ),
        h('Units, parking, and data import'),
        ul(
          'Manage units and parking under Associations → Units / Parking.',
          'Onboarding a new association? Associations → Import data (CSV) imports owners, units, and opening balances in one pass.',
        ),
      ],
    },
    {
      title: 'Owner Messages & Communication',
      blocks: [
        h('How owner messages reach you'),
        p('When an owner taps Send a message in their portal, you receive a normal email in your regular inbox. The subject is prefixed [Owner message], the sender is identified with their unit ("Liam Landlord (Unit 102)"), and Reply-To is the owner\'s email address, so just hit Reply in Outlook or Gmail. There is no separate inbox to monitor.'),
        h('Email presents as {company}'),
        p('All automated owner- and vendor-facing email (insurance and maintenance reminders, password resets, vendor blasts) presents as {company}: replies come back to you as the assigned manager (or the company support inbox), and signatures use the company name. Make sure your admin has filled in Company Name and Support Email under Settings; that is what owners see.'),
        h('Outbound communication'),
        ul(
          'Communication → Center: announcements and blasts to owners, with delivery history.',
          'Communication → Send email / Letters: one-off email or generated letters (AI-assisted drafting available).',
          'Communication → SMS: texts are recorded today; live text delivery starts when the company connects a texting number.',
        ),
      ],
    },
    {
      title: 'Work Orders',
      blocks: [
        p('Track every job under Maintenance → Work Orders. Statuses flow: new → assigned → scheduled → in progress → done/completed → billed → closed. Priorities: low, normal, high, emergency.'),
        ul(
          'Create: New work order → pick the association (and unit if owner-specific) → describe the issue, or convert an owner\'s portal request.',
          'Assign: pick the vendor; they see it instantly in their own vendor portal and update status from the field.',
          'Schedule: set the date; it appears on your calendar, the vendor\'s schedule, and the owner\'s portal.',
          'Close: mark it done, attach the vendor bill under Payables, and the owner sees the resolution in their portal.',
        ),
      ],
    },
    {
      title: 'Violations',
      blocks: [
        p('The full lifecycle is automated under Violations:'),
        ul(
          'Record the violation with photos (from your phone, on-site).',
          'Generate the notice letter from a template (AI drafting available) and send it; it is logged automatically.',
          'Schedule a hearing if it escalates; owners see hearing details in their portal.',
          'Assess fines where authorized; they post to the owner\'s ledger.',
        ),
      ],
    },
    {
      title: 'Architectural Reviews',
      blocks: [
        p('Owners submit ARC requests from their portal. Your queue is Architectural Reviews in the sidebar: approve, deny, or request more information. Each request has a built-in message thread with the owner, so the whole conversation stays attached to the request. Board members see the same queue read-only in their portal.'),
        h('Supporting documents'),
        ul(
          'After submitting, owners upload supporting documents (plans, drawings, contractor quotes, photos) one at a time on the request\'s detail page, up to 10 documents of max 10 MB each. Uploading one by one keeps large plan sets from failing.',
          'You can add or remove documents yourself on the request\'s review page, which is useful when the owner emails you a file instead.',
          'Board members see the documents read-only alongside the request.',
        ),
      ],
    },
    {
      title: 'Owner Insurance (HO6)',
      blocks: [
        p('The Insurance page tracks every owner\'s HO6 policy: owner, unit, carrier, coverage, the policy period (start to end, with days left), a View link to the uploaded policy document, and status.'),
        ul(
          'Owners submit their own policies from their portal (Insurance): carrier and policy details, required Policy Start / End dates, and the policy document itself (PDF or photo, max 10 MB). Uploads are filed into the association\'s records automatically.',
          'Automatic expiration reminders go out by email 30 and 15 days before the policy end date, to the owner and to the association\'s assigned manager. Each window sends once; the check runs daily.',
          'Per-policy reminder toggles: each row on the Insurance page has Owner and Manager chips; click one to switch that reminder on or off for that policy. Owners can also manage their own reminder preference from the Expiration Reminders card in their portal.',
        ),
      ],
    },
    {
      title: 'Preventive Maintenance, Inspections & Inventory',
      blocks: [
        ul(
          'Maintenance → Preventive: recurring and seasonal tasks (fire alarm inspections, boiler service) with automated reminders before deadlines.',
          'Maintenance → Inventory: track association-owned equipment and supplies.',
          'Lock Boxes: key and lockbox custody per association.',
        ),
      ],
    },
    {
      title: 'Money: What Managers Touch',
      blocks: [
        p('Full accounting (journal entries, general ledger, budgets) is double-entry under Accounting. Day to day, managers mostly use:'),
        ul(
          'Receivables: owner charges and balances; record checks received.',
          'Payables: vendor bills tied to work orders, through approval to payment.',
          'Command Center: live collections, deposits, reconciliation status, and exceptions once online payments are active.',
          'Budget vs Actuals: per-association performance; the board sees a scoped version of the same numbers.',
        ),
      ],
    },
    {
      title: 'Meetings, Board & Documents',
      blocks: [
        ul(
          'Meetings: schedule board and annual meetings with agendas; they appear on board and owner calendars.',
          'Board Approvals: send items for a board vote; members vote digitally from their portal.',
          'Documents: the association file cabinet. Generate creates letters and notices from templates; everything is shared to the right portals automatically. Governing documents (CC&Rs, bylaws) live on each association\'s Documents tab (see Associations).',
        ),
      ],
    },
    {
      title: 'Reports',
      blocks: [
        ul(
          'Reports: the standard library (delinquency, A/R aging, violations, work orders, financials).',
          'Report Builder: build and save your own.',
          'Metrics: portfolio KPIs at a glance.',
        ),
      ],
    },
    {
      title: 'Quick Reference',
      blocks: [
        { kind: 'note', title: 'White-glove principle', text: 'Owners and board members should never need to learn the system to reach you. They tap one button; you get a normal email. Your job is to keep the data current so their portals answer questions before they have to ask.' },
        h('Routing rule'),
        p('Messages go to the association\'s Assigned Manager (Profile tab). With no manager assigned they go to the company admins, then to the company support email. Every inbound message is also recorded in the communications log.'),
        h('Emergencies'),
        p('Anything marked Emergency surfaces on your dashboard, the board dashboard, and the vendor\'s alert banner. Use it only for true emergencies (active leak, no heat, life safety).'),
        {
          kind: 'table',
          head: ['I need to…', 'Go to'],
          rows: [
            ['See what needs attention today', 'Dashboard'],
            ['Answer an owner\'s message', 'Your email inbox (just hit Reply)'],
            ['Assign who gets owner messages', 'Association → Profile → Site Manager'],
            ['Change what owners see on How to Pay', 'Association → Profile → Payment Instructions'],
            ['Turn on online payments', 'Association → Payments tab (Stripe onboarding)'],
            ['Upload an association\'s governing documents', 'Association → Documents tab'],
            ['Log a violation with photos', 'Violations → New'],
            ['Dispatch a plumber', 'Maintenance → Work Orders → assign vendor'],
            ['Approve an owner\'s ARC request', 'Architectural Reviews'],
            ['Add documents to an ARC request', 'Architectural Reviews → open the request → Supporting Documents'],
            ['See expiring owner insurance', 'Insurance (policy period and days left)'],
            ['Toggle insurance reminder emails', 'Insurance → Owner / Manager chips on the policy row'],
            ['Send an announcement to all owners', 'Communication → Center'],
            ['Give the board something to vote on', 'Association → Approvals'],
            ['Import a new association\'s data', 'Associations → Import data (CSV)'],
            ['Invite portal access for an owner', 'People → owner record → invite / Owner Portal Activation'],
            ['Ask anything about your portfolio', 'AI Assistant'],
          ],
        },
      ],
    },
  ],
};

export const COMPANY_ADMIN_GUIDE: Guide = {
  slug: 'company-admin-guide',
  title: 'Company Admin Guide',
  subtitle: 'Setup, people, and oversight for {company}',
  version: 'Version 1.2 — October 2026',
  sections: [
    {
      title: 'Your Role',
      blocks: [
        p('As company admin you run {company}: people, settings, and oversight across every association. Managers run daily operations; you set them up, watch performance, and step in with the executive views. You sign in at {address}.'),
      ],
    },
    {
      title: 'First-Week Setup Checklist',
      blocks: [
        ul(
          'Company settings (Settings): company name, logo and branding, and, critically, the Company Name, Support Email, and Support Phone. These appear on every owner\'s dashboard contact card, are the final fallback for owner messages, and brand every email sent on your behalf (see White-Label Email). Fill in all three before inviting anyone.',
          'Invite your managers (Company Admin → Managers, or Settings → Invite a staff member): enter their email; they receive an invitation link to set their password. Invites sent from Company Admin → Managers also link the Manager Runbook, which every manager can open from the Onboarding page. Pending invitations are listed with expiry dates.',
          'Create associations and import their data (owners, units, opening balances) via CSV import, or have managers do it.',
          'Upload each association\'s operating documents (association → Documents tab): Declaration / CC&Rs, Bylaws, Articles of Incorporation, and Rules & Regulations are required; the current operating budget and master insurance policy are optional. Onboarding is not complete until every association has all four required documents on file (see Association Operating & Governing Documents).',
          'Assign a Site Manager on every association (association → Profile tab). This decides which manager receives owner-portal messages. Unassigned associations route messages to you.',
          'Payment instructions per association (same Profile tab): what owners see on How to Pay. For online payments, complete Stripe onboarding on the association\'s Payments tab; each association connects its own Stripe account and funds settle to its own bank.',
          'Invite owners and board members: owners are invited from their owner record (portal activation is tracked under Owner Portal Activation); mark board members as such so they receive the board portal.',
          'Set the AI key (Settings → AI) to switch on AI features across your company: violation letters, the communications copilot, and the role assistants.',
        ),
      ],
    },
    {
      title: 'Your Operating Documents & the Onboarding Page',
      blocks: [
        p('The Onboarding page tracks your setup from first sign-in to launch: create an association, add units, add owners, upload operating documents, and invite your team, with a progress bar across the top. It leads with a Your operating documents card linking this Company Admin Guide and the Manager Runbook as PDFs. Keep them open while you set up; they are also linked in your welcome email, so they work even before your first sign-in.'),
      ],
    },
    {
      title: 'People & Access',
      blocks: [
        ul(
          'Roles: Company Admin → Manager → Board / Owner → Vendor. Every account is invitation-based; there is no public sign-up.',
          'Managers page: each manager\'s workload and portfolio.',
          'Password resets: anyone can self-serve with Forgot password on the sign-in page; you can also issue a temporary password from Settings for any staff member.',
          'Vendors: invite vendors so they get their own portal with assignments, schedule, status updates from the field, and payment visibility. No more phone tag.',
        ),
      ],
    },
    {
      title: 'The Executive Suite',
      blocks: [
        p('Your sidebar is a command deck across the whole company:'),
        {
          kind: 'table',
          head: ['Page', 'What it answers'],
          rows: [
            ['Overview', 'Executive dashboard: doors, owners, emergencies, collections, per-property health scores'],
            ['AI Command Center', 'Rule-based insights: what needs attention now, trends, expiring contracts'],
            ['Performance', 'Manager rankings: resolution speed, closed volume, inspection completion'],
            ['Portfolio Health', 'Health scores across every association'],
            ['Financials', 'Company-wide income and expense, A/R, delinquencies, budget vs actual'],
            ['Command Center', 'Payment operations: collections today, pending ACH, reconciliation, exceptions'],
            ['Compliance', 'Vendor COIs and licenses expiring, W-9 gaps, statutory inspections due'],
            ['Work Orders / Violations / ARC', 'Company-wide oversight of operations'],
            ['Billing & Doors / Revenue', 'Your subscription usage and management-fee revenue'],
            ['Communications', 'Everything sent, company-wide'],
            ['Audit Logs', 'Who did what, when'],
          ],
        },
      ],
    },
    {
      title: 'How Owner Messages Flow (and Where You Fit)',
      blocks: [
        p('Owners message from their portal; the assigned manager gets it as a regular email with Reply-To set to the owner. You are the fallback: if an association has no Site Manager assigned, those messages come to the company admins. Watch the Communications page for volume and gaps; a spike from one association usually means something needs attention there.'),
      ],
    },
    {
      title: 'White-Label Email: Everything Sends As {company}',
      blocks: [
        p('Every owner- and vendor-facing email (insurance expiration reminders, maintenance reminders, password resets, vendor blasts) presents as {company}, never as the software vendor:'),
        ul(
          'The sender name is your Company Name from Settings.',
          'Reply-To is the assigned manager for that association, or your support inbox when no manager applies, so replies land with a person, never a no-reply address.',
          'Signatures use your company name.',
          'Once your own sending domain is verified, mail is sent from your domain; until then it uses a verified shared domain, so deliverability (SPF/DKIM) is already handled with nothing for your IT to configure.',
        ),
        { kind: 'note', title: 'Do this first', text: 'White-labeling only works if Settings → Company Name, Support Email, and Support Phone are filled in. Fill in all three before inviting your first owner.' },
      ],
    },
    {
      title: 'Association Operating & Governing Documents',
      blocks: [
        p('Every association has a Documents tab (association → Documents) with a required checklist, so no client goes live without its governing documents on file:'),
        ul(
          'Required: Declaration / CC&Rs, Bylaws, Articles of Incorporation, Rules & Regulations.',
          'Optional: Current Operating Budget, Master Insurance Policy.',
          'Upload or replace one file at a time (max 10 MB); a status chip shows "N of 4 required on file" at a glance, and a general documents list with upload sits below the checklist.',
          'Uploads appear automatically under Governing Documents in the owner and board portals, with no extra sharing step.',
          'Onboarding step 4 (Upload operating documents) lists each association still missing required documents, with direct links, and only completes when every client has all four.',
        ),
      ],
    },
    {
      title: 'Financial Guardrails',
      blocks: [
        ul(
          'Money is double-entry throughout; every owner payment, charge, and vendor bill posts to journals, auditable under Audit Logs and reportable under Financials.',
          'Online payments use per-association Stripe accounts: each association\'s dues settle directly to its own bank account. Company funds and association trust funds are never commingled.',
          'Bank accounts carry fund types (operating, reserve, special assessment); cross-fund transfers require explicit authorization.',
        ),
      ],
    },
    {
      title: 'Quick Reference',
      blocks: [
        { kind: 'note', title: 'The one setting people forget', text: 'Site Manager on each association. It is the difference between owner messages landing with the right manager and piling into your own inbox.' },
        {
          kind: 'table',
          head: ['I need to…', 'Go to'],
          rows: [
            ['Add a new manager', 'Settings → Invite a staff member'],
            ['Reset someone\'s password', 'Settings (temporary password), or have them use Forgot password'],
            ['Set the support email owners see', 'Settings → Support Email'],
            ['Control how owner emails are branded', 'Settings → Company Name / Support Email / Support Phone'],
            ['Route owner messages to the right manager', 'Association → Profile → Site Manager'],
            ['Upload an association\'s governing documents', 'Association → Documents tab'],
            ['See which manager is falling behind', 'Performance'],
            ['Check company-wide cash position', 'Financials / Command Center'],
            ['Verify vendor insurance is current', 'Compliance'],
            ['See everything sent to owners', 'Communications'],
            ['Review a staff action', 'Audit Logs'],
            ['Turn on AI features', 'Settings → AI'],
            ['Find these guides again', 'Onboarding page'],
          ],
        },
      ],
    },
  ],
};

export const GUIDES = { 'manager-runbook': MANAGER_RUNBOOK, 'company-admin-guide': COMPANY_ADMIN_GUIDE } as const;
