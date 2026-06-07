export type AppModule = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const appModules: AppModule[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Calendar', href: '/calendar' },
  {
    label: 'Associations',
    href: '/associations',
    children: [
      { label: 'Directory', href: '/associations' },
      { label: 'New association', href: '/associations/new' },
      { label: 'Units', href: '/units' },
    ],
  },
  {
    label: 'Accounting',
    href: '/bank-accounts',
    children: [
      { label: 'Receivables', href: '/charges' },
      { label: 'Payables', href: '/bills' },
      { label: 'Bank accounts', href: '/bank-accounts' },
      { label: 'Journal entries', href: '/journal-entries' },
      { label: 'Bank transfers', href: '/bank-transfers' },
      { label: 'GL accounts', href: '/gl-accounts' },
      { label: 'Diagnostics', href: '/diagnostics' },
    ],
  },
  { label: 'Reports', href: '/reports' },
  { label: 'Violations', href: '/violations' },
  { label: 'Insurance', href: '/insurance' },
  { label: 'People', href: '/owners' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Maintenance', href: '/maintenance' },
  { label: 'Communication', href: '/communication-center' },
  { label: 'Settings', href: '/settings' },
];
