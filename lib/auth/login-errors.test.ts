import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './login-errors';

describe('loginErrorMessage', () => {
  it('turns tenant boundary codes into professional messages', () => {
    expect(loginErrorMessage('workspace_not_found')).toContain('company workspace');
    expect(loginErrorMessage('workspace_access_denied')).toContain('does not have access');
    expect(loginErrorMessage('platform_workspace_only')).toContain('portier369.com');
    expect(loginErrorMessage('session_expired')).toContain('Sign in again');
  });

  it('never echoes unknown ?error= text (a crafted link could phish on the real sign-in page)', () => {
    expect(loginErrorMessage('Your account is locked. Call 555-0100 to unlock it.')).toBe(loginErrorMessage('anything_unknown'));
    expect(loginErrorMessage('anything_unknown')).toContain('could not sign you in');
    expect(loginErrorMessage(undefined)).toBeNull();
  });

  it('explains expired reset links and disabled accounts', () => {
    expect(loginErrorMessage('reset_link_expired')).toContain('Request a new one');
    expect(loginErrorMessage('account_disabled')).toContain('disabled');
  });
});
