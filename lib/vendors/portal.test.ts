import { describe, expect, it } from 'vitest';
import {
  addDaysToDate,
  canVendorChangeStatus,
  complianceState,
  isVendorInvoiceable,
  isVendorSettableStatus,
} from './portal';

describe('vendor portal helpers', () => {
  it('only accepts the statuses a vendor may set', () => {
    expect(isVendorSettableStatus('done')).toBe(true);
    expect(isVendorSettableStatus('in_progress')).toBe(true);
    expect(isVendorSettableStatus('completed')).toBe(false);
    expect(isVendorSettableStatus('closed')).toBe(false);
    expect(isVendorSettableStatus('')).toBe(false);
    expect(isVendorSettableStatus(null)).toBe(false);
  });

  it('mirrors the DB guard for transitions', () => {
    expect(canVendorChangeStatus('assigned', 'scheduled')).toBe(true);
    expect(canVendorChangeStatus('done', 'in_progress')).toBe(true);
    expect(canVendorChangeStatus('completed', 'in_progress')).toBe(false);
    expect(canVendorChangeStatus('billed', 'done')).toBe(false);
    expect(canVendorChangeStatus('cancelled', 'scheduled')).toBe(false);
    expect(canVendorChangeStatus('new', 'closed')).toBe(false);
  });

  it('matches the invoice RPC status rule', () => {
    expect(isVendorInvoiceable('done')).toBe(true);
    expect(isVendorInvoiceable('billed')).toBe(true);
    expect(isVendorInvoiceable('in_progress')).toBe(false);
    expect(isVendorInvoiceable(null)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysToDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToDate('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDaysToDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('classifies expiration dates against the local calendar day', () => {
    const today = '2026-10-04';
    expect(complianceState(null, today)).toBe('missing');
    expect(complianceState('', today)).toBe('missing');
    expect(complianceState('2026-10-03', today)).toBe('expired');
    expect(complianceState('2026-10-04', today)).toBe('expiring');
    expect(complianceState('2026-11-03', today)).toBe('expiring');
    expect(complianceState('2026-11-04', today)).toBe('current');
    // Timestamps are read by their calendar date.
    expect(complianceState('2026-10-03T00:00:00+00:00', today)).toBe('expired');
  });
});
