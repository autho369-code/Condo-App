// Forward amortization schedule for an association loan, from today's
// balance. Interest per period = balance x annual rate / periods per year,
// rounded to cents — the same rule record_loan_payment uses by default.

export type LoanFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export const PERIODS_PER_YEAR: Record<LoanFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
};

export const FREQUENCY_LABEL: Record<LoanFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Every 6 months',
  annual: 'Yearly',
};

export type ScheduleRow = {
  n: number;
  date: string | null;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

export type Schedule = {
  rows: ScheduleRow[];
  totalInterest: number;
  payoffDate: string | null;
  /** The payment doesn't cover the interest, so the loan never pays off. */
  neverPaysOff: boolean;
  /** Stopped at the period cap before reaching zero. */
  truncated: boolean;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function periodsPerYear(frequency: string | null | undefined): number {
  return PERIODS_PER_YEAR[(frequency ?? 'monthly') as LoanFrequency] ?? 12;
}

/** Add whole months to an ISO date, clamping to the month's last day. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function interestFor(balance: number, annualRatePct: number, frequency: string | null | undefined): number {
  return cents((balance * (annualRatePct || 0)) / 100 / periodsPerYear(frequency));
}

export function amortizationSchedule(input: {
  balance: number;
  annualRatePct: number;
  payment: number;
  frequency: string | null | undefined;
  firstPaymentDate: string | null;
  maxPeriods?: number;
}): Schedule {
  const maxPeriods = input.maxPeriods ?? 600;
  const monthsPerPeriod = 12 / periodsPerYear(input.frequency);
  let balance = cents(input.balance);
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;

  if (balance <= 0 || input.payment <= 0) {
    return { rows, totalInterest: 0, payoffDate: null, neverPaysOff: balance > 0, truncated: false };
  }
  const firstInterest = interestFor(balance, input.annualRatePct, input.frequency);
  if (input.payment <= firstInterest) {
    return { rows, totalInterest: 0, payoffDate: null, neverPaysOff: true, truncated: false };
  }

  for (let n = 1; n <= maxPeriods && balance > 0; n++) {
    const interest = interestFor(balance, input.annualRatePct, input.frequency);
    const payment = Math.min(cents(input.payment), cents(balance + interest));
    const principal = cents(payment - interest);
    balance = cents(balance - principal);
    totalInterest = cents(totalInterest + interest);
    rows.push({
      n,
      date: input.firstPaymentDate ? addMonths(input.firstPaymentDate, (n - 1) * monthsPerPeriod) : null,
      payment,
      interest,
      principal,
      balance,
    });
  }
  const last = rows[rows.length - 1];
  return {
    rows,
    totalInterest,
    payoffDate: balance <= 0 ? last?.date ?? null : null,
    neverPaysOff: false,
    truncated: balance > 0,
  };
}
