export type ReserveComponentInput = {
  id?: string;
  name: string;
  currentAgeYears: number;
  usefulLifeYears: number;
  remainingLifeYears: number;
  currentReplacementCost: number;
  inflationRate?: number | null;
};

export type SpecialAssessment = {
  year: number;
  amount: number;
  label?: string;
};

export type ReserveScenarioInput = {
  baseYear: number;
  horizonYears: number;
  openingBalance: number;
  annualContribution: number;
  contributionGrowthRate: number;
  interestRate: number;
  inflationRate: number;
  specialAssessments?: SpecialAssessment[];
};

export type ReserveExpenditure = {
  componentId?: string;
  componentName: string;
  amount: number;
  replacementNumber: number;
};

export type ReserveProjectionYear = {
  year: number;
  openingBalance: number;
  contribution: number;
  specialAssessments: number;
  interestEarned: number;
  expenditures: number;
  endingBalance: number;
  fullyFundedBalance: number;
  percentFunded: number;
  expendituresDetail: ReserveExpenditure[];
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function replacementInterval(component: ReserveComponentInput) {
  return Math.max(1, Math.ceil(nonNegative(component.usefulLifeYears)));
}

function firstReplacementYear(component: ReserveComponentInput) {
  return Math.max(1, Math.ceil(nonNegative(component.remainingLifeYears)));
}

export function replacementEventsForYear(
  component: ReserveComponentInput,
  projectionYear: number,
  defaultInflationRate: number,
): ReserveExpenditure[] {
  const firstYear = firstReplacementYear(component);
  if (projectionYear < firstYear) return [];

  const interval = replacementInterval(component);
  const yearsAfterFirst = projectionYear - firstYear;
  if (yearsAfterFirst % interval !== 0) return [];

  const rate = nonNegative(component.inflationRate ?? defaultInflationRate) / 100;
  const replacementNumber = Math.floor(yearsAfterFirst / interval) + 1;
  return [{
    componentId: component.id,
    componentName: component.name,
    replacementNumber,
    amount: money(nonNegative(component.currentReplacementCost) * Math.pow(1 + rate, projectionYear)),
  }];
}

export function fullyFundedBalanceForYear(
  components: ReserveComponentInput[],
  projectionYear: number,
  defaultInflationRate: number,
) {
  return money(components.reduce((total, component) => {
    const usefulLife = Math.max(1, nonNegative(component.usefulLifeYears));
    const firstYear = firstReplacementYear(component);
    const interval = replacementInterval(component);
    const inflation = nonNegative(component.inflationRate ?? defaultInflationRate) / 100;
    const futureCost = nonNegative(component.currentReplacementCost) * Math.pow(1 + inflation, projectionYear);

    let effectiveAge: number;
    if (projectionYear < firstYear) {
      effectiveAge = Math.min(usefulLife, nonNegative(component.currentAgeYears) + projectionYear);
    } else {
      effectiveAge = (projectionYear - firstYear) % interval;
    }

    return total + futureCost * Math.min(1, effectiveAge / usefulLife);
  }, 0));
}

export function projectReserveFunding(
  components: ReserveComponentInput[],
  scenario: ReserveScenarioInput,
): ReserveProjectionYear[] {
  const horizon = Math.max(1, Math.min(50, Math.floor(nonNegative(scenario.horizonYears))));
  const assessmentByYear = new Map<number, number>();
  for (const assessment of scenario.specialAssessments ?? []) {
    const year = Math.floor(nonNegative(assessment.year));
    if (year < 1 || year > horizon) continue;
    assessmentByYear.set(year, money((assessmentByYear.get(year) ?? 0) + nonNegative(assessment.amount)));
  }

  const rows: ReserveProjectionYear[] = [];
  let openingBalance = money(nonNegative(scenario.openingBalance));
  const interestRate = nonNegative(scenario.interestRate) / 100;
  const contributionGrowth = Math.max(-0.99, scenario.contributionGrowthRate / 100);

  for (let offset = 1; offset <= horizon; offset += 1) {
    const contribution = money(nonNegative(scenario.annualContribution) * Math.pow(1 + contributionGrowth, offset - 1));
    const specialAssessments = assessmentByYear.get(offset) ?? 0;
    const interestEarned = money(Math.max(0, openingBalance) * interestRate);
    const expendituresDetail = components.flatMap((component) =>
      replacementEventsForYear(component, offset, scenario.inflationRate));
    const expenditures = money(expendituresDetail.reduce((sum, item) => sum + item.amount, 0));
    const endingBalance = money(openingBalance + contribution + specialAssessments + interestEarned - expenditures);
    const fullyFundedBalance = fullyFundedBalanceForYear(components, offset, scenario.inflationRate);
    const percentFunded = fullyFundedBalance > 0
      ? money((Math.max(0, endingBalance) / fullyFundedBalance) * 100)
      : 100;

    rows.push({
      year: scenario.baseYear + offset,
      openingBalance,
      contribution,
      specialAssessments,
      interestEarned,
      expenditures,
      endingBalance,
      fullyFundedBalance,
      percentFunded,
      expendituresDetail,
    });

    openingBalance = endingBalance;
  }

  return rows;
}

export function firstShortfallYear(rows: ReserveProjectionYear[]) {
  return rows.find((row) => row.endingBalance < 0)?.year ?? null;
}

export function minimumAnnualContribution(
  components: ReserveComponentInput[],
  scenario: ReserveScenarioInput,
) {
  const isFunded = (annualContribution: number) =>
    firstShortfallYear(projectReserveFunding(components, { ...scenario, annualContribution })) === null;

  if (isFunded(0)) return 0;

  let lower = 0;
  let upper = Math.max(1_000, nonNegative(scenario.annualContribution));
  while (!isFunded(upper) && upper < 1_000_000_000) upper *= 2;
  if (!isFunded(upper)) return upper;

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (isFunded(midpoint)) upper = midpoint;
    else lower = midpoint;
  }

  return Math.ceil(upper * 100) / 100;
}

export function reserveHealthTone(percentFunded: number, hasShortfall: boolean) {
  if (hasShortfall || percentFunded < 30) return 'danger' as const;
  if (percentFunded < 70) return 'warning' as const;
  if (percentFunded < 100) return 'info' as const;
  return 'success' as const;
}
