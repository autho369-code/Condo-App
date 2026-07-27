import { describe, expect, it } from 'vitest';
import { isActivePortalRecord } from './portal-access';

describe('tenant-local portal access', () => {
  it('allows only explicitly activated, non-archived records', () => {
    expect(isActivePortalRecord({ portal_activated: true, archived_at: null })).toBe(true);
    expect(isActivePortalRecord({ portal_activated: false, archived_at: null })).toBe(false);
    expect(isActivePortalRecord({ portal_activated: true, archived_at: '2026-01-01T00:00:00Z' })).toBe(false);
    expect(isActivePortalRecord(null)).toBe(false);
  });
});
