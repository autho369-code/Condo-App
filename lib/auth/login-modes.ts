export type LoginModeId = 'company_admin' | 'manager' | 'owner' | 'vendor';

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
  company_admin: {
    id: 'company_admin',
    label: 'Company Admin',
    title: 'Company Admin Sign In',
    description: 'For property management company administrators. Manage your team, associations, and settings.',
    defaultNext: '/dashboard',
    submitLabel: 'Sign in as company admin',
    note: 'Full access within your portfolio. Manage team, settings, and all associations.',
  },
  manager: {
    id: 'manager',
    label: 'Manager',
    title: 'Manager Sign In',
    description: 'For day-to-day operations — work orders, unit management, vendor coordination.',
    defaultNext: '/dashboard',
    submitLabel: 'Sign in as manager',
    note: 'Access scoped to your assigned properties and units.',
  },
  owner: {
    id: 'owner',
    label: 'Owner',
    title: 'Owner Sign In',
    description: 'For owners and board members using the owner portal.',
    defaultNext: '/portal',
    submitLabel: 'Sign in as owner',
    note: 'Access your unit ledger, make payments, submit service requests, and view association documents.',
  },
  vendor: {
    id: 'vendor',
    label: 'Vendor',
    title: 'Vendor Sign In',
    description: 'For external contractors and service providers.',
    defaultNext: '/portal',
    submitLabel: 'Sign in as vendor',
    note: 'Access limited to your assigned work orders, bills, and service history.',
  },
};

/** Invite chain — who can invite whom */
export const inviteTargets: Record<string, LoginModeId[]> = {
  superadmin: ['company_admin'],
  company_admin: ['manager'],
  manager: ['owner', 'vendor'],
  owner: [],
  vendor: [],
};

export function normalizeLoginMode(value?: FormDataEntryValue | string | string[] | null): LoginModeId {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'company_admin') return 'company_admin';
  if (raw === 'manager') return 'manager';
  if (raw === 'owner') return 'owner';
  if (raw === 'vendor') return 'vendor';
  return 'company_admin';
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

export function getVisibleLoginModes(): LoginModeConfig[] {
  return Object.values(loginModes).filter(m => !m.hidden);
}
