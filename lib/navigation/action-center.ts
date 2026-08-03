export type ActionCenterTab = 'work' | 'reports' | 'help';
export type ActionAccess = 'all' | 'finance' | 'admin' | 'finance_or_admin';

export type ActionCenterLink = {
  label: string;
  href: string;
  description?: string;
  access?: ActionAccess;
  primary?: boolean;
};

export type ActionCenterSection = {
  title: string;
  tab: ActionCenterTab;
  links: ActionCenterLink[];
};

export type ActionCenterPanel = {
  label: string;
  sections: ActionCenterSection[];
};

type ActionCenterDefinition = {
  label: string;
  match: RegExp;
  sections?: ActionCenterSection[];
  build?: (pathname: string, view: string) => ActionCenterSection[];
};

export type ActionCenterPermissions = {
  isStaff: boolean;
  isFinanceStaff: boolean;
  isAdmin: boolean;
};

const COMPANY_ADMIN_SHARED_ROUTES = [
  /^\/accounting-periods(?:\/|$)/,
  /^\/capital-reserves(?:\/|$)/,
  /^\/command-center(?:\/|$)/,
  /^\/budget-vs-actuals(?:\/|$)/,
  /^\/gl-accounts\/permissions(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/company-admin(?:\/|$)/,
];

const work = (title: string, links: ActionCenterLink[]): ActionCenterSection => ({ title, tab: 'work', links });
const reports = (title: string, links: ActionCenterLink[]): ActionCenterSection => ({ title, tab: 'reports', links });
const help = (title: string, links: ActionCenterLink[]): ActionCenterSection => ({ title, tab: 'help', links });

const FINANCIAL_REPORTS: ActionCenterLink[] = [
  { label: 'Balance sheet', href: '/reports/balance_sheet', description: 'Assets, liabilities, and equity.' },
  { label: 'Income statement', href: '/reports/income_statement', description: 'Revenue and expenses for a period.' },
  { label: 'General ledger', href: '/reports/general_ledger', description: 'Drill into posted account activity.' },
  { label: 'Trial balance', href: '/reports/trial_balance', description: 'Verify debits and credits by account.' },
  { label: 'AR aging', href: '/reports/ar-aging', description: 'Outstanding owner balances by age.' },
  { label: 'Monthly board package', href: '/reports/monthly-package', description: 'Build a board-ready financial packet.' },
];

const DEFINITIONS: ActionCenterDefinition[] = [
  {
    label: 'Developer Hub',
    match: /^\/settings\/developer/,
    sections: [
      work('Manage', [
        { label: 'Portfolio settings', href: '/settings', description: 'Company, team, and access settings.', access: 'admin' },
        { label: 'AI configuration', href: '/settings/ai', description: 'Models, keys, and assistant behavior.', access: 'admin' },
        { label: 'Audit logs', href: '/company-admin/audit-logs', description: 'Review security and configuration history.', access: 'admin' },
      ]),
    ],
  },
  {
    label: 'Capital & reserves',
    match: /^\/capital-reserves/,
    sections: [
      work('Plan', [
        { label: 'New reserve study', href: '/capital-reserves/new', description: 'Model components and long-range funding.', primary: true },
        { label: 'New fixed asset', href: '/fixed-assets/new', description: 'Add a tracked capital asset.' },
        { label: 'New budget', href: '/budget/new', description: 'Prepare an association budget.', access: 'finance' },
      ]),
      reports('Review', [
        { label: 'Budget vs actuals', href: '/budget-vs-actuals', description: 'Compare approved plans with current results.' },
        { label: 'All financial reports', href: '/reports', description: 'Open the complete reporting catalog.' },
      ]),
      help('Guidance', [{ label: 'Board reporting guide', href: '/help/board-reports', description: 'Prepare and review board-ready reports.' }]),
    ],
  },
  {
    label: 'Association board',
    match: /^\/associations\/[^/]+\/board/,
    build: (pathname) => {
      const associationId = pathname.split('/')[2];
      return [
        work('Board work', [
          { label: 'New approval', href: `/associations/${associationId}/approvals/new`, description: 'Open a traceable board decision.', primary: true },
          { label: 'Email board members', href: '/send-email', description: 'Compose an association-scoped message.' },
          { label: 'Schedule meeting', href: '/meetings/new', description: 'Create a board meeting and agenda.' },
        ]),
        reports('Board packets', [
          { label: 'Monthly package', href: '/reports/monthly-package', description: 'Assemble current financial statements.' },
          { label: 'Bulk association reports', href: '/reports/bulk-association', description: 'Prepare packets across associations.' },
        ]),
        help('Guidance', [
          { label: 'Board member overview', href: '/help/board-member-overview' },
          { label: 'Board member packets', href: '/help/board-member-packets' },
        ]),
      ];
    },
  },
  {
    label: 'Association',
    match: /^\/associations\/[^/]+/,
    sections: [
      work('Create', [
        { label: 'New unit', href: '/units/new', description: 'Add a unit to an association.', primary: true },
        { label: 'New homeowner', href: '/owners/new', description: 'Create an owner and occupancy record.' },
        { label: 'New work order', href: '/work-orders/new', description: 'Dispatch association maintenance.' },
        { label: 'New violation', href: '/violations/new', description: 'Open a documented compliance case.' },
        { label: 'New meeting', href: '/meetings/new', description: 'Schedule a board or annual meeting.' },
      ]),
      reports('Review', [
        { label: 'Monthly package', href: '/reports/monthly-package', description: 'Build a board-ready packet.' },
        { label: 'Budget vs actuals', href: '/budget-vs-actuals', description: 'Review association performance.' },
        { label: 'All reports', href: '/reports', description: 'Browse the full catalog.' },
      ]),
      help('Guidance', [{ label: 'Managing associations', href: '/help/managing-hoas' }]),
    ],
  },
  {
    label: 'Associations',
    match: /^\/associations/,
    sections: [
      work('Portfolio setup', [
        { label: 'New association', href: '/associations/new', description: 'Create the association source record.', primary: true },
        { label: 'Import homeowners & units', href: '/owners/import', description: 'Load a reviewed CSV into the portfolio.' },
        { label: 'New building', href: '/buildings/new', description: 'Add a building to an association.' },
        { label: 'New unit', href: '/units/new', description: 'Create a unit manually.' },
      ]),
      reports('Portfolio reporting', [
        { label: 'Bulk association reports', href: '/reports/bulk-association', description: 'Generate the same report across communities.' },
        { label: 'Monthly package', href: '/reports/monthly-package', description: 'Create board-ready financial packets.' },
      ]),
      help('Guidance', [
        { label: 'Adding an association', href: '/help/adding-a-property' },
        { label: 'Managing associations', href: '/help/managing-hoas' },
      ]),
    ],
  },
  {
    label: 'Units & parking',
    match: /^\/(units|parking)/,
    sections: [
      work('Association records', [
        { label: 'New unit', href: '/units/new', description: 'Create a unit in the selected building.', primary: true },
        { label: 'Import homeowners & units', href: '/owners/import', description: 'Load a reviewed association roster.' },
        { label: 'Parking register', href: '/parking', description: 'Review vehicles and assigned spaces.' },
        { label: 'Homeowner directory', href: '/owners', description: 'Open owner and occupancy records.' },
      ]),
      reports('Property reporting', [{ label: 'Report catalog', href: '/reports', description: 'Open association, unit, and owner reports.' }]),
    ],
  },
  {
    label: 'Accounting',
    match: /^\/(accounting(?:\/|$)|command-center|bank-accounts|bank-transfers|journal-entries|gl-accounts|charges|charge-categories|bills|budget|budget-vs-actuals|diagnostics|accounting-periods|delinquencies)/,
    sections: [
      work('Daily accounting', [
        { label: 'Post owner charge', href: '/charges/new', description: 'Record an individual assessment or fee.', primary: true },
        { label: 'New bill', href: '/bills/new', description: 'Enter or extract a vendor invoice.', primary: true, access: 'finance' },
        { label: 'Bulk charges & credits', href: '/charges/bulk', description: 'Post reviewed owner transactions in bulk.' },
        { label: 'Recurring charges', href: '/charges/bulk-recurring', description: 'Set up recurring association assessments.' },
        { label: 'Run approved checks', href: '/bills/check-run', description: 'Pay approved bills and print checks.', access: 'finance' },
        { label: 'Record bank deposit', href: '/bank-accounts/deposits/new', description: 'Group receipts into a deposit.' },
        { label: 'Reconcile bank account', href: '/bank-accounts/reconcile/new', description: 'Match statement activity.' },
        { label: 'New journal entry', href: '/journal-entries/new', description: 'Post a balanced manual entry.' },
      ]),
      work('Controls', [
        { label: 'Financial diagnostics', href: '/diagnostics', description: 'Resolve mismatches and stale reconciliations.' },
        { label: 'Delinquency ladder', href: '/delinquencies', description: 'Advance approved collection steps.' },
        { label: 'Accounting periods', href: '/accounting-periods', description: 'Close and reopen periods with an audit trail.', access: 'finance_or_admin' },
        { label: 'GL role permissions', href: '/gl-accounts/permissions', description: 'Limit account visibility by role.', access: 'admin' },
      ]),
      reports('Financial statements', FINANCIAL_REPORTS),
      help('Guidance', [
        { label: 'Late-fee policies', href: '/help/late-fee-policies' },
        { label: 'Owner statements', href: '/help/owner-statements' },
        { label: 'Board reports', href: '/help/board-reports' },
      ]),
    ],
  },
  {
    label: 'Maintenance',
    match: /^\/(work-orders|maintenance|recurring-work-orders|projects|inspections|purchase-orders|inventory|fixed-assets)/,
    sections: [
      work('Create & dispatch', [
        { label: 'New work order', href: '/work-orders/new', description: 'Create, prioritize, and assign work.', primary: true },
        { label: 'New recurring work', href: '/recurring-work-orders/new', description: 'Schedule preventive maintenance.' },
        { label: 'New inspection', href: '/inspections/new', description: 'Start a field-ready inspection.' },
        { label: 'New project', href: '/projects/new', description: 'Track scope, budget, and approvals.' },
        { label: 'New purchase order', href: '/purchase-orders/new', description: 'Authorize vendor work and spend.' },
        { label: 'New inventory item', href: '/inventory/new', description: 'Track supplies and parts.' },
        { label: 'New fixed asset', href: '/fixed-assets/new', description: 'Track lifecycle and replacement planning.' },
      ]),
      work('Operate', [
        { label: 'Field inspections', href: '/inspections', description: 'Continue online or offline field work.' },
        { label: 'Maintenance communications', href: '/maintenance/communications', description: 'Notify affected homeowners in bulk.' },
        { label: 'Preventive templates', href: '/maintenance/templates', description: 'Standardize recurring work.' },
      ]),
      reports('Operational reporting', [
        { label: 'Report catalog', href: '/reports', description: 'Work orders, inspections, projects, and vendors.' },
        { label: 'Report builder', href: '/reports/builder?source=work_orders', description: 'Build a filtered work-order view.' },
      ]),
    ],
  },
  {
    label: 'Homeowner',
    match: /^\/owners\/[0-9a-f]{8}-[0-9a-f-]+$/,
    build: (pathname) => {
      const ownerId = pathname.split('/')[2];
      return [
        work('Account actions', [
          { label: 'Post charge', href: '/charges/new', description: 'Add an owner charge.', primary: true },
          { label: 'View receivables', href: `/charges?owner=${ownerId}`, description: 'Review this owner account.' },
          { label: 'Send statement', href: `/owners/${ownerId}?view=statements`, description: 'Review and deliver a statement.' },
          { label: 'Owner payable / refund', href: '/bills/owner-payable/new', description: 'Record an approved reimbursement.', access: 'finance' },
          { label: 'Manage portal access', href: `/owners/${ownerId}#portal-access`, description: 'Review activation and access.' },
          { label: 'Send email', href: '/send-email', description: 'Compose a direct message.' },
        ]),
        reports('Owner reporting', [
          { label: 'Owner ledger', href: '/reports/homeowner_ledger', description: 'Charges, payments, and running balance.' },
          { label: 'Delinquency summary', href: '/reports/delinquency', description: 'Aging and collection position.' },
        ]),
        help('Guidance', [{ label: 'Owner statements', href: '/help/owner-statements' }]),
      ];
    },
  },
  {
    label: 'Homeowners',
    match: /^\/owners/,
    sections: [
      work('Homeowner records', [
        { label: 'New homeowner', href: '/owners/new', description: 'Create an owner and occupancy.', primary: true },
        { label: 'Import homeowners & units', href: '/owners/import', description: 'Load a reviewed CSV.' },
        { label: 'Portal activations', href: '/owners/activations', description: 'Invite and monitor homeowner access.' },
        { label: 'Owner forms', href: '/owners/forms', description: 'Prepare and distribute owner forms.' },
        { label: 'Send statements', href: '/statements/send', description: 'Generate a reviewed statement batch.' },
        { label: 'Management agreements', href: '/owners/management-agreements', description: 'Track agreement terms and dates.' },
      ]),
      reports('Owner reporting', [
        { label: 'Report builder', href: '/reports/builder?source=owners', description: 'Create a filtered owner directory.' },
        { label: 'Delinquency summary', href: '/reports/delinquency', description: 'Review aging across associations.' },
      ]),
      help('Guidance', [{ label: 'Owner statements', href: '/help/owner-statements' }]),
    ],
  },
  {
    label: 'Vendors',
    match: /^\/vendors/,
    sections: [
      work('Vendor operations', [
        { label: 'New vendor', href: '/vendors/new', description: 'Add a vendor and trade profile.', primary: true },
        { label: 'Compliance center', href: '/vendors/compliance', description: 'Review insurance and credential gaps.' },
        { label: 'W-9 collection', href: '/vendors/w9', description: 'Track tax documentation.' },
        { label: 'ACH settings', href: '/vendors/ach', description: 'Review vendor payment preferences.', access: 'finance' },
        { label: 'New purchase order', href: '/purchase-orders/new', description: 'Authorize work and spend.' },
        { label: 'New bill', href: '/bills/new', description: 'Enter a vendor invoice.', access: 'finance' },
      ]),
      reports('Vendor reporting', [
        { label: 'Report builder', href: '/reports/builder?source=vendors', description: 'Build a vendor directory or compliance view.' },
        { label: '1099 reporting', href: '/accounting/1099', description: 'Prepare annual vendor tax reporting.', access: 'finance' },
      ]),
    ],
  },
  {
    label: 'Violations',
    match: /^\/(violations|compliance)/,
    sections: [
      work('Compliance actions', [
        { label: 'New violation', href: '/violations/new', description: 'Open a documented case.', primary: true },
        { label: 'Field capture', href: '/violations/field', description: 'Capture photos, location, and observations.' },
        { label: 'Compliance overview', href: '/compliance', description: 'Review portfolio policies and exposure.' },
        { label: 'Draft violation letter', href: '/letters/new', description: 'Create a reviewed notice from a template.' },
        { label: 'Physical mail queue', href: '/letters/mail', description: 'Track printed and certified delivery.' },
      ]),
      reports('Compliance reporting', [
        { label: 'Violation report builder', href: '/reports/builder?source=violations', description: 'Filter cases by association, status, and date.' },
        { label: 'All compliance reports', href: '/reports', description: 'Open the full catalog.' },
      ]),
    ],
  },
  {
    label: 'Architectural reviews',
    match: /^\/architectural-reviews/,
    sections: [
      work('Review workflow', [
        { label: 'New request', href: '/architectural-reviews/new', description: 'Create a request on behalf of a homeowner.', primary: true },
        { label: 'Review queue', href: '/architectural-reviews', description: 'Triage received and pending requests.' },
        { label: 'Send decision letter', href: '/letters/new', description: 'Generate an approval or denial notice.' },
        { label: 'Email homeowner', href: '/send-email', description: 'Request details or communicate a decision.' },
      ]),
      reports('Review records', [{ label: 'All reports', href: '/reports', description: 'Find architectural and association reports.' }]),
      help('Guidance', [
        { label: 'Architectural reviews', href: '/help/architectural-reviews' },
        { label: 'Configure review forms', href: '/help/configuring-review-forms' },
      ]),
    ],
  },
  {
    label: 'Reports',
    match: /^\/(reports|scheduled-reports|metrics)/,
    sections: [
      work('Reporting tools', [
        { label: 'Report builder', href: '/reports/builder', description: 'Choose fields, filters, and save a view.', primary: true },
        { label: 'New scheduled report', href: '/scheduled-reports/new', description: 'Automate recurring report delivery.' },
        { label: 'Monthly board package', href: '/reports/monthly-package', description: 'Combine reviewed financial statements.' },
        { label: 'Bulk association reports', href: '/reports/bulk-association', description: 'Run one report across communities.' },
        { label: 'Run history', href: '/reports/runs', description: 'Inspect queued and completed exports.' },
        { label: 'Metrics', href: '/metrics', description: 'Review portfolio operating trends.' },
      ]),
      reports('Financial favorites', FINANCIAL_REPORTS),
      help('Guidance', [
        { label: 'Board reporting guide', href: '/help/board-reports' },
        { label: 'Board member packets', href: '/help/board-member-packets' },
      ]),
    ],
  },
  {
    label: 'Communications',
    match: /^\/(communication-center|send-email|sms|inbox|letters|documents|forms|surveys|statements)/,
    sections: [
      work('Compose & deliver', [
        { label: 'Compose email', href: '/send-email', description: 'Send an association or portfolio message.', primary: true },
        { label: 'Send SMS', href: '/sms', description: 'Create a text message and track delivery.' },
        { label: 'New letter', href: '/letters/new', description: 'Generate a merge-ready notice.' },
        { label: 'Physical mail', href: '/letters/mail', description: 'Review print and delivery jobs.' },
        { label: 'New form', href: '/forms/new', description: 'Create a reusable digital form.' },
        { label: 'New survey', href: '/surveys/new', description: 'Collect structured community feedback.' },
      ]),
      work('Templates & queues', [
        { label: 'Communication center', href: '/communication-center', description: 'Approve drafts and retry failed delivery.' },
        { label: 'Unified inbox', href: '/inbox', description: 'Review inbound and outbound conversations.' },
        { label: 'SMS templates', href: '/sms/templates', description: 'Standardize frequently used texts.' },
        { label: 'Document templates', href: '/documents?tab=templates', description: 'Manage merge-ready notices and forms.' },
        { label: 'SMS opt-ins', href: '/sms/opt-ins', description: 'Audit consent before delivery.' },
      ]),
      reports('Delivery oversight', [{ label: 'Communication reports', href: '/reports', description: 'Review communication and delivery reporting.' }]),
    ],
  },
  {
    label: 'Meetings',
    match: /^\/meetings/,
    sections: [
      work('Meeting workflow', [
        { label: 'New meeting', href: '/meetings/new', description: 'Schedule a meeting and prepare the agenda.', primary: true },
        { label: 'Meeting workspace', href: '/meetings', description: 'Manage attendance, minutes, and follow-up.' },
        { label: 'Send meeting notice', href: '/send-email', description: 'Notify the selected audience.' },
      ]),
      reports('Board records', [
        { label: 'Monthly board package', href: '/reports/monthly-package', description: 'Prepare supporting financial statements.' },
        { label: 'All reports', href: '/reports', description: 'Open the report catalog.' },
      ]),
    ],
  },
  {
    label: 'Calendar',
    match: /^\/calendar/,
    sections: [work('Schedule', [
      { label: 'New event', href: '/calendar/new', description: 'Create an association or portfolio event.', primary: true },
      { label: 'New meeting', href: '/meetings/new', description: 'Create a governed meeting workflow.' },
      { label: 'Reminders', href: '/reminders', description: 'Review upcoming and overdue work.' },
    ])],
  },
  {
    label: 'Amenities',
    match: /^\/amenities/,
    sections: [
      work('Reservations', [
        { label: 'Manage reservations', href: '/amenities', description: 'Review requests and availability.', primary: true },
        { label: 'Association amenities', href: '/associations', description: 'Configure amenities in association context.' },
        { label: 'Send amenity notice', href: '/send-email', description: 'Notify owners about access or closures.' },
      ]),
      help('Guidance', [
        { label: 'Setting up amenities', href: '/help/amenities' },
        { label: 'Reservation workflow', href: '/help/amenity-reservations' },
      ]),
    ],
  },
  {
    label: 'Lock boxes',
    match: /^\/lock-boxes/,
    sections: [work('Keys & access', [
      { label: 'Add lock box', href: '/lock-boxes/new', description: 'Create a controlled access record.', primary: true },
      { label: 'Active assignments', href: '/lock-boxes?tab=assignments', description: 'Review checked-out keys and boxes.' },
      { label: 'Key inventory', href: '/lock-boxes?tab=keys', description: 'Audit available and missing keys.' },
    ])],
  },
  {
    label: 'Insurance',
    match: /^\/insurance/,
    sections: [work('Coverage', [
      { label: 'New policy', href: '/insurance/new', description: 'Record association or owner coverage.', primary: true },
      { label: 'Insurance register', href: '/insurance', description: 'Review expiring and missing coverage.' },
    ])],
  },
  {
    label: 'Automation',
    match: /^\/automation-center/,
    sections: [
      work('Automate', [
        { label: 'New flow', href: '/automation-center/flows/new', description: 'Connect an event to governed actions.', primary: true },
        { label: 'Manage flows', href: '/automation-center/flows', description: 'Review, enable, and pause automations.' },
      ]),
      reports('Oversight', [{ label: 'Communication center', href: '/communication-center', description: 'Review generated messages before delivery.' }]),
    ],
  },
  {
    label: 'Dashboard',
    match: /^\/(dashboard|reminders)/,
    sections: [
      work('Quick create', [
        { label: 'New work order', href: '/work-orders/new', description: 'Dispatch maintenance.', primary: true },
        { label: 'New violation', href: '/violations/new', description: 'Open a compliance case.' },
        { label: 'New event', href: '/calendar/new', description: 'Add a community event.' },
        { label: 'Compose email', href: '/send-email', description: 'Notify owners, boards, or vendors.' },
      ]),
      work('Needs attention', [
        { label: 'Command Center', href: '/command-center', description: 'Review approvals, failures, and due work.' },
        { label: 'Financial diagnostics', href: '/diagnostics', description: 'Resolve accounting health warnings.' },
        { label: 'Delinquency ladder', href: '/delinquencies', description: 'Review cases awaiting action.' },
        { label: 'Reminders', href: '/reminders', description: 'See upcoming and overdue activity.' },
      ]),
      reports('Executive reporting', [
        { label: 'Monthly board package', href: '/reports/monthly-package', description: 'Build a reviewed financial packet.' },
        { label: 'Metrics', href: '/metrics', description: 'Track portfolio operations.' },
        { label: 'All reports', href: '/reports', description: 'Browse the full catalog.' },
      ]),
    ],
  },
  {
    label: 'Quick actions',
    match: /^\//,
    sections: [
      work('Navigate', [
        { label: 'Dashboard', href: '/dashboard', description: 'Return to portfolio operations.', primary: true },
        { label: 'AI Assistant', href: '/assistant', description: 'Ask questions and draft work.' },
        { label: 'Reminders', href: '/reminders', description: 'Review upcoming and overdue activity.' },
      ]),
      reports('Reporting', [
        { label: 'All reports', href: '/reports', description: 'Browse the complete catalog.' },
        { label: 'Metrics', href: '/metrics', description: 'Review portfolio operating trends.' },
      ]),
    ],
  },
];

export function canAccessActionLink(link: ActionCenterLink, permissions: ActionCenterPermissions) {
  let hasRequiredRole = true;
  if (link.access === 'admin') hasRequiredRole = permissions.isAdmin;
  if (link.access === 'finance') hasRequiredRole = permissions.isFinanceStaff;
  if (link.access === 'finance_or_admin') hasRequiredRole = permissions.isFinanceStaff || permissions.isAdmin;
  if (!hasRequiredRole) return false;

  // Company administrators may enter a small set of shared workspace routes,
  // but that admission does not make manager/finance pages available to them.
  if (!permissions.isStaff && permissions.isAdmin && !permissions.isFinanceStaff) {
    return COMPANY_ADMIN_SHARED_ROUTES.some((pattern) => pattern.test(link.href));
  }
  return true;
}

export function getActionCenter(
  pathname: string,
  view: string,
  permissions: ActionCenterPermissions,
): ActionCenterPanel | null {
  const definition = DEFINITIONS.find((candidate) => candidate.match.test(pathname));
  if (!definition) return null;

  const source = definition.build ? definition.build(pathname, view) : (definition.sections ?? []);
  const sections = source
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => canAccessActionLink(link, permissions)),
    }))
    .filter((section) => section.links.length > 0);

  return sections.length > 0 ? { label: definition.label, sections } : null;
}
