import { describe, expect, it } from 'vitest';
import { qrDataUrl } from '@/components/auth/mfa-verification';

// Supabase's mfa.enroll returns totp.qr_code as `data:image/svg+xml;utf-8,<raw svg>`.
// Handing that unencoded SVG to next/image crashed the two-step setup page, so the
// QR is shown with a plain img and a percent-encoded data URL.
describe('two-step setup QR code', () => {
  it('percent-encodes the raw SVG Supabase returns', () => {
    const raw = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h1v1H0z" fill="#000"/></svg>';
    const url = qrDataUrl(raw);
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(true);
    expect(url).not.toMatch(/[<>"# ]/);
    expect(decodeURIComponent(url.slice(url.indexOf(',') + 1))).toBe(raw.slice(raw.indexOf(',') + 1));
  });

  it('leaves an already encoded or base64 data URL alone', () => {
    const b64 = 'data:image/png;base64,iVBORw0KGgo=';
    expect(qrDataUrl(b64)).toBe(b64);
  });

  it('accepts bare SVG markup', () => {
    expect(qrDataUrl('<svg></svg>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E');
  });
});
