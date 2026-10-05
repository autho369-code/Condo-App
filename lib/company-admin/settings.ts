// Pure normalization for the company-admin settings form.

/** Accept only absolute http(s) URLs (no javascript:/data: links). */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Normalize the Logo URL field. Blank clears the logo; anything else must be
 * an absolute http(s) URL. The value is written to portfolios.logo_url, which
 * the sidebar, portals and tenant branding read.
 */
export function normalizeCompanyLogoUrl(value: FormDataEntryValue | null): { logoUrl: string | null } | { error: string } {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return { logoUrl: null }
  const logoUrl = safeHttpUrl(raw)
  if (!logoUrl) return { error: 'Logo URL must be a full http(s) address, e.g. https://example.com/logo.png.' }
  return { logoUrl }
}
