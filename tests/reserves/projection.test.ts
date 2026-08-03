import { describe, expect, it } from 'vitest';

import {
  firstShortfallYear,
  fullyFundedBalanceForYear,
  minimumAnnualContribution,
  projectReserveFunding,
  replacementEventsForYear,
  type ReserveComponentInput,
  type ReserveScenarioInput,
} from '@/lib/reserves/projection';

const roof: ReserveComponentInput = {
  id: 'roof',
  name: 'Roof membrane',
  currentAgeYears: 15,
  usefulLifeYears: 20,
  remainingLifeYears: 5,
  currentReplacementCost: 100_000,
};

const baseScenario: ReserveScenarioInput = {
  baseYear: 2026,
  horizonYears: 30,
  openingBalance: 50_000,
  annualContribution: 10_000,
  contributionGrowthRate: 0,
  interestRate: 0,
  inflationRate: 3,
};

describe('reserve projections', () => {
  it('schedules a component at remaining life and repeats by useful life', () => {
    expect(replacementEventsForYear(roof, 4, 3)).toEqual([]);
    expect(replacementEventsForYear(roof, 5, 3)[0]).toMatchObject({
      componentName: 'Roof membrane',
      replacementNumber: 1,
      amount: 115_927.41,
    });
    expect(replacementEventsForYear(roof, 25, 3)[0].replacementNumber).toBe(2);
  });

  it('projects contributions, inflation-adjusted work, and a shortfall year', () => {
    const rows = projectReserveFunding([roof], baseScenario);
    expect(rows).toHaveLength(30);
    expect(rows[0]).toMatchObject({ year: 2027, openingBalance: 50_000, contribution: 10_000 });
    expect(rows[4].expenditures).toBe(115_927.41);
    expect(firstShortfallYear(rows)).toBe(2031);
  });

  it('resets component accrued liability after replacement', () => {
    const before = fullyFundedBalanceForYear([roof], 4, 3);
    const atReplacement = fullyFundedBalanceForYear([roof], 5, 3);
    expect(before).toBeGreaterThan(100_000);
    expect(atReplacement).toBe(0);
  });

  it('finds the minimum level contribution that avoids negative cash', () => {
    const contribution = minimumAnnualContribution([roof], baseScenario);
    const rows = projectReserveFunding([roof], { ...baseScenario, annualContribution: contribution });
    expect(contribution).toBeGreaterThan(10_000);
    expect(firstShortfallYear(rows)).toBeNull();
    expect(Math.min(...rows.map((row) => row.endingBalance))).toBeGreaterThanOrEqual(0);
  });

  it('applies special assessments in the selected projection year', () => {
    const without = projectReserveFunding([roof], baseScenario);
    const withAssessment = projectReserveFunding([roof], {
      ...baseScenario,
      specialAssessments: [{ year: 5, amount: 75_000 }],
    });

    expect(withAssessment[4].specialAssessments).toBe(75_000);
    expect(withAssessment[4].endingBalance - without[4].endingBalance).toBe(75_000);
  });
});
