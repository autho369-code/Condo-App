export type LoginModeId = 'superadmin' | 'portfolio_admin' | 'property_manager' | 'owner' | 'vendor';

export interface LoginModeConfig {
  id: LoginModeId;
  label: string;
  title: string;
  description: string;
  defaultNext: string;
  submitLabel: string;
  note: string;
  hidden?: boolean;
}

export const loginModes: Record<LoginModeId, LoginModeConfig> = {
  superadmin: {
    id: 'superadmin',
    label: 'Superadmin',
    title: 'Superadmin Sign In',
    description: 'Platform operators with full cross-portfolio access. Bypasses all RLS.',
    defaultNext: '/platform/portfolios',
    submitLabel: 'Sign in as superadmin',
    note: 'Requires an active record in platform_operators table.',
    hidden: true,
  },
  portfolio_admin: {
    id: 'portfolio_admin',
    label: 'Portfolio Admin',
    title: 'Portfolio Admin Sign In',
    description: 'For portfolio staff managing associations, accounting, violations, work orders, and reports.',
    defaultNext: '/dashboard',
    submitLabel: 'Sign in as portfolio admin',
    note: 'Full access within your portfolio. Manage team, settings, and all associations.',
  },
  property_manager: {
    id: 'property_manager',
    label: 'Property Manager',
    title: 'Property Manager Sign In',
    description: 'For day-to-day operations — work orders, unit management, vendor coordination.',
    defaultNext: '/dashboard',
    submitLabel: 'Sign in as property manager',
    note: 'Access scoped to your assigned properties and units.',
  },
  owner: {
    id: 'owner',
    label: 'Owner',
    title: 'Owner Sign In',
    description: 'For owners, board members, and residents using the owner portal.',
    defaultNext: '/portal',
    submitLabel: 'Sign in as owner',
    note: 'Access your unit ledger, make payments, submit service requests, and view association documents.',
  },
  vendor: {
    id: 'vendor',
    label: 'Vendor',
    title: 'Vendor Sign In',
    description: 'For external contractors and service providers — view assigned work orders and submit bills.',
    defaultNext: '/portal',
    submitLabel: 'Sign in as vendor',
    note: 'Access limited to your assigned work orders, bills, and service history.',
  },
};

export function normalizeLoginMode(value?: FormDataEntryValue | string | string[] | null): LoginModeId {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'superadmin') return 'superadmin';
  if (raw === 'portfolio_admin') return 'portfolio_admin';
  if (raw === 'property_manager') return 'property_manager';
  if (raw === 'owner') return 'owner';
  if (raw === 'vendor') return 'vendor';
  return 'portfolio_admin';
}

export function safeInternalNext(value?: FormDataEntryValue | string | string[] | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed;
}

export function getLoginModeConfig(value?: FormDataEntryValue | string | string[] | null): LoginModeConfig {
  return loginModes[normalizeLoginMode(value)];
}

export function getLoginNext(params: { mode?: string | string[] | null; next?: string | string[] | null }) {
  return safeInternalNext(params.next) ?? getLoginModeConfig(params.mode).defaultNext;
}

export function getVisibleLoginModes(value?: FormDataEntryValue | string | string[] | null): LoginModeConfig[] {
  const mode = normalizeLoginMode(value);
  if (mode === 'superadmin') return [loginModes.superadmin];
  // Show all non-hidden modes on the main login page
  return Object.values(loginModes).filter(m => !m.hidden);
}
