import { describe, expect, it } from 'vitest';

import {
  getLoginModeConfig,
  getLoginNext,
  getVisibleLoginModes,
  normalizeLoginMode,
  safeInternalNext,
} from '@/lib/auth/login-modes';

describe('login mode routing', () => {
  it('defaults unknown modes to manager sign in', () => {
    expect(normalizeLoginMode(undefined)).toBe('manager');
    expect(normalizeLoginMode('vendor')).toBe('manager');
    expect(getLoginModeConfig('vendor').title).toBe('Manager Sign In');
  });

  it('sets role-specific default destinations', () => {
    expect(getLoginNext({ mode: 'manager' })).toBe('/dashboard');
    expect(getLoginNext({ mode: 'owner' })).toBe('/portal');
    expect(getLoginNext({ mode: 'admin' })).toBe('/platform/portfolios');
  });

  it('allows only internal next paths', () => {
    expect(safeInternalNext('/reports')).toBe('/reports');
    expect(safeInternalNext('https://bad.example/dashboard')).toBeNull();
    expect(safeInternalNext('//bad.example/dashboard')).toBeNull();
    expect(getLoginNext({ mode: 'admin', next: 'https://bad.example/dashboard' })).toBe('/platform/portfolios');
  });

  it('hides admin sign in from public login choices', () => {
    expect(getVisibleLoginModes('manager').map((mode) => mode.id)).toEqual(['manager', 'owner']);
    expect(getVisibleLoginModes('owner').map((mode) => mode.id)).toEqual(['manager', 'owner']);
    expect(getVisibleLoginModes('admin').map((mode) => mode.id)).toEqual(['admin']);
  });
});
