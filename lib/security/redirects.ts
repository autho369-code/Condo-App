const INTERNAL_ORIGIN = 'https://internal.portier369.invalid';

/**
 * Accept only an absolute path on this application.
 *
 * Besides ordinary external URLs, this rejects scheme-relative and backslash
 * variants (including percent-encoded variants) that URL parsers or proxies
 * can reinterpret as a network-path reference.
 */
export function safeInternalNext(
  value?: FormDataEntryValue | string | string[] | null,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return null;

  // Decode twice so double-encoded leading slashes/backslashes cannot become
  // a network path in a later routing/proxy layer.
  let decoded = trimmed;
  for (let i = 0; i < 2; i += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (
      decoded.startsWith('//')
      || decoded.startsWith('/\\')
      || decoded.includes('\\')
      || /[\u0000-\u001f\u007f]/.test(decoded)
    ) return null;
  }

  try {
    const parsed = new URL(trimmed, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN || parsed.username || parsed.password) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
