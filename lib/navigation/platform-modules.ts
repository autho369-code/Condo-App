import type { AppModule } from '@/lib/navigation/modules';

export const platformModules: AppModule[] = [
  { label: 'Clients', href: '/platform/portfolios' },
  { label: 'Properties', href: '/platform/properties' },
  { label: 'Owners', href: '/platform/owners' },
  { label: 'Users', href: '/platform/users' },
  { label: 'Billing', href: '/platform/billing' },
  { label: 'System Health', href: '/platform/system-health' },
];
