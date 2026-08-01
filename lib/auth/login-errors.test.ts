import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './login-errors';

describe('loginErrorMessage', () => {
  it('turns tenant boundary codes into professional messages', () => {
    expect(loginErrorMessage('workspace_not_found')).toContain('company workspace');
    expect(loginErrorMessage('workspace_access_denied')).toContain('does not have access');
    expect(loginErrorMessage('platform_workspace_only')).toContain('portier369.com');
  });

  it('preserves provider messages and empty state', () => {
    expect(loginErrorMessage('Invalid login credentials')).toBe('Invalid login credentials');
    expect(loginErrorMessage(undefined)).toBeNull();
  });
});
