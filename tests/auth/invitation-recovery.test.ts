import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('invitation and password recovery surfaces', () => {
  const invite = readFileSync(resolve(process.cwd(), 'app/invite/page.tsx'), 'utf8');
  const forgot = readFileSync(resolve(process.cwd(), 'app/(auth)/forgot-password/page.tsx'), 'utf8');
  const reset = readFileSync(resolve(process.cwd(), 'app/(auth)/reset-password/page.tsx'), 'utf8');

  it('rate limits public invitation acceptance and rolls back partial account creation', () => {
    expect(invite).toContain("scope: 'invitation_accept_ip'");
    expect(invite).toContain("scope: 'invitation_accept_token'");
    expect(invite).toContain('auth.admin.deleteUser');
    expect(invite).toContain("status: 'pending'");
    expect(invite).toContain('invitation-verification:');
    expect(invite).not.toContain('Sign them in with their new credentials');
  });

  it('rate limits reset requests without weakening non-enumerating responses', () => {
    expect(forgot).toContain("scope: 'password_reset_ip'");
    expect(forgot).toContain("scope: 'password_reset_email'");
    expect(forgot).toContain('If an account exists for that email');
    expect(reset).toContain('placeholder="At least 12 characters"');
  });

  it("sends a company's password reset under the company's name (white label)", () => {
    expect(forgot).toContain("subject: brand ? `Reset your ${brand} password` : 'Reset your password'");
    expect(forgot).toContain('from_name: portfolioId ? null : PLATFORM_NAME');
    // portfolios has company_name only (no name column).
    expect(forgot).toContain(".from('portfolios').select('company_name, slug, archived_at')");
    expect(forgot).not.toContain("'Reset your Portier369 password'");
    expect(reset).not.toContain('Portier369');
  });

  it("links a company's people to their own workspace even when asked on the platform address", () => {
    expect(forgot).toContain("tenantWorkspaceUrl(portfolio.slug, '/api/auth/callback?next=/reset-password')");
    expect(forgot).toContain("verifiedAuthLink(linkData, linkRedirect, 'recovery')");
  });
});
