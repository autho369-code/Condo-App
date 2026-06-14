export type AppModule = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const appModules: AppModule[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Meetings', href: '/meetings' },
  {
    label: 'Associations',
    href: '/associations',
    children: [
      { label: 'Directory', href: '/associations' },
      { label: 'New association', href: '/associations/new' },
      { label: 'Units', href: '/units' },
      { label: 'Parking', href: '/parking' },
    ],
  },
  {
    label: 'Accounting',
    href: '/accounting',
    children: [
      { label: 'Receivables', href: '/charges' },
      { label: 'Payables', href: '/bills' },
      { label: 'Bank accounts', href: '/bank-accounts' },
      { label: 'Journal entries', href: '/journal-entries' },
      { label: 'Bank transfers', href: '/bank-transfers' },
      { label: 'GL accounts', href: '/gl-accounts' },
      { label: 'Budget', href: '/budget' },
      { label: 'Budget vs Actuals', href: '/budget-vs-actuals' },
      { label: 'Diagnostics', href: '/diagnostics' },
      { label: '1099 Reporting', href: '/accounting/1099' },
    ],
  },
  { label: 'Reports', href: '/reports' },
  { label: 'Violations', href: '/violations' },
  { label: 'Insurance', href: '/insurance' },
  { label: 'People', href: '/owners' },
  { label: 'Vendors', href: '/vendors' },
  {
    label: 'Maintenance',
    href: '/maintenance',
    children: [
      { label: 'Work Orders', href: '/work-orders' },
      { label: 'Preventive', href: '/maintenance' },
    ],
  },
  { label: 'Lock Boxes', href: '/lock-boxes' },
  {
    label: 'Documents',
    href: '/documents',
    children: [
      { label: 'All Documents', href: '/documents' },
      { label: 'Generate', href: '/documents/generate' },
      { label: 'Templates', href: '/documents?tab=templates' },
      { label: 'Notices', href: '/documents?tab=notices' },
    ],
  },
  {
    label: 'Communication',
    href: '/communication-center',
    children: [
      { label: 'Center', href: '/communication-center' },
      { label: 'Maintenance Comms', href: '/maintenance/communications' },
      { label: 'Send email', href: '/send-email' },
      { label: 'SMS', href: '/sms' },
      { label: 'Templates', href: '/sms/templates' },
      { label: 'Opt-Ins', href: '/sms/opt-ins' },
      { label: 'Inbox', href: '/inbox' },
      { label: 'Letters', href: '/letters' },
    ],
  },
  { label: 'Settings', href: '/settings' },
];
