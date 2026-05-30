export type LoginModeId = 'manager' | 'owner' | 'admin';

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
    description: 'For homeowners, board members, and residents using the portal.',
    defaultNext: '/portal',
    submitLabel: 'Sign in as owner',
    note: 'Owner access is controlled by the portal profile connected to your unit.',
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    title: 'Admin Sign In',
    description: 'For platform operators and superadmins managing every portfolio.',
    defaultNext: '/platform/portfolios',
    submitLabel: 'Sign in as admin',
    note: 'Superadmin means your Supabase Auth user is active in platform_operators.',
  },
};

export function normalizeLoginMode(value?: FormDataEntryValue | string | string[] | null): LoginModeId {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'owner' || raw === 'admin' ? raw : 'manager';
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
  return [loginModes.owner, loginModes.manager];
}
