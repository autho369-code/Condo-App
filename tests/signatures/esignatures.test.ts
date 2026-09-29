import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashSigningToken, isPdf, isWellFormedToken, newSigningToken, sha256Hex } from '@/lib/signatures/crypto';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('e-signature tokens and fingerprints', () => {
  it('issues 256-bit url-safe tokens whose stored form is a sha256 hash', () => {
    const { token, hash } = newSigningToken();
    expect(isWellFormedToken(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSigningToken(token)).toBe(hash);
    expect(newSigningToken().token).not.toBe(token);
  });

  it('rejects malformed tokens before any database call', () => {
    for (const bad of ['', 'short', 'x'.repeat(44), '../../etc/passwd'.padEnd(43, 'a'), null, undefined]) {
      expect(isWellFormedToken(bad as any)).toBe(false);
    }
  });

  it('fingerprints documents deterministically and detects PDFs by magic bytes', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(isPdf(new TextEncoder().encode('%PDF-1.7 ...'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
  });
});

describe('e-signature database boundary', () => {
  const m = read('supabase/migrations/20260929150000_esignatures.sql').toLowerCase();
  const handoff = read('supabase/migrations/20260929150100_esignature_sequential_handoff.sql').toLowerCase();

  it('never exposes token hashes or direct writes to API roles', () => {
    expect(m).toContain('revoke all on public.signature_requests, public.signature_signers, public.signature_events from anon, authenticated');
    const grant = m.slice(m.indexOf('grant select (id, request_id'), m.indexOf('on public.signature_signers to authenticated'));
    expect(grant).not.toContain('token_hash');
  });

  it('keeps token-authenticated signer functions service-role only', () => {
    for (const fn of ['signature_session(text, text, text)', 'sign_signature_request(text, text, boolean, text, text, text)', 'decline_signature_request(text, text, text, text)']) {
      expect(m).toContain(`grant execute on function public.${fn} to service_role;`);
      expect(m).not.toMatch(new RegExp(`grant execute on function public\.${fn.replace(/[()]/g, '\$&')} to authenticated`));
    }
    expect(handoff).toContain('revoke all on function public.issue_next_signer_token(uuid, text) from public, anon, authenticated');
  });

  it('requires consent, an unchanged document, order, and no double signing', () => {
    const sign = m.slice(m.indexOf('create or replace function public.sign_signature_request'));
    expect(sign).toContain('consent to sign electronically is required');
    expect(sign).toContain('the document changed after it was sent');
    expect(sign).toContain('an earlier signer must sign first');
    expect(sign).toContain('you have already responded to this request');
  });

  it('recomputes the document hash from storage before signing', () => {
    const actions = read('app/(public)/sign/[token]/actions.ts');
    expect(actions).toContain('currentDocumentHash(service, session.request)');
    expect(actions).toContain('p_document_sha256: docHash');
    expect(actions).toContain('consumePublicRateLimit');
  });
});
