export type AppModule = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const appModules: AppModule[] = [
  { label: 'Dashboard', href: '/dashboard' },
  {
    label: 'Associations',
    href: '/associations',
    children: [
      { label: 'Directory', href: '/associations' },
      { label: 'New association', href: '/associations/new' },
      { label: 'Units', href: '/units' },
    ],
  },
  { label: 'Owners', href: '/owners' },
  {
    label: 'Accounting',
    href: '/bank-accounts',
    children: [
      { label: 'Receivables', href: '/charges' },
      { label: 'Payables', href: '/bills' },
      { label: 'Vendors', href: '/vendors' },
      { label: 'Bank accounts', href: '/bank-accounts' },
      { label: 'Bank transfers', href: '/bank-transfers' },
      { label: 'GL accounts', href: '/gl-accounts' },
      { label: 'Journal entries', href: '/journal-entries' },
    ],
  },
  { label: 'Work Orders', href: '/work-orders' },
  { label: 'Violations', href: '/violations' },
  { label: 'Communication', href: '/communication-center' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
];

export const boardModules: AppModule[] = [
  { label: 'Board dashboard', href: '/board' },
  { label: 'Association documents', href: '/portal/documents' },
  { label: 'Account ledger', href: '/portal/ledger' },
  { label: 'Service requests', href: '/portal/service-requests' },
];

export const portalModules: AppModule[] = [
  { label: 'Portal home', href: '/portal' },
  { label: 'Account ledger', href: '/portal/ledger' },
  { label: 'Statement', href: '/portal/statement' },
  { label: 'Payments', href: '/portal/pay' },
  { label: 'Autopay', href: '/portal/autopay' },
  { label: 'Service requests', href: '/portal/service-requests' },
  { label: 'Documents', href: '/portal/documents' },
  { label: 'Communication history', href: '/portal/communications' },
];
