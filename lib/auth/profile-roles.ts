export const PROFILE_ROLE_OPTIONS = [
  { value: 'company_admin', label: 'Company Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'board', label: 'Board Member' },
  { value: 'owner', label: 'Owner' },
  { value: 'tenant', label: 'Tenant' },
] as const;

export type ProfileRole = (typeof PROFILE_ROLE_OPTIONS)[number]['value'];

const PROFILE_ROLES = new Set<string>(PROFILE_ROLE_OPTIONS.map((role) => role.value));

export function isProfileRole(value: string): value is ProfileRole {
  return PROFILE_ROLES.has(value);
}
