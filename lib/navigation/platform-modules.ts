import type { AppModule } from '@/lib/navigation/modules';

export const platformModules: AppModule[] = [
  { label: 'Clients',       href: '/platform/portfolios' },
  { label: 'Access requests', href: '/platform/leads' },
  { label: 'Properties',    href: '/platform/properties' },
  { label: 'Owners',        href: '/platform/owners' },
  { label: 'Users',         href: '/platform/users' },
  { label: 'Operators',     href: '/platform/operators' },
  { label: 'Billing',       href: '/platform/billing' },
  { label: 'System health', href: '/platform/system-health' },
];
