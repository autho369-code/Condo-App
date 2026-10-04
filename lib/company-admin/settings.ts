// Pure normalization for the company-admin settings form.

export const MANAGER_DEFAULT_ROLES = ['manager', 'assistant_manager', 'maintenance_supervisor', 'admin_assistant'] as const
export const MANAGER_DEFAULT_PERMISSIONS = ['standard', 'elevated', 'full'] as const

export type CompanySettingsInput = {
  logo_url: FormDataEntryValue | null
  default_role: FormDataEntryValue | null
  default_permissions: FormDataEntryValue | null
}

export type NormalizedCompanySettings = {
  logoUrl: string | null
  managerDefaults: { role: string; permissions: string }
}

/** Accept only absolute http(s) URLs (no javascript:/data: links). */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function normalizeCompanySettingsInput(input: CompanySettingsInput): NormalizedCompanySettings | { error: string } {
  const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')

  const rawLogo = text(input.logo_url)
  let logoUrl: string | null = null
  if (rawLogo) {
    logoUrl = safeHttpUrl(rawLogo)
    if (!logoUrl) return { error: 'Logo URL must be a full http(s) address, e.g. https://example.com/logo.png.' }
  }

  const role = text(input.default_role) || 'manager'
  if (!(MANAGER_DEFAULT_ROLES as readonly string[]).includes(role)) return { error: 'Choose a valid default manager role.' }
  const permissions = text(input.default_permissions) || 'standard'
  if (!(MANAGER_DEFAULT_PERMISSIONS as readonly string[]).includes(permissions)) return { error: 'Choose a valid default permission level.' }

  return { logoUrl, managerDefaults: { role, permissions } }
}
