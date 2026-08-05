import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('MFA application boundary', () => {
  it('checks the effective policy and AAL before protected middleware requests continue', () => {
    const source = readFileSync('middleware.ts', 'utf8');

    expect(source).toContain('requiresMfa(requestIdentity)');
    expect(source).toContain("assurance?.currentLevel !== 'aal2'");
    expect(source).toContain("request.method === 'GET' && pathname === '/mfa'");
    expect(source).toContain("error: assuranceError ? 'mfa_verification_unavailable' : 'mfa_required'");
    expect(source).toContain("requestHeaders.set('x-portier-client-address'");
  });

  it('keeps a server-side defense-in-depth check for direct guard usage', () => {
    const source = readFileSync('lib/auth/me.ts', 'utf8');

    expect(source).toContain('getAuthenticatorAssuranceLevel()');
    expect(source).toContain("data?.currentLevel === 'aal2'");
    expect(source).toContain('await enforceConfiguredMfa(me, supabase)');
    expect(source).toContain("home === '/login' ? '/account' : home");
    expect(source).toContain("candidatePathname === '/login' || candidatePathname === '/mfa'");
  });

  it('records verified enrollment and exposes audited administrator recovery', () => {
    const completion = readFileSync('app/api/auth/mfa-complete/route.ts', 'utf8');
    const recovery = readFileSync('lib/auth/mfa-admin.ts', 'utf8');

    expect(completion).toContain("assurance?.currentLevel !== 'aal2'");
    expect(completion).toContain("action: 'mfa_enrolled'");
    expect(completion).toContain("update({ mfa_used: true })");
    expect(recovery).toContain('auth.admin.mfa.listFactors');
    expect(recovery).toContain('auth.admin.mfa.deleteFactor');
    expect(recovery).toContain("action: 'mfa_reset_authorized'");
    expect(recovery).toContain("action: 'mfa_reset_completed'");
  });

  it('authenticates certificate extraction before entering its error-catching block', () => {
    const source = readFileSync('app/api/ai/extract-certificate/route.ts', 'utf8');
    const guard = source.indexOf('await requireWorkspaceStaff()');
    const catchableWork = source.indexOf('try {');

    expect(guard).toBeGreaterThan(-1);
    expect(catchableWork).toBeGreaterThan(guard);
  });
});
