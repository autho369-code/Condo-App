import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { firstVendorEmail, isVendorDocType, vendorDocExpires } from '@/lib/vendors/document-requests';

describe('vendor document types', () => {
  it('knows which documents carry an expiration date', () => {
    expect(vendorDocExpires('general_liability')).toBe(true);
    expect(vendorDocExpires('w9')).toBe(false);
    expect(isVendorDocType('w9')).toBe(true);
    expect(isVendorDocType('bank_account')).toBe(false);
  });

  it('picks the first valid vendor email from either storage shape', () => {
    expect(firstVendorEmail(['bad', 'ops@acme.com'])).toBe('ops@acme.com');
    expect(firstVendorEmail([{ email: 'ap@acme.com' }])).toBe('ap@acme.com');
    expect(firstVendorEmail(null)).toBeNull();
  });
});

describe('vendor document request migration', () => {
  const sql = readFileSync('supabase/migrations/20260929220000_vendor_document_requests.sql', 'utf8');

  it('makes vendor access to their requests read-only', () => {
    expect(sql).toMatch(/create policy doc_requests_vendor_self on public\.document_requests for select/);
  });

  it('keeps link hashes and token functions away from signed-in users', () => {
    expect(sql).toContain('revoke all on public.document_request_links from public, anon, authenticated;');
    expect(sql).toContain('revoke all on function public.vendor_request_session(text) from public, anon, authenticated;');
    expect(sql).toContain('revoke all on function public.submit_vendor_request_upload(text, text, text, date) from public, anon, authenticated;');
  });

  it('confines uploads to the vendor compliance prefix', () => {
    expect(sql).toContain("p_path not like 'vendors/' || r.vendor_id::text || '/compliance/%'");
  });
});

describe('public upload page', () => {
  it('is a public path, rate limited, and never stores the raw token', () => {
    expect(readFileSync('lib/server/public-paths.ts', 'utf8')).toContain("'/vendor-upload'");
    const actions = readFileSync('app/(public)/vendor-upload/[token]/actions.ts', 'utf8');
    expect(actions).toContain('consumePublicRateLimit');
    expect(actions).toContain('hashSigningToken(token)');
    const staff = readFileSync('lib/rpcs/vendor-document-requests.ts', 'utf8');
    expect(staff).toContain('token_hash: hash');
    expect(staff).not.toMatch(/token_hash: token\b/);
  });
});
