import type { AppModule } from '@/lib/navigation/modules';

export const platformOperatorModules: AppModule[] = [
  { label: 'Companies', href: '/platform-operator/companies' },
  { label: 'Invitations', href: '/platform-operator/invitations' },
  { label: 'Users', href: '/platform-operator/users' },
  { label: 'Clients', href: '/platform/portfolios' },
  { label: 'Properties', href: '/platform/properties' },
  { label: 'Billing', href: '/platform/billing' },
  { label: 'System Health', href: '/platform/system-health' },
];
