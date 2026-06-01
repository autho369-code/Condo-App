import type { AppModule } from '@/lib/navigation/modules';

export const platformModules: AppModule[] = [
  { label: 'Overview', href: '/platform' },
  { label: 'Clients', href: '/platform/portfolios' },
  { label: 'Associations', href: '/platform/associations' },
  { label: 'Users', href: '/platform/users' },
  { label: 'Invitations', href: '/platform/invitations' },
  { label: 'Billing', href: '/platform/billing' },
  { label: 'Revenue', href: '/platform/revenue' },
  { label: 'Communications', href: '/platform/communications' },
  { label: 'Support', href: '/platform/support' },
  { label: 'Health Scores', href: '/platform/health' },
  { label: 'Audit Logs', href: '/platform/audit-logs' },
  { label: 'System', href: '/platform/controls' },
];
