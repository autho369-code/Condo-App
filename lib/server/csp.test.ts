import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { appContentSecurityPolicy, marketingContentSecurityPolicy, newNonce, PRINT_SCRIPT_HASH } from './csp';
import { PRINT_ON_LOAD_SCRIPT } from '../print-script';

describe('app Content Security Policy', () => {
  const policy = appContentSecurityPolicy('abc123');
  const scriptSrc = policy.split('; ').find((d) => d.startsWith('script-src')) ?? '';

  it('runs only scripts with this request\'s nonce or from known origins', () => {
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain('https://js.stripe.com');
    expect(scriptSrc).toContain('https://cdn.plaid.com');
  });

  it('allows no inline script and no eval in production', () => {
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(appContentSecurityPolicy('x', true)).toContain("'unsafe-eval'");
  });

  it('keeps the framing, plugin and form limits and reports blocks', () => {
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain('report-uri /api/csp-report');
  });

  it('allows a local Supabase only in development, and only on loopback', () => {
    const before = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:55321';
      expect(appContentSecurityPolicy('n', true)).toMatch(/connect-src [^;]*http:\/\/127\.0\.0\.1:55321/);
      expect(appContentSecurityPolicy('n', false)).not.toContain('127.0.0.1');
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://evil.example.com';
      expect(appContentSecurityPolicy('n', true)).not.toContain('evil.example.com');
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = before;
    }
  });

  it('lets bank linking (Plaid) load, frame and call home', () => {
    expect(policy).toMatch(/frame-src [^;]*https:\/\/cdn\.plaid\.com/);
    expect(policy).toMatch(/connect-src [^;]*https:\/\/\*\.plaid\.com/);
  });
});

describe('print windows', () => {
  it('allow exactly the fixed print script by its hash', () => {
    const hash = createHash('sha256').update(PRINT_ON_LOAD_SCRIPT).digest('base64');
    expect(PRINT_SCRIPT_HASH).toBe(`'sha256-${hash}'`);
    expect(appContentSecurityPolicy('n')).toContain(PRINT_SCRIPT_HASH);
  });
});

describe('nonces', () => {
  it('are random and long enough', () => {
    const a = newNonce();
    expect(a).not.toBe(newNonce());
    expect(atob(a)).toHaveLength(16);
  });
});

describe('marketing pages', () => {
  it('keep a looser policy (they are prerendered, no per-request nonce)', () => {
    expect(marketingContentSecurityPolicy).toContain("'unsafe-inline'");
  });
});

describe('middleware sends the policy', () => {
  const source = readFileSync('middleware.ts', 'utf8');
  it('enforces it on app pages and passes the nonce to Next.js', () => {
    expect(source).toContain("response.headers.set('Content-Security-Policy', appContentSecurityPolicy(nonce");
    expect(source).toContain("requestHeaders.set('content-security-policy', appContentSecurityPolicy(nonce");
    expect(source).toContain("requestHeaders.delete('content-security-policy')");
  });
  it('is no longer a report-only header for every page in next.config', () => {
    expect(readFileSync('next.config.mjs', 'utf8')).not.toContain("'unsafe-eval'");
  });
});
