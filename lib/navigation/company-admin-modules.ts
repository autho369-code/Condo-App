export interface CompanyAdminModule {
  label: string;
  href: string;
}

export const companyAdminModules: CompanyAdminModule[] = [
  { label: 'Overview', href: '/company-admin' },
  { label: 'Associations', href: '/company-admin/associations' },
  { label: 'Managers', href: '/company-admin/managers' },
  { label: 'Portfolio Health', href: '/company-admin/health' },
  { label: 'Work Orders', href: '/company-admin/work-orders' },
  { label: 'Violations', href: '/company-admin/violations' },
  { label: 'Architectural Reviews', href: '/company-admin/architectural' },
  { label: 'Owners', href: '/company-admin/owners' },
  { label: 'Vendors', href: '/company-admin/vendors' },
  { label: 'Billing & Doors', href: '/company-admin/billing' },
  { label: 'Revenue', href: '/company-admin/revenue' },
  { label: 'Communications', href: '/company-admin/communications' },
  { label: 'Platform Requests', href: '/company-admin/platform-requests' },
  { label: 'Audit Logs', href: '/company-admin/audit-logs' },
  { label: 'Settings', href: '/company-admin/settings' },
];
