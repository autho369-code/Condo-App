import { describe, expect, it } from 'vitest';
import { escapeHtmlText, sanitizeRichTextHtml } from '@/lib/security/rich-text';

describe('rich-text output safety', () => {
  it('preserves the formatting allowlist while removing executable markup', () => {
    const sanitized = sanitizeRichTextHtml(
      '<p onclick=alert(1)>Hello <strong>world</strong></p>'
      + '<img src=x onerror=alert(2)>'
      + '<svg><script>alert(3)</script></svg>',
    );

    expect(sanitized).toContain('<p>Hello <strong>world</strong></p>');
    expect(sanitized).not.toMatch(/onclick|onerror|<img|<svg|<script/i);
  });

  it('removes quoted and unquoted javascript URLs', () => {
    const sanitized = sanitizeRichTextHtml(
      '<a href=javascript:alert(1)>one</a><a href="JaVaScRiPt:alert(2)">two</a><a href="https://safe.example/path">safe</a>',
    );

    expect(sanitized).not.toMatch(/javascript:/i);
    expect(sanitized).toContain('href="https://safe.example/path"');
  });

  it('escapes text embedded in a fixed print-document shell', () => {
    expect(escapeHtmlText('<img src=x onerror=alert(1)> & "quoted"'))
      .toBe('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot;');
  });
});
