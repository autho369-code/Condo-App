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

/** Brand colors are stored as #RRGGBB; the value is sent in a request header. */
export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

/**
 * Normalize the Public website field. Blank clears it; anything else must be
 * an absolute http(s) URL (it may be rendered as a link for residents).
 */
export function normalizeWebsiteUrl(value: FormDataEntryValue | null): { website: string | null } | { error: string } {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return { website: null }
  const website = safeHttpUrl(raw)
  if (!website) return { error: 'Public website must be a full http(s) address, e.g. https://yourcompany.com.' }
  return { website }
}

/** Support email: blank clears it; otherwise a plain address (used as reply-to). */
export function normalizeSupportEmail(value: FormDataEntryValue | null): { email: string | null } | { error: string } {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return { email: null }
  if (raw.length > 254 || !/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(raw)) {
    return { error: 'Support email must be a valid address, e.g. help@yourcompany.com.' }
  }
  return { email: raw }
}
