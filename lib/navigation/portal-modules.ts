export type PortalModule = {
  label: string;
  href: string;
};

export const portalModules: PortalModule[] = [
  { label: 'Dashboard', href: '/portal' },
  { label: 'My Payments', href: '/portal/payments' },
  { label: 'Documents', href: '/portal/documents' },
  { label: 'Maintenance', href: '/portal/maintenance' },
  { label: 'Violations', href: '/portal/violations' },
  { label: 'Settings', href: '/portal/settings' },
];
