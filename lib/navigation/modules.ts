export type AppModule = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const appModules: AppModule[] = [
  { label: 'Command', href: '/dashboard' },
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
    href: '/receivable-payments',
    children: [
      { label: 'Receivables', href: '/receivable-payments' },
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
  { label: 'People', href: '/owners' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Maintenance', href: '/work-orders' },
  { label: 'Communication', href: '/communication-center' },
  { label: 'Settings', href: '/settings' },
];
