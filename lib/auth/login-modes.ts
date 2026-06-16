export type LoginModeId = 'manager' | 'owner' | 'vendor' | 'admin' | 'company_admin';

export interface LoginModeConfig {
  id: LoginModeId;
  label: string;
  title: string;
  description: string;
  defaultNext: string;
  submitLabel: string;
  note: string;
}

export const loginModes: Record<LoginModeId, LoginModeConfig> = {
  manager: {
    id: 'manager',
    label: 'Manager',
    title: 'Manager Sign In',
    description: 'For portfolio staff managing associations, accounting, violations, work orders, and reports.',
    defaultNext: '/dashboard',
    submitLabel: 'Sign in as manager',
    note: 'Use a staff account tied to a manager profile.',
  },
  owner: {
    id: 'owner',
    label: 'Owner',
    title: 'Owner Sign In',
    description: 'For owners, board members, and residents using the portal.',
    defaultNext: '/portal',
    submitLabel: 'Sign in as owner',
    note: 'Owner access is controlled by the portal profile connected to your unit.',
  },
  vendor: {
    id: 'vendor',
    label: 'Vendor',
    title: 'Vendor Sign In',
    description: 'For contractors and service providers — view work orders, submit invoices, update compliance docs.',
    defaultNext: '/vendor',
    submitLabel: 'Sign in as vendor',
    note: 'Vendor access requires an active vendor profile with portal access.',
  },
  admin: {
    id: 'admin',
    label: 'Operator',
    title: 'Operator Sign In',
    description: 'For platform operators managing every company and portfolio.',
    defaultNext: '/platform-operator',
    submitLabel: 'Sign in',
    note: 'Operator access requires an active platform_operators record.',
  },
  company_admin: {
    id: 'company_admin',
    label: 'Company Admin',
    title: 'Company Admin Sign In',
    description: 'For company administrators managing your organization’s portfolio.',
    defaultNext: '/company-admin/overview',
    submitLabel: 'Sign in',
    note: 'Company admin access is provisioned by your platform operator.',
  },
};

export function normalizeLoginMode(value?: FormDataEntryValue | string | string[] | null): LoginModeId {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'owner' || raw === 'vendor' || raw === 'admin' || raw === 'company_admin' ? raw : 'manager';
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
  if (mode === 'admin') return [loginModes.admin];
  if (mode === 'company_admin') return [loginModes.company_admin];
  return [loginModes.manager, loginModes.owner, loginModes.vendor];
}
