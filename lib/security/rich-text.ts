import createDOMPurify from 'dompurify';

const RICH_TEXT_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
  'h1', 'h2', 'h3', 'h4', 'a',
];

const RICH_TEXT_ATTRIBUTES = ['href', 'title'];
const SAFE_LINK = /^(?:(?:https?|mailto|tel):|[/?#]|\.{1,2}\/)/i;

/** Browser-only rich-text sanitizer with a deliberately small allowlist. */
export function sanitizeRichTextHtml(html: string): string {
  if (!html || typeof window === 'undefined') return '';

  const purifier = createDOMPurify(window);
  return purifier.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ATTRIBUTES,
    ALLOWED_URI_REGEXP: SAFE_LINK,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math'],
    FORBID_ATTR: ['style'],
    RETURN_TRUSTED_TYPE: false,
  });
}

/** Escape text for fixed HTML shells such as a print-document title. */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/**
 * Server-safe HTML -> plain text for previews of stored rich text (e.g.
 * announcement bodies). The result must be rendered as a React text node,
 * never as HTML: tags are dropped, block breaks become newlines and common
 * entities are decoded.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      const lower = code.toLowerCase();
      if (lower in NAMED_ENTITIES) return NAMED_ENTITIES[lower];
      const n = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : lower.startsWith('#') ? parseInt(lower.slice(1), 10) : NaN;
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
