// Role-specific navigation for the unified Sidebar. One design, six doors.
import type { AppModule } from './modules';

export const boardModules: AppModule[] = [
  { label: 'Dashboard', href: '/board' },
  { label: 'Meetings', href: '/board/meetings' },
  { label: 'Financials', href: '/board/financials' },
  { label: 'Budget vs Actual', href: '/board/budget' },
  { label: 'Delinquencies', href: '/board/delinquencies' },
  { label: 'Violations', href: '/board/violations' },
  { label: 'Architectural Reviews', href: '/board/architectural-reviews' },
  { label: 'Projects', href: '/board/projects' },
  { label: 'Work Orders', href: '/board/work-orders' },
  { label: 'Vendors', href: '/board/vendors' },
  { label: 'Documents', href: '/board/documents' },
  { label: 'Reports', href: '/board/reports' },
  { label: 'Communications', href: '/board/communications' },
];

export const ownerModules: AppModule[] = [
  { label: 'Dashboard', href: '/portal' },
  { label: 'My Account', href: '/portal/account' },
  { label: 'Payments', href: '/portal/pay' },
  { label: 'Work Orders', href: '/portal/work-orders' },
  { label: 'Violations', href: '/portal/violations' },
  { label: 'Hearings', href: '/portal/hearings' },
  { label: 'Communications', href: '/portal/communications' },
  { label: 'Calendar', href: '/portal/calendar' },
  { label: 'Documents', href: '/portal/documents' },
  { label: 'Insurance', href: '/portal/insurance' },
  { label: 'Lease', href: '/portal/lease' },
  { label: 'Profile', href: '/portal/profile' },
];

export const companyAdminModules: AppModule[] = [
  { label: 'Overview', href: '/company-admin/overview' },
  { label: 'Associations', href: '/company-admin/associations' },
  { label: 'Managers', href: '/company-admin/managers' },
  { label: 'Portfolio Health', href: '/company-admin/portfolio-health' },
  { label: 'Work Orders', href: '/company-admin/work-orders' },
  { label: 'Violations', href: '/company-admin/violations' },
  { label: 'Architectural Reviews', href: '/company-admin/architectural-reviews' },
  { label: 'Owners', href: '/company-admin/owners' },
  { label: 'Vendors', href: '/company-admin/vendors' },
  { label: 'Billing & Doors', href: '/company-admin/billing' },
  { label: 'Revenue', href: '/company-admin/revenue' },
  { label: 'Communications', href: '/company-admin/communications' },
  { label: 'Platform Requests', href: '/company-admin/platform-requests' },
  { label: 'Audit Logs', href: '/company-admin/audit-logs' },
  { label: 'Settings', href: '/company-admin/settings' },
];

export const platformOperatorModules: AppModule[] = [
  { label: 'Overview', href: '/platform-operator' },
  { label: 'Companies', href: '/platform-operator/companies' },
  { label: 'Invitations', href: '/platform-operator/invitations' },
  { label: 'Users', href: '/platform-operator/users' },
  { label: 'Operators', href: '/platform-operator/operators' },
  { label: 'Billing', href: '/platform-operator/billing' },
  { label: 'Door Usage', href: '/platform-operator/door-usage' },
  { label: 'Revenue', href: '/platform-operator/revenue' },
  { label: 'Association Health', href: '/platform-operator/association-health' },
  { label: 'Communications', href: '/platform-operator/communications' },
  { label: 'Support Requests', href: '/platform-operator/support' },
  { label: 'Audit Logs', href: '/platform-operator/audit-logs' },
];

export const vendorModules: AppModule[] = [
  { label: 'Dashboard', href: '/vendor' },
  { label: 'Work Orders', href: '/vendor/work-orders' },
  { label: 'Compliance', href: '/vendor/compliance' },
  { label: 'Profile', href: '/vendor/profile' },
];
