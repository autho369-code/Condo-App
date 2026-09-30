import { describe, expect, it } from 'vitest';
import { observedDate } from './observed-date';

const now = new Date('2026-10-01T15:00:00Z');

describe('observedDate', () => {
  it('keeps the capture date of an offline capture synced later', () => {
    expect(observedDate('2026-09-27', now)).toBe('2026-09-27');
  });
  it('allows a device one day ahead of the server', () => {
    expect(observedDate('2026-10-02', now)).toBe('2026-10-02');
  });
  it('falls back to today for future, stale, or malformed dates', () => {
    expect(observedDate('2026-10-05', now)).toBe('2026-10-01');
    expect(observedDate('2026-06-01', now)).toBe('2026-10-01');
    expect(observedDate('2026-02-30', now)).toBe('2026-10-01');
    expect(observedDate('yesterday', now)).toBe('2026-10-01');
    expect(observedDate(null, now)).toBe('2026-10-01');
  });
});
