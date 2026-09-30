import { describe, expect, it } from 'vitest';
import { addMonths, amortizationSchedule, interestFor } from './amortization';

describe('interestFor', () => {
  it('matches record_loan_payment: balance x rate / periods, to the cent', () => {
    expect(interestFor(100000, 6, 'monthly')).toBe(500);
    expect(interestFor(100000, 6, 'quarterly')).toBe(1500);
    expect(interestFor(98500, 6, 'monthly')).toBe(492.5);
    expect(interestFor(1000, 0, 'monthly')).toBe(0);
  });
});

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-10-01', 3)).toBe('2027-01-01');
  });
});

describe('amortizationSchedule', () => {
  it('pays a loan down to exactly zero with a smaller final payment', () => {
    const s = amortizationSchedule({ balance: 10000, annualRatePct: 6, payment: 1000, frequency: 'monthly', firstPaymentDate: '2026-10-01' });
    expect(s.neverPaysOff).toBe(false);
    expect(s.truncated).toBe(false);
    const last = s.rows[s.rows.length - 1];
    expect(last.balance).toBe(0);
    expect(last.payment).toBeLessThan(1000);
    expect(s.rows[0]).toMatchObject({ n: 1, date: '2026-10-01', interest: 50, principal: 950, balance: 9050 });
    expect(s.payoffDate).toBe(last.date);
    const principal = s.rows.reduce((sum, r) => sum + r.principal, 0);
    expect(Math.round(principal * 100) / 100).toBe(10000);
  });

  it('flags a payment that does not cover the interest', () => {
    const s = amortizationSchedule({ balance: 100000, annualRatePct: 12, payment: 900, frequency: 'monthly', firstPaymentDate: null });
    expect(s.neverPaysOff).toBe(true);
    expect(s.rows).toHaveLength(0);
  });

  it('steps quarterly dates three months apart', () => {
    const s = amortizationSchedule({ balance: 3000, annualRatePct: 4, payment: 1100, frequency: 'quarterly', firstPaymentDate: '2026-12-15' });
    expect(s.rows.map((r) => r.date)).toEqual(['2026-12-15', '2027-03-15', '2027-06-15']);
  });

  it('stops at the period cap and reports it', () => {
    const s = amortizationSchedule({ balance: 1_000_000, annualRatePct: 1, payment: 900, frequency: 'monthly', firstPaymentDate: null, maxPeriods: 12 });
    expect(s.rows).toHaveLength(12);
    expect(s.truncated).toBe(true);
    expect(s.payoffDate).toBeNull();
  });
});
