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
    expect(normalizeLoginMode('unknown')).toBe('manager');
    expect(getLoginModeConfig('unknown').title).toBe('Manager Sign In');
  });

  it('sets role-specific default destinations', () => {
    expect(getLoginNext({ mode: 'manager' })).toBe('/dashboard');
    expect(getLoginNext({ mode: 'owner' })).toBe('/portal');
    // Operators land in the current operator portal, NOT the legacy
    // app/platform/* section (duplicated — consolidation pending).
    expect(getLoginNext({ mode: 'admin' })).toBe('/platform-operator');
  });

  it('allows only internal next paths', () => {
    expect(safeInternalNext('/reports')).toBe('/reports');
    expect(safeInternalNext('https://bad.example/dashboard')).toBeNull();
    expect(safeInternalNext('//bad.example/dashboard')).toBeNull();
    expect(getLoginNext({ mode: 'admin', next: 'https://bad.example/dashboard' })).toBe('/platform-operator');
  });

  it('hides admin sign in from public login choices', () => {
    expect(getVisibleLoginModes('manager').map((mode) => mode.id)).toEqual(['manager', 'owner', 'vendor']);
    expect(getVisibleLoginModes('owner').map((mode) => mode.id)).toEqual(['manager', 'owner', 'vendor']);
    expect(getVisibleLoginModes('admin').map((mode) => mode.id)).toEqual(['admin']);
  });
});
