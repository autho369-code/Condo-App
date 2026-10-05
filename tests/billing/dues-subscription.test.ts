import { describe, expect, it } from 'vitest';
import { firstDuesDate } from '@/lib/billing/dues-subscription';

describe('firstDuesDate', () => {
  it('keeps the 1st', () => expect(firstDuesDate('2026-11-01')).toBe('2026-11-01'));
  it('moves mid-month to the next 1st', () => expect(firstDuesDate('2026-10-05')).toBe('2026-11-01'));
  it('rolls over the year', () => expect(firstDuesDate('2026-12-15')).toBe('2027-01-01'));
});
