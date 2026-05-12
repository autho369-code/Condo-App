export type NavItem = {
  label: string;
  href: string;
};

export type NavSection = {
  label: string;
  href?: string;
  children?: NavItem[];
};

export const NAV: NavSection[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Communication Center', href: '/communication-center' },
  {
    label: 'Calendar',
    children: [
      { label: 'Association Calendar', href: '/calendar' },
      { label: 'New Event', href: '/calendar/new' },
    ],
  },
  { label: 'Automation Center', href: '/automation-center' },
  { label: 'Associations', href: '/associations' },
  {
    label: 'People',
    children: [
      { label: 'Owners', href: '/owners' },
      { label: 'Tenants', href: '/owners?view=tenants' },
      { label: 'Vendors', href: '/vendors' },
    ],
  },
  {
    label: 'Accounting',
    children: [
      { label: 'Receivables', href: '/charges' },
      { label: 'Receipts', href: '/accounting/receivable-payments' },
      { label: 'Payables', href: '/accounting/payable-invoices' },
      { label: 'Bank Accounts', href: '/bank-accounts' },
      { label: 'Banking Activity', href: '/bank-accounts/activity' },
      { label: 'Journal Entries', href: '/journal-entries' },
      { label: 'Bank Transfers', href: '/bank-transfers' },
      { label: 'GL Accounts', href: '/gl-accounts' },
      { label: 'Diagnostics', href: '/diagnostics' },
      { label: 'Charge Categories', href: '/charge-categories' },
    ],
  },
  {
    label: 'Maintenance',
    children: [
      { label: 'Work Orders', href: '/work-orders' },
      { label: 'Recurring Work Orders', href: '/recurring-work-orders' },
      { label: 'Inspections', href: '/inspections' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Fixed Assets', href: '/fixed-assets' },
    ],
  },
  { label: 'Violations', href: '/violations' },
  {
    label: 'Reporting',
    children: [
      { label: 'Reports', href: '/reports' },
      { label: 'Scheduled Reports', href: '/scheduled-reports' },
      { label: 'Metrics', href: '/metrics' },
      { label: 'Surveys', href: '/surveys' },
    ],
  },
  {
    label: 'Communication',
    children: [
      { label: 'Letters', href: '/letters' },
      { label: 'Inbox', href: '/inbox' },
      { label: 'Send Email', href: '/send-email' },
    ],
  },
];
