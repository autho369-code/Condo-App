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
