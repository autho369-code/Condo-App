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
});
